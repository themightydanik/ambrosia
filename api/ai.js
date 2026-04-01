// ─────────────────────────────────────────────
// VERCEL SERVERLESS PROXY FOR GROQ API
// ─────────────────────────────────────────────
// Deploy this project to Vercel (free).
// Add GROQ_API_KEY in Vercel Dashboard → Settings → Environment Variables.
// The key NEVER touches your repo or your frontend code.
//
// Endpoint: POST /api/ai
// Body: { prompt: string, type: string }
// Returns: { text: string }
// ─────────────────────────────────────────────

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// CORS origins — add your GitHub Pages URL and any other domains
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:3000',
  'https://localhost',
  // Add your real domain when you have it, e.g.:
  // 'https://yourusername.github.io',
  // 'https://ambrosia-app.com',
];

export default async function handler(req, res) {
  // Handle CORS preflight
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid request: prompt required' });
  }

  // Basic rate limit hint (Vercel handles real rate limiting)
  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        max_tokens:  1000,
        temperature: 0.4,
        messages:    [{ role: 'user', content: prompt }]
      })
    });

    const data = await groqRes.json();
    if (data.error) {
      return res.status(502).json({ error: data.error.message });
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Groq proxy error:', err);
    return res.status(500).json({ error: 'AI service temporarily unavailable' });
  }
}
