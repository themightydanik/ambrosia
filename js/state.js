import { SAMPLE_ENTRIES } from './data.js';

// ─────────────────────────────────────────────
// GLOBAL APP STATE
// ─────────────────────────────────────────────
export const state = {
  screen:        'onboarding',
  lang:          'en',
  // log flow
  logStep:       0,
  logCat:        null,
  logSymptoms:   [],
  logIntensity:  5,
  logTriggers:   [],
  // history filter
  historyFilter: null,
  // entries
  entries:       [],
  // monetization
  premium:       false,
  groqKey:       '',
  upgradeReason: 'general',
  // NEW: User profile
  profile: {
    name:       '',
    age:        null,
    occupation: '',
    avatar:     '🌿'  // Default avatar emoji
  }
};

// Avatar options для выбора
export const AVATAR_OPTIONS = [
  '🌿', '🍃', '🌱', '🌸', '🌺', '🌻', '🌼', '🌷',
  '🦋', '🐝', '🐛', '🦜', '🦚', '🦉', '🐢', '🐠',
  '⭐', '✨', '🌙', '☀️', '🌈', '🔥', '💧', '🌊'
];

export function loadState() {
  try {
    const savedEntries = localStorage.getItem('ambrosia_entries');
    if (savedEntries) {
      state.entries = JSON.parse(savedEntries);
    } else {
      state.entries = [...SAMPLE_ENTRIES];
    }
    const savedLang = localStorage.getItem('ambrosia_lang');
    if (savedLang) state.lang = savedLang;

    const seenOnboarding = localStorage.getItem('ambrosia_onboarding_done');
    if (seenOnboarding) state.screen = 'home';

    if (localStorage.getItem('ambrosia_premium') === '1') state.premium = true;
    const savedKey = localStorage.getItem('ambrosia_groq_key');
    if (savedKey) state.groqKey = savedKey;

    // NEW: Load user profile
    const savedProfile = localStorage.getItem('ambrosia_profile');
    if (savedProfile) {
      state.profile = { ...state.profile, ...JSON.parse(savedProfile) };
    }
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
  try { localStorage.setItem('ambrosia_lang', state.lang); } catch (e) {}
}

export function markOnboardingDone() {
  try { localStorage.setItem('ambrosia_onboarding_done', '1'); } catch (e) {}
}

export function activatePremium() {
  state.premium = true;
  try { localStorage.setItem('ambrosia_premium', '1'); } catch (e) {}
}

export function saveGroqKey(key) {
  state.groqKey = key;
  try { localStorage.setItem('ambrosia_groq_key', key); } catch (e) {}
}

// NEW: Save user profile
export function saveProfile(profileData) {
  state.profile = { ...state.profile, ...profileData };
  try {
    localStorage.setItem('ambrosia_profile', JSON.stringify(state.profile));
  } catch (e) {
    console.warn('Could not save profile:', e);
  }
}

export function clearAllData() {
  try {
    localStorage.removeItem('ambrosia_entries');
    state.entries = [];
  } catch (e) {}
}
