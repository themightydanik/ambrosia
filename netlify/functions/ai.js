// Netlify serverless proxy for Groq. Set GROQ_API_KEY in Netlify environment variables.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

exports.handler = async (event) => {
  const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(503, { error: 'AI service not configured' });
  if (Buffer.byteLength(event.body || '', 'utf8') > 20000) return json(413, { error: 'Request too large' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const prompt = payload?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) return json(400, { error: 'Invalid prompt' });

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 1000, temperature: 0.4, messages: [{ role: 'user', content: prompt }] })
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
