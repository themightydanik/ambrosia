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

  updateIntensityDisplay(5);
  renderCatGrid();
  renderTriggers();
  showLogStep(0);
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
    alert('Please select at least one symptom.');
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

export function saveLog() {
  if (!canLogEntry()) { showPaywall('entries'); return; }

  const notesEl = document.getElementById('log-notes');
  const now     = new Date();
  // Format time as HH:MM
  const time = now.toTimeString().slice(0, 5);

  const entry = {
    id:           Date.now(),
    date:         now.toISOString().split('T')[0],
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
  };

  state.entries.push(entry);
  saveEntries();
  goTo('home');
}

registerScreen('log', initLog);
