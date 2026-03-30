// ─────────────────────────────────────────────
// AMBROSIA CONFIG
// ─────────────────────────────────────────────
// IMPORTANT: Add this file to .gitignore before pushing!
// Never commit your real API key to a public repo.
//
// For production: replace the proxy URL with your
// Vercel/Netlify serverless function endpoint.
// ─────────────────────────────────────────────

// Your Groq API key — paste here for development
// For production, use the proxy approach (see README)
export const GROQ_API_KEY = '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';

// Groq model to use
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Payment link (Stripe, Lemon Squeezy, Paddle, etc.)
// Paste your payment link here when ready
export const PAYMENT_LINK = '';

// Access codes for testing / early adopters / promo
// Add your promo codes here
export const PROMO_CODES = ['AMBROSIA25', 'EARLYBIRD', 'HEALTHPRO'];
