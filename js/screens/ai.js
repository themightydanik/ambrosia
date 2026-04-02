import { state } from '../state.js';
import { registerScreen } from '../navigation.js';
import { isLocked, showPaywall } from '../premium.js';
import { AI_PROXY_URL } from '../config.js';
import { t } from '../i18n.js';

async function callAI(prompt) {
  if (!AI_PROXY_URL) throw new Error('NO_PROXY');
  const res = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'AI error');
  return data.text;
}

export function buildHistoryText() {
  const mainEntries = state.entries.filter(e => !e.isUpdate);
  if (mainEntries.length === 0) return 'No symptom entries recorded yet.';

  const updateMap = {};
  state.entries.filter(e => e.isUpdate && e.parentId).forEach(u => {
    if (!updateMap[u.parentId]) updateMap[u.parentId] = [];
    updateMap[u.parentId].push(u);
  });

  return [...mainEntries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      let line = `Date: ${e.date}${e.time ? ' ' + e.time : ''} | Symptoms: ${e.symptoms.join(', ')} | Intensity: ${e.intensity}/10`;
      if (e.triggers.length) line += ` | Triggers: ${e.triggers.join(', ')}`;
      if (e.notes) line += ` | Notes: "${e.notes}"`;
      const updates = updateMap[e.id] || [];
      if (updates.length) {
        line += ' | Status updates: ' + updates.map(u => `${u.date} → ${u.updateStatus}`).join(', ');
      }
      return line;
    }).join('\n');
}

const PROMPTS = {
  analyze: h =>
    `You are a health analysis AI (NOT a doctor). User symptom history:\n\n${h}\n\n` +
    `Analyze the pattern. Identify the most likely general condition. Note progression trends ` +
    `and most concerning symptoms. Friendly language, brief summary first then details. ` +
    `Under 300 words. Remind them to see a real doctor.`,

  correlations: h =>
    `You are a health data analyst. User symptom history:\n\n${h}\n\n` +
    `Find 3-4 meaningful correlations: what appears together, what worsens over time, ` +
    `which triggers seem linked. Numbered list. Under 250 words.`,

  report: h =>
    `Generate a structured medical summary for a patient to show their doctor.\n\n` +
    `Symptom history:\n${h}\n\n` +
    `Sections:\n1. Timeline Summary\n2. Primary Symptoms & Progression\n` +
    `3. Intensity Trends\n4. Identified Triggers\n5. Key Points for the Doctor\n\n` +
    `Professional tone. Under 350 words.`,

  recommend: h =>
    `You are a health guidance AI. Symptom history:\n\n${h}\n\n` +
    `Provide:\n1. 2-3 immediate self-care actions\n2. Which type of doctor to see and when\n` +
    `3. Warning signs requiring urgent care\n4. Helpful lifestyle adjustments\n\n` +
    `Practical and specific. Under 300 words. Emphasize consulting a real doctor.`,

  doctor_visit: (h, appointmentDate, doctorType) =>
    `You are preparing a patient for a medical appointment on ${appointmentDate} with a ${doctorType}.\n\n` +
    `Their symptom history:\n${h}\n\n` +
    `Create a structured pre-appointment briefing:\n` +
    `1. CHIEF COMPLAINT (1-2 sentences)\n2. SYMPTOM TIMELINE (chronological)\n` +
    `3. TOP 3 CONCERNS TO DISCUSS\n4. QUESTIONS TO ASK THE DOCTOR (5 specific questions)\n` +
    `5. RELEVANT CONTEXT (triggers, patterns, status updates)\n\n` +
    `Clear, doctor-friendly. Under 400 words.`
};

const UI = {
  analyze:      { label: '🔬 AI ANALYSIS',     loading: 'Analyzing your symptom patterns...' },
  correlations: { label: '🔗 CORRELATIONS',    loading: 'Finding hidden connections...' },
  report:       { label: '📋 DOCTOR REPORT',   loading: 'Generating your health report...' },
  recommend:    { label: '💊 RECOMMENDATIONS', loading: 'Building recommendations...' },
  doctor_visit: { label: '🏥 VISIT BRIEFING',  loading: 'Preparing your appointment briefing...' }
};

export async function runAI(type) {
  if (isLocked('ai')) { showPaywall(type); return; }

  const area = document.getElementById('ai-result-area');
  if (!area) return;
  const ui = UI[type] || UI.analyze;

  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">${ui.label}</div>
    <div class="ai-loading"><div class="ai-spinner"></div>${ui.loading}</div>
  </div>`;

  try {
    const history = buildHistoryText();
    let text, apptDate, docType;

    if (type === 'doctor_visit') {
      apptDate = document.getElementById('dv-date')?.value || 'upcoming appointment';
      docType  = document.getElementById('dv-doctor')?.value || 'General Practitioner';
      text = await callAI(PROMPTS.doctor_visit(history, apptDate, docType));
      renderDoctorVisitResult(area, text, apptDate, docType);
      return;
    }

    text = await callAI(PROMPTS[type](history));
    if (type === 'report') { renderReport(area, text); return; }

    area.innerHTML = `<div class="ai-result-box">
      <div class="ai-result-label">${ui.label}</div>
      <div class="ai-result-content">${text}</div>
    </div>`;

  } catch (err) {
    const isNoProxy = err.message === 'NO_PROXY';
    area.innerHTML = `<div class="ai-result-box">
      <div class="ai-result-label" style="color:var(--gold)">
        ${isNoProxy ? '⚙️ AI COMING SOON' : '⚠️ ERROR'}
      </div>
      <div class="ai-result-content" style="color:var(--cream60)">
        ${isNoProxy ? 'AI features are being configured. Check back soon!' : `Could not reach AI.\n\n${err.message}`}
      </div>
    </div>`;
  }
}

function renderReport(area, text) {
  const today = new Date().toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' });
  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">📋 DOCTOR REPORT</div>
    <div class="report-meta">
      <div><div class="report-meta-label">Generated</div><div class="report-meta-value">${today}</div></div>
      <div><div class="report-meta-label">Entries</div><div class="report-meta-value">${state.entries.filter(e=>!e.isUpdate).length}</div></div>
      <div><div class="report-meta-label">Powered by</div><div class="report-meta-value">Groq AI</div></div>
    </div>
    <div class="ai-result-content">${text}</div>
    <div style="margin-top:16px;font-size:12px;color:var(--coral);font-style:italic">
      ⚠️ For informational purposes only. Always consult a qualified medical professional.
    </div>
  </div>`;
}

function renderDoctorVisitResult(area, text, apptDate, docType) {
  area.innerHTML = `<div class="ai-result-box">
    <div class="ai-result-label">🏥 APPOINTMENT BRIEFING</div>
    <div class="report-meta">
      <div><div class="report-meta-label">Appointment</div><div class="report-meta-value">${apptDate}</div></div>
      <div><div class="report-meta-label">Doctor</div><div class="report-meta-value">${docType}</div></div>
    </div>
    <div class="ai-result-content">${text}</div>
    <div style="margin-top:16px;padding:14px 16px;background:var(--mint-dim);border-radius:var(--r-sm);display:flex;gap:10px;align-items:center">
      <div style="font-size:20px">💡</div>
      <div style="font-size:13px;color:var(--cream60)">Show this briefing to your doctor at the start of your appointment.</div>
    </div>
  </div>`;
}

export function initAI() {
  const area = document.getElementById('ai-result-area');
  if (area) area.innerHTML = '';

  const dvForm = document.getElementById('dv-form');
  if (!dvForm) return;

  const locked = isLocked('ai');
  const today  = new Date().toISOString().split('T')[0];

  dvForm.innerHTML = `
    <div class="dv-row">
      <div class="dv-field">
        <div class="dv-label" id="dv-date-label">${t('dvDateLabel')}</div>
        <input type="date" id="dv-date" class="dv-input" value="${today}" min="${today}">
      </div>
      <div class="dv-field">
        <div class="dv-label" id="dv-doctor-label">${t('dvDoctorLabel')}</div>
        <select id="dv-doctor" class="dv-input">
          <option>General Practitioner</option>
          <option>ENT Specialist</option>
          <option>Cardiologist</option>
          <option>Gastroenterologist</option>
          <option>Neurologist</option>
          <option>Dermatologist</option>
          <option>Pulmonologist</option>
          <option>Psychiatrist / Therapist</option>
          <option>Orthopedist</option>
          <option>Other Specialist</option>
        </select>
      </div>
    </div>
    <button class="dv-btn ${locked ? 'dv-btn--locked' : ''}"
      onclick="${locked ? "showPaywall('doctor_visit')" : "runAI('doctor_visit')"}">
      ${locked ? t('dvBtnLocked') : t('dvBtnUnlocked')}
    </button>`;
}

registerScreen('ai', initAI);
