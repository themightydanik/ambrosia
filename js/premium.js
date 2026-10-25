import { state } from './state.js';
import { goTo } from './navigation.js';
import { verifiedPremium } from './account-access.js';
// Health records and privacy controls remain usable on every plan, including offline.
export const FREE_ENTRY_LIMIT = Infinity;
export const FREE_HISTORY_DAYS = Infinity;
export const isPremium = verifiedPremium;
export const canLogEntry = () => true;
export const freeEntriesLeft = () => Infinity;
export const getVisibleEntries = entries => entries;
export function isLocked(feature) { return feature === 'filter' && !isPremium(); }
export function showPaywall(reason = 'general') { state.upgradeReason=reason;goTo('upgrade'); }
export const premiumBadge = () => isPremium() ? '' : '<span class="premium-badge">PRO</span>';
export const entryLimitBanner = () => '';
