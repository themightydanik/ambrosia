import { state } from './state.js';
import { goTo } from './navigation.js';

// ─────────────────────────────────────────────
// FREE TIER LIMITS
// ─────────────────────────────────────────────
export const FREE_ENTRY_LIMIT  = 30;
export const FREE_HISTORY_DAYS = 14;

// ─────────────────────────────────────────────
// PREMIUM CHECK
// ─────────────────────────────────────────────
export function isPremium() {
  return state.premium === true;
}

// ─────────────────────────────────────────────
// ENTRY LIMIT
// ─────────────────────────────────────────────
export function canLogEntry() {
  if (isPremium()) return true;
  return state.entries.length < FREE_ENTRY_LIMIT;
}

export function freeEntriesLeft() {
  if (isPremium()) return Infinity;
  return Math.max(0, FREE_ENTRY_LIMIT - state.entries.length);
}

// ─────────────────────────────────────────────
// HISTORY VISIBILITY (free = last 14 days only)
// ─────────────────────────────────────────────
export function getVisibleEntries(entries) {
  if (isPremium()) return entries;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FREE_HISTORY_DAYS);
  return entries.filter(e => new Date(e.date + 'T12:00') >= cutoff);
}

// ─────────────────────────────────────────────
// FEATURE GATES — returns true if feature is LOCKED
// Features: 'ai', 'correlations', 'report', 'recommend',
//           'filter', 'export', 'doctor_visit'
// ─────────────────────────────────────────────
export function isLocked(feature) {
  return !isPremium();
}

// ─────────────────────────────────────────────
// PAYWALL TRIGGER — navigate to upgrade screen
// with context about which feature was blocked
// ─────────────────────────────────────────────
export function showPaywall(reason = 'general') {
  state.upgradeReason = reason;
  goTo('upgrade');
}

// ─────────────────────────────────────────────
// PREMIUM BADGE HTML — inline lock icon
// ─────────────────────────────────────────────
export function premiumBadge() {
  if (isPremium()) return '';
  return `<span class="premium-badge">PRO</span>`;
}

// ─────────────────────────────────────────────
// ENTRY LIMIT WARNING (returns HTML or empty)
// Show when user has <= 5 entries left on free tier
// ─────────────────────────────────────────────
export function entryLimitBanner() {
  if (isPremium()) return '';
  const left = freeEntriesLeft();
  if (left > 5) return '';
  if (left === 0) return `
    <div class="limit-banner limit-banner--red">
      🔒 Free limit reached (${FREE_ENTRY_LIMIT} entries).
      <span onclick="showPaywall('entries')" style="color:var(--gold);cursor:pointer;font-weight:600"> Upgrade →</span>
    </div>`;
  return `
    <div class="limit-banner">
      ⚡ ${left} free entr${left === 1 ? 'y' : 'ies'} remaining.
      <span onclick="showPaywall('entries')" style="color:var(--gold);cursor:pointer;font-weight:600"> Upgrade →</span>
    </div>`;
}
