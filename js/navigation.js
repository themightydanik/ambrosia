import { state } from './state.js';
import { applyLang } from './i18n.js';

const _renderers = {};

export function registerScreen(name, renderFn) {
  _renderers[name] = renderFn;
}

export function goTo(screen) {
  // Remove active from ALL screens first
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach(s => {
    s.classList.remove('active', 'slide-out');
  });

  state.screen = screen;

  // Activate target screen
  const next = document.getElementById('screen-' + screen);
  if (next) {
    // Force reflow to ensure clean transition
    void next.offsetHeight;
    next.classList.add('active');
  }

  updateNav(screen);

  const nav = document.getElementById('bottom-nav');
  const hideNav = screen === 'onboarding' || screen === 'log' || screen === 'upgrade';
  if (nav) nav.classList.toggle('visible', !hideNav);

  if (_renderers[screen]) {
    _renderers[screen]();
  }

  applyLang();
}

export function updateNav(screen) {
  ['home', 'history', 'ai', 'settings'].forEach(s => {
    const el = document.getElementById('nav-' + s);
    if (el) el.classList.toggle('active', s === screen);
  });
}
