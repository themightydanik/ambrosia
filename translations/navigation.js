import { state } from './state.js';
import { applyLang } from './i18n.js';

// ─────────────────────────────────────────────
// SCREEN RENDERER REGISTRY
// Each screen module calls registerScreen() to hook in.
// ─────────────────────────────────────────────
const _renderers = {};

export function registerScreen(name, renderFn) {
  _renderers[name] = renderFn;
}

// ─────────────────────────────────────────────
// NAVIGATE TO SCREEN
// ─────────────────────────────────────────────
export function goTo(screen) {
  // Animate out the current screen
  const prev = document.getElementById('screen-' + state.screen);
  if (prev) {
    prev.classList.add('slide-out');
    setTimeout(() => prev.classList.remove('active', 'slide-out'), 300);
  }

  state.screen = screen;

  // Animate in the next screen
  const next = document.getElementById('screen-' + screen);
  if (next) {
    setTimeout(() => next.classList.add('active'), 50);
  }

  // Update bottom nav highlight
  updateNav(screen);

  // Show/hide bottom nav
  const nav = document.getElementById('bottom-nav');
  const hideNav = screen === 'onboarding' || screen === 'log';
  if (nav) nav.classList.toggle('visible', !hideNav);

  // Call the screen's render function if registered
  if (_renderers[screen]) {
    _renderers[screen]();
  }

  applyLang();
}

// ─────────────────────────────────────────────
// UPDATE BOTTOM NAV ACTIVE STATE
// ─────────────────────────────────────────────
export function updateNav(screen) {
  ['home', 'history', 'ai', 'settings'].forEach(s => {
    const el = document.getElementById('nav-' + s);
    if (el) el.classList.toggle('active', s === screen);
  });
}
