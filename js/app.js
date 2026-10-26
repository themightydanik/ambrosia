import {isAndroid} from './platform.js';
import {initializeNativeBilling} from './billing/client.js';
import './companion/ui.js';
import { renderOnboarding } from './screens/onboarding.js';
import { registerScreen } from './navigation.js';
import './screens/checkin.js';
import './screens/episode.js';
import {v} from './wellness/copy.js';
registerScreen('onboarding',renderOnboarding);
import { initializeSync } from './sync/runtime.js';
import { loadState, state } from './state.js';
import { applyLang } from './i18n.js';
import { goTo } from './navigation.js';

import { renderHome } from './screens/home.js';
import { renderHistory, historySetFilter } from './screens/history.js';
import { initLog, selectCat, toggleSym, updateIntensity, toggleTrig, logNextStep, saveLog } from './screens/log.js';
import { runAI, initAI } from './screens/ai.js';
import { 
  renderSettings, refreshSettingsData, setLang, exportData, clearData,
  editProfile, cancelProfileEdit, selectAvatar, saveProfileEdit
} from './screens/settings.js';
import { obNext, startApp } from './screens/onboarding.js';
import { renderUpgrade, handleUpgrade } from './screens/upgrade.js';
import { showPaywall } from './premium.js';
import {
  openEntryModal, closeEntryModal,
  modalPickStatus, modalBackToDetail, modalSaveStatus, modalDelete,
  disableCriticalTracking
} from './modal.js';

// ─────────────────────────────────────────────
// GLOBAL SCOPE (HTML onclick handlers)
// ─────────────────────────────────────────────
window.goTo             = goTo;
window.obNext           = obNext;
window.startApp         = startApp;
window.selectCat        = selectCat;
window.toggleSym        = toggleSym;
window.updateIntensity  = updateIntensity;
window.toggleTrig       = toggleTrig;
window.logNextStep      = logNextStep;
window.saveLog          = saveLog;
window.runAI            = runAI;
window.setLang          = setLang;
window.exportData       = exportData;
window.clearData        = clearData;
window.historySetFilter = historySetFilter;
window.handleUpgrade    = handleUpgrade;
window.showPaywall      = showPaywall;
// Modal
window.openEntryModal   = openEntryModal;
window.closeEntryModal  = closeEntryModal;
window.modalPickStatus  = modalPickStatus;
window.modalBackToDetail = modalBackToDetail;
window.modalSaveStatus  = modalSaveStatus;
window.modalDelete      = modalDelete;
window.disableCriticalTracking = disableCriticalTracking;
// Profile functions
window.editProfile      = editProfile;
window.cancelProfileEdit = cancelProfileEdit;
window.selectAvatar     = selectAvatar;
window.saveProfileEdit  = saveProfileEdit;

window.addEventListener('access-changed', () => {
  if (state.screen === 'settings') refreshSettingsData();
  if (state.screen === 'upgrade') renderUpgrade();
});
window.addEventListener('password-recovery', () => goTo('settings'));
window.addEventListener('journal-changed', event => {
  applyLang();
  if (event.detail.accountChanged) {
    cancelProfileEdit();
    closeEntryModal();
    goTo(state.screen === 'onboarding' ? 'onboarding' : 'settings');
  } else if (['checkin','episode','log','ai'].includes(state.screen)) { /* preserve form drafts */ }
  else if (state.screen === 'settings') refreshSettingsData();
  else if (state.screen !== 'log') goTo(state.screen);
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  await initializeSync();
  void initializeNativeBilling().catch(()=>{});
  if (!isAndroid() && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  applyLang();

  // Navigate to correct screen after brief delay to avoid race conditions
setTimeout(() => {
  if (!state.onboardingDone) {
    goTo('onboarding');
  } else {
    goTo(state.screen || 'home');
  }
}, 50);

  // Close modal on overlay click
  const modal = document.getElementById('entry-modal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeEntryModal();
    });
  }
});
