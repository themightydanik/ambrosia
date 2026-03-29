import { state } from '../state.js';
import { t } from '../i18n.js';
import { SYMPTOM_COLORS } from '../data.js';
import { registerScreen } from '../navigation.js';
import { entryCardHTML } from './home.js';

// ─────────────────────────────────────────────
// RENDER HISTORY SCREEN
// ─────────────────────────────────────────────
export function renderHistory() {
  renderFilterChips();
  renderEntryList();
}

// ─────────────────────────────────────────────
// FILTER CHIPS — one per unique symptom in history
// ─────────────────────────────────────────────
function renderFilterChips() {
  const el = document.getElementById('history-filter');
  if (!el) return;

  // Collect all unique symptoms across all entries
  const allSymptoms = [...new Set(state.entries.flatMap(e => e.symptoms))];

  if (allSymptoms.length === 0) {
    el.innerHTML = '';
    return;
  }

  // "All" chip
  const allActive = !state.historyFilter;
  const allChip = `<div class="filter-chip ${allActive ? 'active' : ''}" onclick="historySetFilter(null)">
    ${t('allFilter')}
  </div>`;

  // Per-symptom chips
  const symChips = allSymptoms.map(s => {
    const isActive = state.historyFilter === s;
    const color = SYMPTOM_COLORS[s] || '#888';
    return `<div class="filter-chip ${isActive ? 'active' : ''}" onclick="historySetFilter('${s}')">
      <div class="filter-dot" style="background:${color}"></div>
      ${t(s)}
    </div>`;
  }).join('');

  el.innerHTML = allChip + symChips;
}

// ─────────────────────────────────────────────
// ENTRY LIST — filtered by selected symptom
// ─────────────────────────────────────────────
function renderEntryList() {
  const el = document.getElementById('history-list');
  if (!el) return;

  if (state.entries.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">${t('noEntries')}</div>
    </div>`;
    return;
  }

  // Apply filter
  let filtered = [...state.entries].reverse();
  if (state.historyFilter) {
    filtered = filtered.filter(e => e.symptoms.includes(state.historyFilter));
  }

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">No entries with this symptom yet.</div>
    </div>`;
    return;
  }

  el.innerHTML = filtered.map(e => entryCardHTML(e)).join('');
}

// ─────────────────────────────────────────────
// SET FILTER (called from onclick in HTML)
// ─────────────────────────────────────────────
export function historySetFilter(symptom) {
  state.historyFilter = symptom;
  renderHistory();
}

registerScreen('history', renderHistory);
