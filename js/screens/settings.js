import { state, saveLang, clearAllData, activatePremium, saveProfile, AVATAR_OPTIONS } from '../state.js';
import { applyLang, t } from '../i18n.js';
import { registerScreen, goTo } from '../navigation.js';
import { renderHome } from './home.js';
import { renderHistory } from './history.js';
import { isPremium } from '../premium.js';
import { PROMO_CODES } from '../config.js';

let _editingProfile = false;

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

  // Profile display
  renderProfileSection();

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

function renderProfileSection() {
  const el = document.getElementById('profile-section');
  if (!el) return;

  const { name, age, occupation, avatar } = state.profile;
  const displayName = name || t('profileNamePlaceholder');
  const displayAge = age ? `, ${age} ${t('yearsOld')}` : '';
  const displayOccupation = occupation || t('profileOccupationPlaceholder');

  if (_editingProfile) {
    el.innerHTML = `
      <div class="profile-edit-form">
        <div class="profile-avatar-selector">
          <div class="profile-avatar-current">${avatar}</div>
          <div class="avatar-grid" id="avatar-grid">
            ${AVATAR_OPTIONS.map(a => `
              <button class="avatar-option ${a === avatar ? 'selected' : ''}" 
                onclick="selectAvatar('${a}')">${a}</button>
            `).join('')}
          </div>
        </div>
        <div class="profile-edit-field">
          <label class="profile-edit-label">${t('profileName')}</label>
          <input type="text" id="profile-name-input" class="profile-edit-input" 
            value="${name}" placeholder="${t('profileNamePlaceholder')}">
        </div>
        <div class="profile-edit-field">
          <label class="profile-edit-label">${t('profileAge')}</label>
          <input type="number" id="profile-age-input" class="profile-edit-input" 
            value="${age || ''}" placeholder="25" min="1" max="120">
        </div>
        <div class="profile-edit-field">
          <label class="profile-edit-label">${t('profileOccupation')}</label>
          <input type="text" id="profile-occupation-input" class="profile-edit-input" 
            value="${occupation}" placeholder="${t('profileOccupationPlaceholder')}">
        </div>
        <div class="profile-edit-actions">
          <button class="btn-primary" onclick="saveProfileEdit()">${t('saveBtn')}</button>
          <button class="btn-ghost" onclick="cancelProfileEdit()">${t('cancelBtn')}</button>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="profile-display">
        <div class="profile-avatar">${avatar}</div>
        <div class="profile-name">${displayName}${displayAge}</div>
        <div class="profile-sub">${displayOccupation}</div>
        <button class="profile-edit-btn" onclick="editProfile()">✏️ ${t('editProfileBtn')}</button>
      </div>
    `;
  }
}

export function editProfile() {
  _editingProfile = true;
  renderProfileSection();
}

export function cancelProfileEdit() {
  _editingProfile = false;
  renderProfileSection();
}

export function selectAvatar(emoji) {
  state.profile.avatar = emoji;
  // Re-render to update selection
  renderProfileSection();
}

export function saveProfileEdit() {
  const nameInput = document.getElementById('profile-name-input');
  const ageInput = document.getElementById('profile-age-input');
  const occupationInput = document.getElementById('profile-occupation-input');

  saveProfile({
    name: nameInput ? nameInput.value.trim() : state.profile.name,
    age: ageInput ? parseInt(ageInput.value) || null : state.profile.age,
    occupation: occupationInput ? occupationInput.value.trim() : state.profile.occupation
  });

  _editingProfile = false;
  renderProfileSection();
  
  // Update home screen greeting
  if (state.screen === 'home') {
    renderHome();
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
