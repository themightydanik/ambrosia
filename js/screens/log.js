import {el,button,field} from '../wellness/dom.js';
import {v} from '../wellness/copy.js';
import {localDay,validDay} from '../wellness/model.js';
import { state, saveEntries } from '../state.js';
import { t } from '../i18n.js';
import { CATEGORIES, CAT_NAMES, TRIGGERS, TRIGGER_ICONS } from '../data.js';
import { registerScreen, goTo } from '../navigation.js';
import { canLogEntry, showPaywall } from '../premium.js';

const INTENSITY_DESC = {
  1:'i1', 2:'i2', 3:'i3', 4:'i4', 5:'i5',
  6:'i6', 7:'i7', 8:'i8', 9:'i9', 10:'i10'
};

export function initLog() {
  state.logStep      = 0;
  state.logCat       = null;
  state.logSymptoms  = [];
  state.logIntensity = 5;
  state.logTriggers  = [];

  const notesEl = document.getElementById('log-notes');
  if (notesEl) notesEl.value = '';

  const sliderEl = document.getElementById('intensity-slider');
  if (sliderEl) sliderEl.value = 5;

  const root=document.getElementById('screen-log');
  root.querySelector('#log-modes')?.remove();const modes=el('div',{id:'log-modes',class:'segmented'},button(v('quick'),()=>setLogMode('quick'),{'data-mode':'quick'}),button(v('advanced'),()=>setLogMode('advanced'),{'data-mode':'advanced'}));root.querySelector('.log-header').after(modes);
  root.querySelector('#log-extra')?.remove();
  const extra=el('details',{id:'log-extra'},el('summary',{},v('details'))),start=el('input',{type:'date',id:'symptom-start',value:localDay()}),end=el('input',{type:'date',id:'symptom-end'}),episode=el('select',{id:'symptom-episode'},el('option',{value:''},v('noEpisode')));for(const e of state.episodes)episode.append(el('option',{value:e.id},e.title));extra.append(field(v('start'),start),field(v('end'),end),field(v('episode'),episode));root.querySelector('#log-notes').before(extra);
  updateIntensityDisplay(5);
  renderCatGrid();
  renderTriggers();
  showLogStep(0);
  setLogMode(state.logMode||'quick');
}

export function showLogStep(n) {
  state.logStep = n;
  for (let i = 0; i <= 3; i++) {
    const el = document.getElementById('log-step-' + i);
    if (el) el.classList.toggle('active', i === n);
  }
  updateStepDots();
}

function updateStepDots() {
  for (let i = 0; i <= 3; i++) {
    const d = document.getElementById('lsd' + i);
    if (!d) continue;
    d.classList.remove('active', 'done');
    if (i < state.logStep)        d.classList.add('done');
    else if (i === state.logStep) d.classList.add('active');
  }
}

export function logNextStep(n) {
  if (n === 2 && state.logSymptoms.length === 0) {
    alert(v('selectSymptom'));
    return;
  }
  showLogStep(n);
}

function renderCatGrid() {
  const el = document.getElementById('cat-grid');
  if (!el) return;
  el.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
    <button class="cat-btn" id="cat-${key}" onclick="selectCat('${key}')">
      <span class="cat-icon">${cat.icon}</span>
      <div class="cat-name">${t(CAT_NAMES[key])}</div>
    </button>`
  ).join('');
}

export function selectCat(cat) {
  state.logCat      = cat;
  state.logSymptoms = [];
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  const cb = document.getElementById('cat-' + cat);
  if (cb) cb.classList.add('selected');
  renderSymptomList(cat);
  setTimeout(() => showLogStep(1), 180);
}

function renderSymptomList(cat) {
  const el = document.getElementById('symptom-list');
  if (!el) return;
  const symptoms = CATEGORIES[cat]?.symptoms || [];
  el.innerHTML = symptoms.map(s => `
    <button class="sym-btn" id="sym-${s}" onclick="toggleSym('${s}')">
      ${t(s)} <span class="sym-check">✓</span>
    </button>`
  ).join('');
}

export function toggleSym(s) {
  const idx = state.logSymptoms.indexOf(s);
  if (idx > -1) state.logSymptoms.splice(idx, 1);
  else          state.logSymptoms.push(s);
  const btn = document.getElementById('sym-' + s);
  if (btn) btn.classList.toggle('selected', state.logSymptoms.includes(s));
}

function renderTriggers() {
  const el = document.getElementById('trigger-grid');
  if (!el) return;
  el.innerHTML = TRIGGERS.map(tr => `
    <button class="trig-btn" id="trig-${tr}" onclick="toggleTrig('${tr}')">
      ${TRIGGER_ICONS[tr] || '•'} ${t(tr)}
    </button>`
  ).join('');
}

export function toggleTrig(tr) {
  const idx = state.logTriggers.indexOf(tr);
  if (idx > -1) state.logTriggers.splice(idx, 1);
  else          state.logTriggers.push(tr);
  const btn = document.getElementById('trig-' + tr);
  if (btn) btn.classList.toggle('selected', state.logTriggers.includes(tr));
}

export function updateIntensity(v) {
  state.logIntensity = parseInt(v, 10);
  updateIntensityDisplay(v);
}

function updateIntensityDisplay(v) {
  const displayEl = document.getElementById('intensity-display');
  const descEl    = document.getElementById('intensity-desc-label');
  const sliderEl  = document.getElementById('intensity-slider');
  if (displayEl) displayEl.textContent = v;
  if (descEl)    descEl.textContent    = t(INTENSITY_DESC[v] || 'i5');
  if (sliderEl)  sliderEl.value        = v;
}

export function setLogMode(mode){state.logMode=mode;const root=document.getElementById('screen-log');root.classList.toggle('log-mode-quick',mode==='quick');root.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
window.setLogMode=setLogMode;
export function saveLog() {
  if(!state.logCat||!state.logSymptoms.length){alert(v('selectSymptom'));return;}
  const start=document.getElementById('symptom-start').value,end=document.getElementById('symptom-end').value;
  if(!validDay(start)||end&&(!validDay(end)||end<start)){alert(v('episodeInvalid'));return;}
  if (!canLogEntry()) { showPaywall('entries'); return; }

  const notesEl = document.getElementById('log-notes');
  const now     = new Date();
  // Format time as HH:MM
  const time = now.toTimeString().slice(0, 5);

  const entry = {
    id:           crypto.randomUUID(),
    date:         `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
    time,
    timestamp:    now.toISOString(),
    category:     state.logCat,
    symptoms:     [...state.logSymptoms],
    intensity:    state.logIntensity,
    triggers:     [...state.logTriggers],
    notes:        notesEl ? notesEl.value.trim() : '',
    isUpdate:     false,
    parentId:     null,
    updateStatus: null,
    statusUpdates: [],
    symptomStart:start,symptomEnd:end||null,episodeId:document.getElementById('symptom-episode').value||null,
    // NEW: Auto-enable critical tracking for high intensity symptoms
    criticalTracking: state.logIntensity >= 7
  };

  state.entries.push(entry);
  saveEntries();
  goTo('home');
}

registerScreen('log', initLog);
