import { state } from './state.js';
import { applyLang } from './i18n.js';

const _renderers = {};

export function registerScreen(name, renderFn) {
  _renderers[name] = renderFn;
}

export function goTo(screen) {
  const prev = document.getElementById('screen-' + state.screen);
  if (prev) {
    prev.classList.add('slide-out');
    setTimeout(() => prev.classList.remove('active', 'slide-out'), 300);
  }

  state.screen = screen;

  const next = document.getElementById('screen-' + screen);
  if (next) {
    setTimeout(() => next.classList.add('active'), 50);
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
