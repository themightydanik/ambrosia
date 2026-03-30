import { state } from '../state.js';
import { t } from '../i18n.js';
import { SYMPTOM_COLORS } from '../data.js';
import { registerScreen } from '../navigation.js';
import { isLocked, showPaywall, getVisibleEntries } from '../premium.js';
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

  const allSymptoms = [...new Set(state.entries.flatMap(e => e.symptoms))];
  if (allSymptoms.length === 0) { el.innerHTML = ''; return; }

  const allActive = !state.historyFilter;
  const allChip = `<div class="filter-chip ${allActive ? 'active' : ''}" onclick="historySetFilter(null)">${t('allFilter')}</div>`;

  const symChips = allSymptoms.map(s => {
    const isActive = state.historyFilter === s;
    const color = SYMPTOM_COLORS[s] || '#888';
    const locked = isLocked('filter');
    return `<div class="filter-chip ${isActive ? 'active' : ''} ${locked ? 'filter-chip--locked' : ''}"
      onclick="${locked ? `showPaywall('filter')` : `historySetFilter('${s}')`}">
      <div class="filter-dot" style="background:${color}"></div>
      ${t(s)}${locked ? ' 🔒' : ''}
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
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${t('noEntries')}</div></div>`;
    return;
  }

  // Apply date visibility limit for free users
  let visible = getVisibleEntries([...state.entries].reverse());

  // Apply symptom filter (only for premium)
  if (state.historyFilter && !isLocked('filter')) {
    visible = visible.filter(e => e.symptoms.includes(state.historyFilter));
  }

  if (visible.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No entries found for this filter.</div></div>`;
    return;
  }

  const hiddenCount = state.entries.length - visible.length;
  const lockedBanner = (!state.premium && hiddenCount > 0)
    ? `<div class="limit-banner" style="margin-bottom:12px">
        🔒 ${hiddenCount} older entr${hiddenCount === 1 ? 'y' : 'ies'} hidden (free plan shows last 14 days).
        <span onclick="showPaywall('filter')" style="color:var(--gold);cursor:pointer;font-weight:600"> Unlock all →</span>
      </div>`
    : '';

  el.innerHTML = lockedBanner + visible.map(e => entryCardHTML(e)).join('');
}

// ─────────────────────────────────────────────
// SET FILTER
// ─────────────────────────────────────────────
export function historySetFilter(symptom) {
  state.historyFilter = symptom;
  renderHistory();
}

registerScreen('history', renderHistory);
