import { state } from '../state.js';
import { t } from '../i18n.js';
import { SYMPTOM_COLORS } from '../data.js';
import { registerScreen } from '../navigation.js';
import { isLocked, showPaywall, getVisibleEntries } from '../premium.js';
import { entryCardHTML } from './home.js';

export function renderHistory() {
  renderFilterChips();
  renderEntryList();
}

function renderFilterChips() {
  const el = document.getElementById('history-filter');
  if (!el) return;

  // Only use main entries for building filter chips
  const mainEntries = state.entries.filter(e => !e.isUpdate);
  const allSymptoms = [...new Set(mainEntries.flatMap(e => e.symptoms))];
  if (allSymptoms.length === 0) { el.innerHTML = ''; return; }

  const allActive = !state.historyFilter;
  const allChip = `<div class="filter-chip ${allActive ? 'active' : ''}" onclick="historySetFilter(null)">${t('allFilter')}</div>`;

  const symChips = allSymptoms.map(s => {
    const isActive = state.historyFilter === s;
    const color    = SYMPTOM_COLORS[s] || '#888';
    const locked   = isLocked('filter');
    return `<div class="filter-chip ${isActive ? 'active' : ''}"
      onclick="${locked ? `showPaywall('filter')` : `historySetFilter('${s}')`}">
      <div class="filter-dot" style="background:${color}"></div>
      ${t(s)}${locked ? ' 🔒' : ''}
    </div>`;
  }).join('');

  el.innerHTML = allChip + symChips;
}

function renderEntryList() {
  const el = document.getElementById('history-list');
  if (!el) return;

  const mainEntries = state.entries.filter(e => !e.isUpdate);

  if (mainEntries.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${t('noEntries')}</div></div>`;
    return;
  }

  // Build update map: parentId → [update entries sorted by date]
  const updateMap = {};
  state.entries
    .filter(e => e.isUpdate && e.parentId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .forEach(u => {
      if (!updateMap[u.parentId]) updateMap[u.parentId] = [];
      updateMap[u.parentId].push(u);
    });

  // Apply date visibility limit for free users
  let visible = getVisibleEntries([...mainEntries].reverse());

  // Apply symptom filter
  if (state.historyFilter && !isLocked('filter')) {
    visible = visible.filter(e => e.symptoms.includes(state.historyFilter));
  }

  if (visible.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No entries found for this filter.</div></div>`;
    return;
  }

  const hiddenCount = mainEntries.length - visible.length;
  const lockedBanner = (!state.premium && hiddenCount > 0)
    ? `<div class="limit-banner" style="margin-bottom:12px">
        🔒 ${hiddenCount} older entr${hiddenCount === 1 ? 'y' : 'ies'} hidden (free plan shows last 14 days).
        <span onclick="showPaywall('filter')" style="color:var(--gold);cursor:pointer;font-weight:600"> Unlock all →</span>
      </div>` : '';

  el.innerHTML = lockedBanner + visible.map(e =>
    entryCardHTML(e, updateMap[e.id] || [])
  ).join('');
}

export function historySetFilter(symptom) {
  state.historyFilter = symptom;
  renderHistory();
}

registerScreen('history', renderHistory);
