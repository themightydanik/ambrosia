import { state } from '../state.js';
import { registerScreen } from '../navigation.js';
import { authenticatedFetch, refreshAccess, accountAccess } from '../account-access.js';
import { securityText } from '../security-copy.js';
const PERIOD_LABELS = { en: 'Analysis period', ru: 'Период анализа', uk: 'Період аналізу' };
const PERIODS = { '7': 7, '30': 30, '90': 90, all: null };
const selectedPeriod = () => document.getElementById('ai-period')?.value || '30';
const dateCutoff = (days) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export function buildHistoryText(period = 'all') {
  const days = Object.prototype.hasOwnProperty.call(PERIODS, period) ? PERIODS[period] : null;
  const cutoff = days ? dateCutoff(days) : null;
  const mainEntries = state.entries.filter(e => !e.isUpdate && (!cutoff || (typeof e.date === 'string' && e.date >= cutoff)));
  if (mainEntries.length === 0) return 'No symptom entries recorded yet.';

  const updateMap = {};
  state.entries.filter(e => e.isUpdate && e.parentId && (!cutoff || (typeof e.date === 'string' && e.date >= cutoff))).forEach(u => {
    if (!updateMap[u.parentId]) updateMap[u.parentId] = [];
    updateMap[u.parentId].push(u);
  });

  return [...mainEntries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      let line = `Date: ${e.date}${e.time ? ' ' + e.time : ''} | Symptoms: ${e.symptoms.join(', ')} | Intensity: ${e.intensity}/10`;
      if (e.triggers.length) line += ` | Triggers: ${e.triggers.join(', ')}`;
      if (e.notes) line += ` | Notes: "${e.notes}"`;
      const updates = [...(e.statusUpdates || []), ...(updateMap[e.id] || [])];
      if (updates.length) {
        line += ' | Status updates: ' + updates.map(u => `${u.date} ${u.time || ''} → ${u.status || u.updateStatus}${u.notes ? `: ${u.notes}` : ''}`).join(', ');
      }
      return line;
    }).join('\n');
}


let running=false;
export async function runAI(feature) {
  const area=document.getElementById('ai-result-area'),id=state.accountId,t=securityText(state.lang);
  if (!area || running) return;
  if (!id) { area.textContent=t.SIGN_IN_REQUIRED;return; }
  if (!navigator.onLine) { area.textContent=t.SERVICE_UNAVAILABLE;return; }
  const history=buildHistoryText(selectedPeriod());
  if (history==='No symptom entries recorded yet.') {area.textContent=t.empty;return;}
  if (history.length>12000) {area.textContent=t.TOO_LARGE;return;}
  const appointment=feature==='doctor_visit' ? `${document.getElementById('dv-date')?.value || ''} ${document.getElementById('dv-doctor')?.value || ''}` : undefined;
  // Consent is per request; never a reusable localStorage permission to send future health records.
  if (!confirm(t.consent)) return;
  running=true;area.textContent=t.working;
  try {
    const response=await authenticatedFetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),feature,history,language:state.lang,appointment,consent:'groq-health-v1'})});
    if(state.accountId!==id)return;
    // Model output is untrusted plain text, including reports and appointment values.
    area.textContent=response.text+'\n\n'+t.aiDisclaimer;
  } catch(error) {if(state.accountId===id) area.textContent=t[error.message] || t.error;}
  finally {running=false;if(state.accountId===id){await refreshAccess(true);renderUsage();}}
}
function renderUsage() {
  const root=document.getElementById('ai-usage');if(!root)return;const t=securityText(state.lang),access=accountAccess();
  root.textContent=access ? `${t.usage}: ${access.used}/${access.limit} · ${access.remaining} ${t.remaining} · ${t.renew}: ${new Date(access.renewsAt).toISOString()}${access.aiEnabled?'':` · ${t.disabled}`}\n${t.attempts}` : t.unknown;
}
export function initAI() {
  document.getElementById('ai-result-area')?.replaceChildren();
  const t=securityText(state.lang);
  let usage=document.getElementById('ai-usage');if(!usage){usage=document.createElement('p');usage.id='ai-usage';document.getElementById('ai-result-area')?.before(usage);}
  renderUsage();void refreshAccess().then(renderUsage);
  let privacy=document.getElementById('ai-privacy');if(!privacy){privacy=document.createElement('p');privacy.id='ai-privacy';usage.before(privacy);}
  privacy.replaceChildren(document.createTextNode(t.aiDisclaimer+' '));const policy=document.createElement('a');policy.href='https://groq.com/privacy-policy/';policy.target='_blank';policy.rel='noopener noreferrer';policy.textContent=t.providerPolicy;privacy.append(policy);
  const selector=document.getElementById('ai-period-container');
  if(selector){
    selector.replaceChildren();const label=document.createElement('label');label.textContent=PERIOD_LABELS[state.lang]||PERIOD_LABELS.en;label.htmlFor='ai-period';
    const select=document.createElement('select');select.id='ai-period';select.className='dv-input';
    const labels={en:['Last 7 days','Last 30 days','Last 90 days','All history'],uk:['Останні 7 днів','Останні 30 днів','Останні 90 днів','Уся історія'],ru:['Последние 7 дней','Последние 30 дней','Последние 90 дней','Вся история']}[state.lang]||[];
    ['7','30','90','all'].forEach((value,i)=>{const option=document.createElement('option');option.value=value;option.textContent=labels[i];option.selected=value===(localStorage.getItem('ambrosia_ai_period')||'30');select.append(option);});
    select.onchange=()=>localStorage.setItem('ambrosia_ai_period',select.value);selector.append(label,select);
  }
  const form=document.getElementById('dv-form');if(!form)return;form.replaceChildren();
  const date=document.createElement('input');date.id='dv-date';date.type='date';date.className='dv-input';date.setAttribute('aria-label',state.lang==='uk'?'Дата прийому':state.lang==='ru'?'Дата приёма':'Appointment date');
  const doctor=document.createElement('input');doctor.id='dv-doctor';doctor.maxLength=100;doctor.className='dv-input';doctor.placeholder=state.lang==='uk'?'Спеціальність лікаря':state.lang==='ru'?'Специальность врача':'Clinician specialty';
  const button=document.createElement('button');button.className='btn-primary';button.textContent=t.ai;button.onclick=()=>runAI('doctor_visit');form.append(date,doctor,button);
}
registerScreen('ai',initAI);
