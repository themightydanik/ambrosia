import { loadState, state } from './state.js';
import { applyLang } from './i18n.js';
import { goTo } from './navigation.js';

// Screen modules (each self-registers via registerScreen)
import { renderHome } from './screens/home.js';
import { renderHistory, historySetFilter } from './screens/history.js';
import { initLog, selectCat, toggleSym, updateIntensity, toggleTrig, logNextStep, saveLog } from './screens/log.js';
import { runAI, initAI } from './screens/ai.js';
import { renderSettings, setLang, exportData, clearData } from './screens/settings.js';
import { obNext, startApp } from './screens/onboarding.js';
import { renderUpgrade, handleUpgrade, redeemCode } from './screens/upgrade.js';
import { showPaywall } from './premium.js';

// ─────────────────────────────────────────────
// EXPOSE TO GLOBAL SCOPE (HTML onclick handlers)
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
window.redeemCode       = redeemCode;
window.showPaywall      = showPaywall;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  applyLang();
  if (state.screen === 'home') {
    const onb = document.getElementById('screen-onboarding');
    if (onb) onb.classList.remove('active');
    goTo('home');
  }
});
