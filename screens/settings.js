import { state, saveLang, clearAllData } from '../state.js';
import { applyLang } from '../i18n.js';
import { registerScreen } from '../navigation.js';
import { renderHome } from './home.js';
import { renderHistory } from './history.js';

// ─────────────────────────────────────────────
// RENDER SETTINGS / PROFILE
// ─────────────────────────────────────────────
export function renderSettings() {
  const totalSyms = state.entries.reduce((acc, e) => acc + e.symptoms.length, 0);
  const uniqueDays = new Set(state.entries.map(e => e.date)).size;

  const entriesEl = document.getElementById('stat-entries');
  const daysEl    = document.getElementById('stat-days');
  const symsEl    = document.getElementById('stat-syms');
  if (entriesEl) entriesEl.textContent = state.entries.length;
  if (daysEl)    daysEl.textContent    = uniqueDays;
  if (symsEl)    symsEl.textContent    = totalSyms;
}

// ─────────────────────────────────────────────
// LANGUAGE SWITCH
// ─────────────────────────────────────────────
export function setLang(lang) {
  state.lang = lang;
  saveLang();
  applyLang();
  // Re-render active screens that have translated text in the DOM
  if (state.screen === 'home')     renderHome();
  if (state.screen === 'history')  renderHistory();
  if (state.screen === 'settings') renderSettings();
}

// ─────────────────────────────────────────────
// DATA EXPORT
// Downloads entries as a JSON file
// ─────────────────────────────────────────────
export function exportData() {
  if (state.entries.length === 0) {
    alert('No data to export yet.');
    return;
  }
  const blob     = new Blob([JSON.stringify(state.entries, null, 2)], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `ambrosia-health-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// CLEAR ALL DATA
// ─────────────────────────────────────────────
export function clearData() {
  const confirmed = confirm('This will delete all your symptom history. Are you sure?');
  if (!confirmed) return;
  clearAllData();
  renderSettings();
  // Reset stats display
  const entriesEl = document.getElementById('stat-entries');
  const daysEl    = document.getElementById('stat-days');
  const symsEl    = document.getElementById('stat-syms');
  if (entriesEl) entriesEl.textContent = '0';
  if (daysEl)    daysEl.textContent    = '0';
  if (symsEl)    symsEl.textContent    = '0';
}

registerScreen('settings', renderSettings);
