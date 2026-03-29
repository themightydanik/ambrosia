import { SAMPLE_ENTRIES } from './data.js';

// ─────────────────────────────────────────────
// GLOBAL APP STATE
// ─────────────────────────────────────────────
export const state = {
  screen:       'onboarding',
  lang:         'en',
  // log flow
  logStep:      0,
  logCat:       null,
  logSymptoms:  [],
  logIntensity: 5,
  logTriggers:  [],
  // history filter
  historyFilter: null,
  // entries
  entries: []
};

// ─────────────────────────────────────────────
// PERSISTENCE (localStorage)
// ─────────────────────────────────────────────
export function loadState() {
  try {
    const savedEntries = localStorage.getItem('ambrosia_entries');
    if (savedEntries) {
      state.entries = JSON.parse(savedEntries);
    } else {
      // First launch: seed with sample data so the UI isn't empty
      state.entries = [...SAMPLE_ENTRIES];
    }
    const savedLang = localStorage.getItem('ambrosia_lang');
    if (savedLang) state.lang = savedLang;

    const seenOnboarding = localStorage.getItem('ambrosia_onboarding_done');
    if (seenOnboarding) state.screen = 'home';
  } catch (e) {
    console.warn('Could not load saved state:', e);
    state.entries = [...SAMPLE_ENTRIES];
  }
}

export function saveEntries() {
  try {
    localStorage.setItem('ambrosia_entries', JSON.stringify(state.entries));
  } catch (e) {
    console.warn('Could not save entries:', e);
  }
}

export function saveLang() {
  try {
    localStorage.setItem('ambrosia_lang', state.lang);
  } catch (e) {}
}

export function markOnboardingDone() {
  try {
    localStorage.setItem('ambrosia_onboarding_done', '1');
  } catch (e) {}
}

export function clearAllData() {
  try {
    localStorage.removeItem('ambrosia_entries');
    state.entries = [];
  } catch (e) {}
}
