import { T } from './data.js';
import { state } from './state.js';

// ─────────────────────────────────────────────
// TRANSLATION HELPER
// ─────────────────────────────────────────────
export function t(key) {
  const lang = T[state.lang] || T.en;
  return lang[key] ?? T.en[key] ?? key;
}

// ─────────────────────────────────────────────
// APPLY ALL LANGUAGE STRINGS TO DOM
// Call after any language change or screen transition
// ─────────────────────────────────────────────
export function applyLang() {
  // Map: elementId → translation key
  const map = {
    // nav
    'nav-l-home':  'navHome',
    'nav-l-hist':  'navHist',
    'nav-l-ai':    'navAI',
    'nav-l-set':   'navSet',
    // home
    'sl-overall':  'overallFeeling',
    'ht-today':    'todaySymptoms',
    'ht-log':      'logBtn',
    'ht-recent':   'recentEntries',
    'ht-all':      'seeAll',
    'chart-title': 'chartTitle',
    // log
    'log-screen-title': 'logTitle',
    'lst0':        'selectCat',
    'lst1':        'selectSymptoms',
    'lst2':        'overallIntensity',
    'lst2b':       'triggers',
    'lst3':        'addNotes',
    'il-mild':     'mild',
    'il-moderate': 'moderate',
    'il-severe':   'severe',
    'log-next1':   'nextBtn',
    'log-next2':   'nextBtn',
    'log-save-btn':'saveBtn',
    // history
    'hist-title':  'histTitle',
    'hist-sub':    'histSub',
    // ai
    'ai-tag':      'aiTag',
    'ai-btn1t':    'aiBt1',
    'ai-btn1d':    'aiBd1',
    'ai-btn2t':    'aiBt2',
    'ai-btn2d':    'aiBd2',
    'ai-btn3t':    'aiBt3',
    'ai-btn3d':    'aiBd3',
    'ai-btn4t':    'aiBt4',
    'ai-btn4d':    'aiBd4',
    // settings
    'set-title':       'setTitle',
    'set-lang-title':  'setLang',
    'set-pref-title':  'setPref',
    'set-data-title':  'setData',
    'set-notif':       'setNotif',
    'set-theme':       'setTheme',
    'set-export':      'setExport',
    'set-clear':       'setClear',
    'stat-lbl1':       'entries',
    'stat-lbl2':       'daysTracked',
    'stat-lbl3':       'symptoms',
  };

  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  // Textarea placeholder
  const notesEl = document.getElementById('log-notes');
  if (notesEl) notesEl.placeholder = t('notesPlaceholder');

  // Language buttons highlight
  ['en','ru','uk'].forEach(lang => {
    const btn = document.getElementById('lang-' + lang);
    if (btn) btn.classList.toggle('active', lang === state.lang);
  });
}
