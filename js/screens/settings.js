import { state, saveLang, clearAllData, activatePremium } from '../state.js';
import { applyLang } from '../i18n.js';
import { registerScreen, goTo } from '../navigation.js';
import { renderHome } from './home.js';
import { renderHistory } from './history.js';
import { isPremium } from '../premium.js';
import { PAYMENT_LINK, PROMO_CODES } from '../config.js';

// ─────────────────────────────────────────────
// RENDER SETTINGS / PROFILE
// ─────────────────────────────────────────────
export function renderSettings() {
  const totalSyms  = state.entries.reduce((acc, e) => acc + e.symptoms.length, 0);
  const uniqueDays = new Set(state.entries.map(e => e.date)).size;

  const entriesEl = document.getElementById('stat-entries');
  const daysEl    = document.getElementById('stat-days');
  const symsEl    = document.getElementById('stat-syms');
  if (entriesEl) entriesEl.textContent = state.entries.length;
  if (daysEl)    daysEl.textContent    = uniqueDays;
  if (symsEl)    symsEl.textContent    = totalSyms;

  // Premium badge
  const premBadgeEl = document.getElementById('set-premium-badge');
  if (premBadgeEl) {
    premBadgeEl.innerHTML = isPremium()
      ? `<div class="premium-status premium-status--active">✦ PREMIUM ACTIVE</div>`
      : `<div class="premium-status premium-status--free">
          Free plan · <span onclick="goTo('upgrade')" style="color:var(--gold);cursor:pointer;font-weight:600">Upgrade $2.5/mo →</span>
        </div>`;
  }
}

// ─────────────────────────────────────────────
// LANGUAGE SWITCH
// ─────────────────────────────────────────────
export function setLang(lang) {
  state.lang = lang;
  saveLang();
  applyLang();
  if (state.screen === 'home')     renderHome();
  if (state.screen === 'history')  renderHistory();
  if (state.screen === 'settings') renderSettings();
}

// ─────────────────────────────────────────────
// DATA EXPORT (premium only)
// ─────────────────────────────────────────────
export function exportData() {
  if (state.entries.length === 0) { alert('No data to export yet.'); return; }
  const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ambrosia-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// CLEAR DATA
// ─────────────────────────────────────────────
export function clearData() {
  if (!confirm('Delete all symptom history? This cannot be undone.')) return;
  clearAllData();
  renderSettings();
}

registerScreen('settings', renderSettings);
