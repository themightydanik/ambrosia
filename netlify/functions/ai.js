// Netlify serverless proxy for Groq. Set GROQ_API_KEY in Netlify environment variables.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const MAX_PROMPT_LENGTH = 6000;
const UPSTREAM_TIMEOUT_MS = 20000;

exports.handler = async (event) => {
  const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  // Defense in depth only: Origin headers can be forged outside a browser.
  // Do not treat this as authentication or a substitute for rate limiting.
  const origin = event.headers?.origin || event.headers?.Origin;
  const host = event.headers?.host || event.headers?.Host;
  if (origin) {
    let originHost;
    try { const parsed = new URL(origin); if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return json(403, { error: 'Forbidden origin' }); originHost = parsed.host; }
    catch { return json(403, { error: 'Forbidden origin' }); }
    if (!host || originHost !== host) return json(403, { error: 'Forbidden origin' });
  }
  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) return json(415, { error: 'Content-Type must be application/json' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(503, { error: 'AI service not configured' });
  if (Buffer.byteLength(event.body || '', 'utf8') > 20000) return json(413, { error: 'Request too large' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const prompt = payload?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) return json(400, { error: 'Invalid prompt' });

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 1200, temperature: 0.4, messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) {
      console.error('Groq upstream status:', response.status);
      return json(502, { error: 'AI service temporarily unavailable' });
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return json(502, { error: 'Empty response from AI' });
    return json(200, { text });
  } catch (error) {
    console.error('Groq request failed:', error);
    return json(502, { error: 'AI service temporarily unavailable' });
  }
};
