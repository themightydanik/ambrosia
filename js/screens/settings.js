import { state, saveLang, clearAllData, saveGroqKey, activatePremium } from '../state.js';
import { applyLang } from '../i18n.js';
import { registerScreen } from '../navigation.js';
import { renderHome } from './home.js';
import { renderHistory } from './history.js';
import { isPremium, FREE_ENTRY_LIMIT, FREE_HISTORY_DAYS } from '../premium.js';
import { goTo } from '../navigation.js';

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
    if (isPremium()) {
      premBadgeEl.innerHTML = `<div class="premium-status premium-status--active">✦ PREMIUM ACTIVE</div>`;
    } else {
      premBadgeEl.innerHTML = `<div class="premium-status premium-status--free">
        Free plan · <span onclick="goTo('upgrade')" style="color:var(--gold);cursor:pointer;font-weight:600">Upgrade $2.5/mo →</span>
      </div>`;
    }
  }

  // AI provider row
  const aiValEl = document.getElementById('set-ai-val');
  if (aiValEl) aiValEl.textContent = state.groqKey ? 'Groq (connected)' : 'Groq (key needed)';

  // Groq key input
  const groqInput = document.getElementById('groq-key-input');
  if (groqInput) groqInput.value = state.groqKey || '';
}

// ─────────────────────────────────────────────
// SAVE GROQ KEY FROM SETTINGS
// ─────────────────────────────────────────────
export function saveGroqKeyFromSettings() {
  const input = document.getElementById('groq-key-input');
  if (!input) return;
  const key = input.value.trim();
  saveGroqKey(key);
  const msg = document.getElementById('groq-key-msg');
  if (msg) {
    msg.style.color   = key ? 'var(--mint)' : 'var(--cream30)';
    msg.textContent   = key ? '✓ Key saved — AI features are now active.' : 'Key cleared.';
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3000);
  }
  renderSettings();
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
// DATA EXPORT
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
