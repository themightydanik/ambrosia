import {v} from './wellness/copy.js';
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
  const hideNav = screen === 'onboarding' || screen === 'log' || screen === 'upgrade' || screen === 'checkin' || screen === 'episode';
  if (nav) nav.classList.toggle('visible', !hideNav);

  if (_renderers[screen]) {
    _renderers[screen]();
  }

  applyLang();
  for(const [id,key]of [['nav-l-home','home'],['nav-l-hist','history'],['nav-l-ai','ai'],['nav-l-set','profile'],['product-disclaimer','notMedical'],['set-clear','clearJournal']]){const el=document.getElementById(id);if(el)el.textContent=v(key);}
  document.documentElement.lang=state.lang;
  document.getElementById('nav-log')?.setAttribute('aria-label',v('log'));
}

export function updateNav(screen) {
  ['home', 'history', 'ai', 'settings'].forEach(s => {
    const el = document.getElementById('nav-' + s);
    if (el) {el.classList.toggle('active',s===screen);if(s===screen)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
  });
}
