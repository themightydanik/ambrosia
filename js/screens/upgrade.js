import { state, activatePremium } from '../state.js';
import { registerScreen, goTo } from '../navigation.js';
import { FREE_ENTRY_LIMIT, FREE_HISTORY_DAYS } from '../premium.js';
import { IAP_PRODUCT_IDS, PROMO_CODES } from '../config.js';

// ─────────────────────────────────────────────
// NOTE ON IN-APP PURCHASES
// ─────────────────────────────────────────────
// When this app is wrapped in Capacitor and published to
// Google Play / App Store, purchases are handled natively
// via the @capacitor-community/in-app-purchases plugin.
//
// The handleUpgrade() function below will be replaced
// with a native IAP call in the Capacitor build.
//
// For now (web preview):
//  - The upgrade button shows a message
//  - Promo codes let you test the premium flow
// ─────────────────────────────────────────────

const REASON_COPY = {
  ai:           { emoji: '🤖', title: 'AI Analysis is a Premium feature', sub: 'Unlock AI symptom analysis, correlations, and doctor reports.' },
  correlations: { emoji: '🔗', title: 'Correlations are a Premium feature', sub: 'See hidden connections between your symptoms over time.' },
  report:       { emoji: '📋', title: 'Doctor Reports are a Premium feature', sub: 'Generate structured health summaries for your appointments.' },
  recommend:    { emoji: '💊', title: 'Recommendations are a Premium feature', sub: 'Get personalized advice on what to do and who to see.' },
  doctor_visit: { emoji: '🏥', title: 'Visit Briefings are a Premium feature', sub: 'Prepare the perfect summary before every doctor appointment.' },
  filter:       { emoji: '🔍', title: 'Symptom filtering is a Premium feature', sub: 'Filter your history by any symptom to see its full timeline.' },
  export:       { emoji: '📤', title: 'Data Export is a Premium feature', sub: 'Download your complete health history as a file.' },
  entries:      { emoji: '📝', title: `You've used all ${FREE_ENTRY_LIMIT} free entries`, sub: 'Upgrade to log unlimited symptoms with no restrictions.' },
  general:      { emoji: '🌿', title: 'Upgrade to Ambrosia Premium', sub: 'Unlock everything and take full control of your health.' },
};

export function renderUpgrade() {
  const reason = state.upgradeReason || 'general';
  const copy   = REASON_COPY[reason] || REASON_COPY.general;
  const el     = document.getElementById('upgrade-content');
  if (!el) return;

  el.innerHTML = `
    <div class="upgrade-hero">
      <div class="upgrade-emoji">${copy.emoji}</div>
      <div class="upgrade-title">${copy.title}</div>
      <div class="upgrade-sub">${copy.sub}</div>
    </div>

    <div class="upgrade-price-card">
      <div class="upgrade-price-label">AMBROSIA PREMIUM</div>
      <div class="upgrade-price-row">
        <div class="upgrade-price">$2.50</div>
        <div class="upgrade-price-period">/month</div>
      </div>
      <div class="upgrade-price-note">Cancel anytime · 7-day free trial</div>
    </div>

    <div class="upgrade-features">
      <div class="upgrade-feat-row">
        <div class="upgrade-feat-col upgrade-feat-col--header">Feature</div>
        <div class="upgrade-feat-col upgrade-feat-col--header">Free</div>
        <div class="upgrade-feat-col upgrade-feat-col--header" style="color:var(--gold)">Premium</div>
      </div>
      ${featureRow('Symptom logging', 'Up to ' + FREE_ENTRY_LIMIT, 'Unlimited')}
      ${featureRow('History access', 'Last ' + FREE_HISTORY_DAYS + ' days', 'All time')}
      ${featureRow('AI Analysis', '✗', '✓')}
      ${featureRow('Correlations', '✗', '✓')}
      ${featureRow('Doctor Report', '✗', '✓')}
      ${featureRow('Visit Briefing', '✗', '✓')}
      ${featureRow('Symptom filter', '✗', '✓')}
      ${featureRow('Data export', '✗', '✓')}
    </div>

    <button class="upgrade-cta-btn" onclick="handleUpgrade()">
      Start 7-Day Free Trial →
    </button>

    <div class="upgrade-unlock-section">
      <div class="upgrade-unlock-label">Have an access code?</div>
      <div class="upgrade-unlock-row">
        <input type="text" id="upgrade-code-input" class="upgrade-code-input" placeholder="Enter code...">
        <button class="upgrade-code-btn" onclick="redeemCode()">Apply</button>
      </div>
      <div id="upgrade-code-msg" style="font-size:13px;margin-top:8px;text-align:center"></div>
    </div>

    <button class="btn-ghost" onclick="goTo('home')" style="margin-top:8px">Maybe later</button>
  `;
}

function featureRow(name, free, premium) {
  const freeOk    = free !== '✗';
  const premiumOk = premium !== '✗';
  return `<div class="upgrade-feat-row">
    <div class="upgrade-feat-col">${name}</div>
    <div class="upgrade-feat-col" style="color:${freeOk ? 'var(--mint)' : 'var(--cream30)'}">${free}</div>
    <div class="upgrade-feat-col" style="color:${premiumOk ? 'var(--gold)' : 'var(--cream30)'}">${premium}</div>
  </div>`;
}

// ─────────────────────────────────────────────
// HANDLE UPGRADE BUTTON
// In web preview: shows message + promo code hint
// In Capacitor native build: replaced with IAP call:
//   Purchases.purchaseProduct({ productIdentifier: IAP_PRODUCT_IDS.monthly })
// ─────────────────────────────────────────────
export function handleUpgrade() {
  const msg = document.getElementById('upgrade-code-msg');
  if (msg) {
    msg.style.color = 'var(--gold)';
    msg.textContent = 'Available in the mobile app. Use code AMBROSIA25 to test premium now.';
  }
}

export function redeemCode() {
  const input = document.getElementById('upgrade-code-input');
  const msg   = document.getElementById('upgrade-code-msg');
  if (!input || !msg) return;
  const code = input.value.trim().toUpperCase();
  if (PROMO_CODES.includes(code)) {
    activatePremium();
    msg.style.color = 'var(--mint)';
    msg.textContent = '✓ Premium activated! Welcome to Ambrosia Premium.';
    setTimeout(() => goTo('home'), 1500);
  } else {
    msg.style.color = 'var(--coral)';
    msg.textContent = '✗ Invalid code. Try again.';
  }
}

registerScreen('upgrade', renderUpgrade);
