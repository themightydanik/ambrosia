import { state, saveDailyStreak, addBonusPoints } from '../state.js';
import { escapeHTML } from '../utils/escape.js';
import { t } from '../i18n.js';
import { SYMPTOM_COLORS, STATUS_COLORS } from '../data.js';
import { registerScreen } from '../navigation.js';

// [entryCardHTML и все другие функции остаются без изменений]
export function entryCardHTML(entry, updates = []) {
  const localeMap = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
  const locale    = localeMap[state.lang] || 'en-US';

  const date = new Date(entry.date + 'T12:00').toLocaleDateString(locale, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
  const timeStr = entry.time ? ` · ${escapeHTML(entry.time)}` : '';

  const color = entry.intensity < 4 ? 'var(--mint)'
              : entry.intensity < 7 ? 'var(--gold)'
              : 'var(--coral)';

  const symsHTML = entry.symptoms
    .map(s => `<div class="entry-chip">
      <div class="entry-chip-dot" style="background:${SYMPTOM_COLORS[s] || '#888'}"></div>${escapeHTML(t(s))}
    </div>`).join('');

  const trigsHTML = entry.triggers.length
    ? `<div class="entry-triggers">${entry.triggers.map(tr => `<div class="trig-tag">⚡ ${escapeHTML(t(tr))}</div>`).join('')}</div>`
    : '';

  const notesHTML = entry.notes
    ? `<div class="entry-notes">"${escapeHTML(entry.notes)}"</div>` : '';

  const statusHistory = entry.statusUpdates || [];
  const updatesHTML = statusHistory.length
    ? `<div class="entry-timeline">
        ${statusHistory.map(u => {
          const uDate = new Date(u.date + 'T12:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' });
          const uTime = u.time ? ` · ${escapeHTML(u.time)}` : '';
          const statusColor = STATUS_COLORS[u.status] || '#888';
          const statusKey   = 'status' + u.status.charAt(0).toUpperCase() + u.status.slice(1) + 'Short';
          return `<div class="entry-timeline-item">
            <div class="entry-timeline-dot" style="background:${statusColor}"></div>
            <div class="entry-timeline-text">
              <span class="entry-timeline-date">${uDate}${uTime}</span>
              <span class="entry-timeline-status" style="color:${statusColor}">${escapeHTML(t(statusKey))}</span>
              ${u.notes ? `<span class="entry-timeline-note">"${escapeHTML(u.notes)}"</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>` : '';

  const criticalIndicator = entry.criticalTracking
    ? `<div class="critical-indicator" title="${t('criticalTrackingActive')}">
        <div class="critical-pulse"></div>
      </div>` : '';

  if (entry.isUpdate) {
    const statusColor = STATUS_COLORS[entry.updateStatus] || '#888';
    const statusKey   = 'status' + entry.updateStatus.charAt(0).toUpperCase() + entry.updateStatus.slice(1) + 'Short';
    return `<div class="entry-card entry-card--update" onclick="openEntryModal(${escapeHTML(JSON.stringify(entry.id))})">
      <div class="entry-date-bar">
        <div class="entry-date-text">
          <span class="update-badge">↻ ${t('updateLabel')}</span>
          ${date}${timeStr}
        </div>
        <div style="color:${statusColor};font-size:13px;font-weight:600">${escapeHTML(t(statusKey))}</div>
      </div>
      <div class="entry-body">
        <div class="entry-symptoms">${symsHTML}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <div class="intensity-mini-bar" style="background:${color}"></div>
          <span style="font-size:12px;color:var(--cream60)">${t('intensityLabel')} ${escapeHTML(entry.intensity)}/10</span>
        </div>
        ${notesHTML}
      </div>
    </div>`;
  }

  return `<div class="entry-card" onclick="openEntryModal(${escapeHTML(JSON.stringify(entry.id))})">
    <div class="entry-date-bar">
      <div class="entry-date-text">${date}${timeStr}</div>
      <div style="display:flex;align-items:center;gap:8px">
        ${criticalIndicator}
        <div class="entry-severity" style="color:${color}">${t('intensityLabel')} ${escapeHTML(entry.intensity)}/10</div>
      </div>
    </div>
    <div class="entry-body">
      <div class="entry-symptoms">${symsHTML}</div>
      ${trigsHTML}${notesHTML}
      ${updatesHTML}
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// DAILY STREAK LOGIC
// ─────────────────────────────────────────────
function checkDailyStreak() {
  const today = new Date().toISOString().split('T')[0];
  const lastVisit = state.lastVisitDate;

  // First time ever opening the app
  if (!lastVisit) {
    state.lastVisitDate = today;
    state.dailyStreak = 1;
    saveDailyStreak();
    showDailyStreakModal(1, 10);
    return;
  }

  // Already visited today
  if (lastVisit === today) {
    return;
  }

  // Calculate days difference
  const lastDate = new Date(lastVisit + 'T12:00');
  const todayDate = new Date(today + 'T12:00');
  const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    state.dailyStreak++;
    state.lastVisitDate = today;
    
    // Calculate reward
    let reward = 10;
    if (state.dailyStreak === 7) {
      reward = 100; // Bonus on 7th day
    } else if (state.dailyStreak % 7 === 0) {
      reward = 100; // Bonus every 7 days
    }
    
    addBonusPoints(reward);
    saveDailyStreak();
    showDailyStreakModal(state.dailyStreak, reward);
  } else {
    // Streak broken
    state.dailyStreak = 1;
    state.lastVisitDate = today;
    saveDailyStreak();
    addBonusPoints(10);
    showDailyStreakModal(1, 10, true); // Show "streak broken" message
  }
}

function showDailyStreakModal(streak, reward, broken = false) {
  const modal = document.createElement('div');
  modal.className = 'daily-streak-overlay';
  modal.id = 'daily-streak-modal';

  const isWeekMilestone = streak % 7 === 0 && streak > 0;
  const emoji = isWeekMilestone ? '🎉' : broken ? '💔' : '🔥';
  const title = broken 
    ? t('streakBroken')
    : isWeekMilestone 
      ? t('streakWeekMilestone')
      : t('streakContinues');
  
  const message = broken
    ? t('streakBrokenMsg')
    : isWeekMilestone
      ? t('streakWeekMsg').replace('{streak}', streak)
      : t('streakMsg').replace('{streak}', streak);

  modal.innerHTML = `
    <div class="daily-streak-box">
      <div class="daily-streak-icon">${emoji}</div>
      <div class="daily-streak-title">${title}</div>
      <div class="daily-streak-message">${message}</div>
      
      <div class="daily-streak-reward">
        <div class="streak-reward-label">${t('rewardEarned')}</div>
        <div class="streak-reward-value">+${reward} ${t('bonusPoints')}</div>
      </div>
      
      <div class="daily-streak-progress">
        <div class="streak-progress-label">${t('currentStreak')}</div>
        <div class="streak-progress-bar">
          ${Array.from({length: 7}, (_, i) => {
            const dayNum = (streak - 1) % 7;
            const filled = i <= dayNum;
            return `<div class="streak-day ${filled ? 'filled' : ''}">${i + 1}</div>`;
          }).join('')}
        </div>
        <div class="streak-progress-text">${streak} ${t('daysStreak')}</div>
      </div>

      <button class="btn-primary" onclick="closeDailyStreakModal()">
        ${t('awesome')}
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('visible'), 50);
}

window.closeDailyStreakModal = function() {
  const modal = document.getElementById('daily-streak-modal');
  if (modal) {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 300);
  }
};

// ─────────────────────────────────────────────
// RENDER HOME SCREEN
// ─────────────────────────────────────────────
export function renderHome() {
  checkDailyStreak(); // Check on every home screen render
  renderGreeting();
  renderProfileHeader();
  renderStatusCard();
  renderTodayChips();
  renderMiniChart();
  renderRecentEntries();
  renderAIInsight();
}

function renderGreeting() {
  const h       = new Date().getHours();
  const greetKey = h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening';
  const greetEl  = document.getElementById('home-greeting');
  
  const userName = state.profile.name || '';
  const greetText = userName 
    ? `${t(greetKey)}, ${userName}` 
    : t(greetKey);
  
  if (greetEl) greetEl.textContent = greetText;

  const localeMap = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
  const dateEl = document.getElementById('home-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString(
    localeMap[state.lang] || 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );
}

function renderProfileHeader() {
  const el = document.getElementById('home-profile-header');
  if (!el) return;

  const { avatar } = state.profile;
  const points = state.bonusPoints;
  
  el.innerHTML = `
    <div class="home-profile-section">
      <div class="home-bonus-points" title="${t('bonusPoints')}">
        ⭐ ${points}
      </div>
      <div class="home-profile-avatar" onclick="goTo('settings')">
        ${escapeHTML(avatar)}
      </div>
    </div>
  `;
}

function renderStatusCard() {
  const today       = new Date().toISOString().split('T')[0];
  const todayEntries = state.entries.filter(e => e.date === today && !e.isUpdate);
  const feelingEl   = document.getElementById('home-feeling');
  const scoreEl     = document.getElementById('home-score');

  if (todayEntries.length === 0) {
    if (feelingEl) feelingEl.textContent = t('feeling1');
    if (scoreEl)   scoreEl.textContent   = 'Score — / 10';
    return;
  }
  const maxInt = Math.max(...todayEntries.map(e => e.intensity));
  if (feelingEl) feelingEl.textContent = t('feeling' + Math.round(maxInt)) || t('feeling5');
  if (scoreEl)   scoreEl.textContent   = `Score ${maxInt} / 10`;
}

function renderTodayChips() {
  const today   = new Date().toISOString().split('T')[0];
  const entries = state.entries.filter(e => e.date === today && !e.isUpdate);
  const el      = document.getElementById('today-chips');
  if (!el) return;

  if (entries.length === 0) {
    el.innerHTML = `<div style="padding:12px 0;font-size:14px;color:var(--cream30)">${t('noSymptoms')}</div>`;
    return;
  }
  const unique = [...new Set(entries.flatMap(e => e.symptoms))];
  el.innerHTML = unique.slice(0, 6).map(s =>
    `<div class="chip"><div class="chip-dot" style="background:${SYMPTOM_COLORS[s] || '#D4A853'}"></div>${escapeHTML(t(s))}</div>`
  ).join('');
}

function renderMiniChart() {
  const el = document.getElementById('home-chart');
  if (!el) return;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return d.toISOString().split('T')[0];
  });
  el.innerHTML = days.map(day => {
    const dayEntries = state.entries.filter(e => e.date === day && !e.isUpdate);
    const intensity  = dayEntries.length ? Math.max(...dayEntries.map(e => e.intensity)) : 0;
    const pct   = (intensity / 10) * 100;
    const color = intensity < 4 ? 'var(--mint)' : intensity < 7 ? 'var(--gold)' : 'var(--coral)';
    const label = new Date(day + 'T12:00').toLocaleDateString('en', { weekday: 'narrow' });
    return `<div class="chart-bar-wrap">
      <div class="chart-bar" style="background:${intensity ? color : 'var(--cream15)'};height:${Math.max(pct, 4)}%"></div>
      <div class="chart-bar-label">${label}</div>
    </div>`;
  }).join('');
}

function renderRecentEntries() {
  const el = document.getElementById('home-recent');
  if (!el) return;
  const recent = [...state.entries].filter(e => !e.isUpdate).reverse().slice(0, 2);
  el.innerHTML = recent.length
    ? recent.map(e => entryCardHTML(e)).join('')
    : `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${t('noEntries')}</div></div>`;
}

function renderAIInsight() {
  const el=document.getElementById('home-ai-insight');
  if(el)el.textContent=({en:'Optional AI can describe your recorded observations, not diagnose conditions.',uk:'Необов’язковий AI описує записані спостереження, а не встановлює діагноз.',ru:'Необязательный AI описывает записанные наблюдения, а не ставит диагноз.'})[state.lang];
}

registerScreen('home', renderHome);
