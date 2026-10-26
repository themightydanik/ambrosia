let persistence;
export function setPersistence(adapter) { persistence = adapter; }
// ─────────────────────────────────────────────
// GLOBAL APP STATE
// ─────────────────────────────────────────────
export const state = {
  accountId: null,
  checkins: [],
  episodes: [],
  checkinDay: null,
  selectedEpisode: null,
  historyDay: null,
  logMode: 'quick',
  screen:        'onboarding',
  onboardingDone: false,
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
  recoveringPassword: false,
  upgradeReason: 'general',
  // User profile
  profile: {
    name:       '',
    age:        null,
    occupation: '',
    avatar:     '🌿'
  },
  // NEW: Gamification
  bonusPoints:   0,
  dailyStreak:   0,
  lastVisitDate: null  // YYYY-MM-DD format
};

// Avatar options для выбора
export const AVATAR_OPTIONS = [
  '🌿', '🍃', '🌱', '🌸', '🌺', '🌻', '🌼', '🌷',
  '🦋', '🐝', '🐛', '🦜', '🦚', '🦉', '🐢', '🐠',
  '⭐', '✨', '🌙', '☀️', '🌈', '🔥', '💧', '🌊'
];

export function loadState() {
  try {
    // Retire legacy client authority/credentials; journal and sync storage remain untouched.
    localStorage.removeItem('ambrosia_premium');
    localStorage.removeItem('ambrosia_groq_key');
    const savedEntries = localStorage.getItem('ambrosia_entries');
    if (savedEntries) {
      state.entries = JSON.parse(savedEntries);
    } else {
      state.entries = [];
    }
    
    const savedLang = localStorage.getItem('ambrosia_lang');
    if (savedLang) state.lang = savedLang;

    const seenOnboarding = localStorage.getItem('ambrosia_onboarding_done');
    state.onboardingDone = seenOnboarding === '1';
    if (state.onboardingDone) state.screen = 'home';

    // Load user profile
    const savedProfile = localStorage.getItem('ambrosia_profile');
    if (savedProfile) {
      state.profile = { ...state.profile, ...JSON.parse(savedProfile) };
    }

    // NEW: Load gamification data
    const savedPoints = localStorage.getItem('ambrosia_bonus_points');
    if (savedPoints) {
      state.bonusPoints = parseInt(savedPoints, 10);
    }

    const savedStreak = localStorage.getItem('ambrosia_daily_streak');
    if (savedStreak) {
      state.dailyStreak = parseInt(savedStreak, 10);
    }

    const savedLastVisit = localStorage.getItem('ambrosia_last_visit');
    if (savedLastVisit) {
      state.lastVisitDate = savedLastVisit;
    }

  } catch (e) {
    console.warn('Could not load saved state');
    state.entries = [];
  }
}

export function saveEntries() {
  if (persistence) return persistence.entries();
  try {
    localStorage.setItem('ambrosia_entries', JSON.stringify(state.entries));
  } catch (e) {
    console.warn('Could not save entries');
  }
}

export function saveLang() {
  if (persistence) return persistence.profile();
  try { localStorage.setItem('ambrosia_lang', state.lang); } catch (e) {}
}

export function markOnboardingDone() {
  state.onboardingDone = true;
  try { 
    localStorage.setItem('ambrosia_onboarding_done', '1');
    // NEW: Give 100 bonus points on first app launch
    if (state.bonusPoints === 0) {
      state.bonusPoints = 100;
      saveBonusPoints();
    }
  } catch (e) {}
}

export function saveProfile(profileData, expectedVersion) {
  if (persistence) { state.profile = { ...state.profile, ...profileData }; return persistence.profile(expectedVersion); }
  state.profile = { ...state.profile, ...profileData };
  try {
    localStorage.setItem('ambrosia_profile', JSON.stringify(state.profile));
  } catch (e) {
    console.warn('Could not save profile');
  }
}

// NEW: Gamification save functions
export function saveBonusPoints() {
  try {
    localStorage.setItem('ambrosia_bonus_points', state.bonusPoints.toString());
  } catch (e) {}
}

export function saveDailyStreak() {
  try {
    localStorage.setItem('ambrosia_daily_streak', state.dailyStreak.toString());
    localStorage.setItem('ambrosia_last_visit', state.lastVisitDate);
  } catch (e) {}
}

export function spendBonusPoints(amount) {
  if (state.bonusPoints >= amount) {
    state.bonusPoints -= amount;
    saveBonusPoints();
    return true;
  }
  return false;
}

export function addBonusPoints(amount) {
  state.bonusPoints += amount;
  saveBonusPoints();
}

export function clearAllData() {
  if (persistence) { if(persistence.clear)return persistence.clear();state.entries = []; return persistence.entries(); }
  try {
    localStorage.removeItem('ambrosia_entries');
    state.entries = [];
  } catch (e) {}
}
