import { markOnboardingDone } from '../state.js';
import { goTo } from '../navigation.js';

let _obStep = 0;

// ─────────────────────────────────────────────
// ADVANCE ONBOARDING STEP
// ─────────────────────────────────────────────
export function obNext() {
  if (_obStep < 2) {
    const current = document.getElementById('ob-slide-' + _obStep);
    if (current) current.classList.remove('active');

    _obStep++;

    const next = document.getElementById('ob-slide-' + _obStep);
    if (next) next.classList.add('active');

    // Update progress dots
    for (let i = 0; i <= 2; i++) {
      const d = document.getElementById('ob-d' + i);
      if (d) d.classList.toggle('active', i === _obStep);
    }

    // Last step: change button text
    const btn = document.getElementById('ob-next-btn');
    if (_obStep === 2 && btn) btn.textContent = 'Get Started';
  } else {
    startApp();
  }
}

// ─────────────────────────────────────────────
// SKIP / FINISH ONBOARDING → ENTER APP
// ─────────────────────────────────────────────
export function startApp() {
  markOnboardingDone();
  goTo('home');
}

window.obNext = obNext;
window.startApp = startApp;
