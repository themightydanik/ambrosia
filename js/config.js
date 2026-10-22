// ─────────────────────────────────────────────
// AMBROSIA CLIENT CONFIG
// ─────────────────────────────────────────────
// No API keys here — safe to commit.
// The Groq key lives in the hosting provider's server-side environment variables.
// ─────────────────────────────────────────────

// Same-origin API endpoint, redirected to the Netlify Function by netlify.toml.\nexport const AI_PROXY_URL = '/api/ai';

// Groq model (informational — actual model set in api/ai.js on the server)
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

// In-App Purchase product IDs
// These must match exactly what you create in:
//   Google Play Console → Monetization → Subscriptions
//   App Store Connect → In-App Purchases
export const IAP_PRODUCT_IDS = {
  monthly: 'com.ambrosia.premium.monthly',   // $2.50/month
  yearly:  'com.ambrosia.premium.yearly',    // e.g. $19.99/year (~33% off)
};

// Promo codes for testing / early adopters
// Safe to be in code — these are just text codes you define
export const PROMO_CODES = ['AMBROSIA25', 'EARLYBIRD', 'HEALTHPRO'];
