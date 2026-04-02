// ─────────────────────────────────────────────
// ENTRY DETAIL MODAL
// Bottom sheet: view details, update status, delete
// ─────────────────────────────────────────────
import { state, saveEntries } from './state.js';
import { t } from './i18n.js';
import { SYMPTOM_COLORS, STATUS_COLORS } from './data.js';
import { renderHome } from './screens/home.js';
import { renderHistory } from './screens/history.js';

let _activeEntryId = null;
let _phase = 'detail'; // 'detail' | 'pickStatus'

// ─────────────────────────────────────────────
// OPEN MODAL
// ─────────────────────────────────────────────
export function openEntryModal(entryId) {
  _activeEntryId = entryId;
  _phase = 'detail';
  renderModal();
  document.getElementById('entry-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeEntryModal() {
  document.getElementById('entry-modal').classList.remove('active');
  document.body.style.overflow = '';
  _activeEntryId = null;
}

// ─────────────────────────────────────────────
// RENDER MODAL CONTENT
// ─────────────────────────────────────────────
function renderModal() {
  const body = document.getElementById('modal-body');
  if (!body) return;

  const entry = state.entries.find(e => e.id === _activeEntryId);
  if (!entry) { closeEntryModal(); return; }

  if (_phase === 'detail') {
    renderDetailPhase(body, entry);
  } else {
    renderStatusPhase(body, entry);
  }
}

function renderDetailPhase(body, entry) {
  const localeMap = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
  const locale    = localeMap[state.lang] || 'en-US';

  const date = new Date(entry.date + 'T12:00').toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const timeStr = entry.time ? ` · ${entry.time}` : '';

  const color = entry.intensity < 4 ? 'var(--mint)'
              : entry.intensity < 7 ? 'var(--gold)'
              : 'var(--coral)';

  const symsHTML = entry.symptoms.map(s =>
    `<div class="modal-chip">
      <div style="width:8px;height:8px;border-radius:50%;background:${SYMPTOM_COLORS[s]||'#888'}"></div>
      ${t(s)}
    </div>`
  ).join('');

  const trigsHTML = entry.triggers.length
    ? `<div class="modal-row">
        <div class="modal-label">Triggers</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${entry.triggers.map(tr => `<div class="trig-tag">⚡ ${t(tr)}</div>`).join('')}</div>
      </div>` : '';

  const notesHTML = entry.notes
    ? `<div class="modal-row">
        <div class="modal-label">Notes</div>
        <div class="modal-notes">"${entry.notes}"</div>
      </div>` : '';

  // Status label if this is an update entry
  const updateBadge = entry.isUpdate && entry.updateStatus
    ? `<div class="modal-update-badge" style="background:${STATUS_COLORS[entry.updateStatus]}20;border-color:${STATUS_COLORS[entry.updateStatus]}40;color:${STATUS_COLORS[entry.updateStatus]}">
        ↻ ${t('updateLabel')} · ${t('status' + cap(entry.updateStatus) + 'Short')}
      </div>` : '';

  body.innerHTML = `
    ${updateBadge}
    <div class="modal-row">
      <div class="modal-label">Date & Time</div>
      <div class="modal-value">${date}${timeStr}</div>
    </div>
    <div class="modal-row">
      <div class="modal-label">${t('intensityLabel')}</div>
      <div class="modal-value" style="color:${color}">${entry.intensity} / 10</div>
    </div>
    <div class="modal-row">
      <div class="modal-label">Symptoms</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${symsHTML}</div>
    </div>
    ${trigsHTML}
    ${notesHTML}

    <div class="modal-actions">
      <button class="modal-btn modal-btn--update" onclick="modalPickStatus()">
        ↻ ${t('modalUpdateBtn')}
      </button>
      <button class="modal-btn modal-btn--delete" onclick="modalDelete()">
        🗑 ${t('modalDeleteBtn')}
      </button>
      <button class="modal-btn modal-btn--close" onclick="closeEntryModal()">
        ${t('modalCloseBtn')}
      </button>
    </div>`;
}

function renderStatusPhase(body, entry) {
  const statusOptions = [
    { key: 'resolved', emoji: '✓', labelKey: 'statusResolved', color: STATUS_COLORS.resolved },
    { key: 'improved',  emoji: '↑', labelKey: 'statusImproved',  color: STATUS_COLORS.improved },
    { key: 'same',      emoji: '→', labelKey: 'statusSame',      color: STATUS_COLORS.same },
    { key: 'worse',     emoji: '↓', labelKey: 'statusWorse',     color: STATUS_COLORS.worse },
  ];

  body.innerHTML = `
    <div class="modal-status-title">${t('modalPickStatus')}</div>
    <div class="modal-status-grid">
      ${statusOptions.map(opt => `
        <button class="modal-status-btn" style="border-color:${opt.color}20"
          onclick="modalSaveStatus('${opt.key}')">
          <div class="modal-status-emoji" style="color:${opt.color}">${opt.emoji}</div>
          <div class="modal-status-label">${t(opt.labelKey)}</div>
        </button>`
      ).join('')}
    </div>
    <div class="modal-status-notes-wrap">
      <textarea class="notes-input" id="modal-update-notes" rows="2"
        placeholder="${t('updateNotesPlaceholder')}"
        style="height:70px;margin-top:12px"></textarea>
    </div>
    <div class="modal-actions">
      <button class="modal-btn modal-btn--close" onclick="modalBackToDetail()">← Back</button>
    </div>`;
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
export function modalPickStatus() {
  _phase = 'pickStatus';
  renderModal();
}

export function modalBackToDetail() {
  _phase = 'detail';
  renderModal();
}

export function modalSaveStatus(status) {
  const entry = state.entries.find(e => e.id === _activeEntryId);
  if (!entry) return;

  const notesEl = document.getElementById('modal-update-notes');
  const now     = new Date();
  const time    = now.toTimeString().slice(0, 5);

  // Create a new update entry linked to the original
  const updateEntry = {
    id:           Date.now(),
    date:         now.toISOString().split('T')[0],
    time,
    timestamp:    now.toISOString(),
    category:     entry.category,
    symptoms:     [...entry.symptoms],
    intensity:    entry.intensity,
    triggers:     [],
    notes:        notesEl ? notesEl.value.trim() : '',
    isUpdate:     true,
    parentId:     entry.id,
    updateStatus: status,
  };

  state.entries.push(updateEntry);
  saveEntries();

  closeEntryModal();

  // Re-render active screen
  if (state.screen === 'home')    renderHome();
  if (state.screen === 'history') renderHistory();

  // Show brief toast
  showToast(t('modalUpdateSaved'));
}

export function modalDelete() {
  if (!confirm(t('modalDeleteConfirm'))) return;

  // Remove the entry and any of its updates
  state.entries = state.entries.filter(e =>
    e.id !== _activeEntryId && e.parentId !== _activeEntryId
  );
  saveEntries();
  closeEntryModal();

  if (state.screen === 'home')    renderHome();
  if (state.screen === 'history') renderHistory();
}

// ─────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────
function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.getElementById('app').appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
