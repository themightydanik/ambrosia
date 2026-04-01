// ─────────────────────────────────────────────
// AMBROSIA CLIENT CONFIG
// ─────────────────────────────────────────────
// No API keys here — safe to commit.
// The Groq key lives in Vercel environment variables.
// ─────────────────────────────────────────────

// AI Proxy URL — your Vercel deployment URL + /api/ai
// During local development: use '' to get a "coming soon" message
// After deploying to Vercel: paste your URL here, e.g.:
//   'https://ambrosia-app.vercel.app/api/ai'
export const AI_PROXY_URL = 'https://ambrosia-beige.vercel.app/';

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
