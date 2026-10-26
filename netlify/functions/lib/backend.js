// No SDK or secret values are ever sent to the browser. Tokens are validated by Supabase Auth.
class HttpError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const json = (statusCode, body) => ({ statusCode, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://localhost','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','X-Content-Type-Options':'nosniff'}, body:JSON.stringify(body) });
function method(event, expected) {
  if (event.httpMethod !== expected) throw new HttpError(405,'METHOD_NOT_ALLOWED');
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v])=>[k.toLowerCase(),v]));
  if (headers.origin) {
    let origin;
    try { origin = new URL(headers.origin); } catch { throw new HttpError(403,'FORBIDDEN'); }
    if (origin.origin !== 'https://localhost' && (origin.host !== headers.host || !['http:','https:'].includes(origin.protocol) || (origin.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(origin.hostname)))) throw new HttpError(403,'FORBIDDEN');
  }
  return headers;
}
function body(event, max = 24000) {
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v])=>[k.toLowerCase(),v]));
  if (event.isBase64Encoded || !/^application\/json(?:\s*;|\s*$)/i.test(headers['content-type'] || '')) throw new HttpError(415,'JSON_REQUIRED');
  if (Buffer.byteLength(event.body || '', 'utf8') > max) throw new HttpError(413,'TOO_LARGE');
  try { const value = JSON.parse(event.body || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw Error(); return value; }
  catch { throw new HttpError(400,'INVALID_INPUT'); }
}
function config(env) {
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new HttpError(503,'NOT_CONFIGURED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !env.SUPABASE_PUBLISHABLE_KEY) throw new HttpError(503,'NOT_CONFIGURED');
  return { url:url.origin, publicKey:env.SUPABASE_PUBLISHABLE_KEY, serviceKey:env.SUPABASE_SERVICE_ROLE_KEY };
}
async function request(fetcher, url, options) {
  try { return await fetcher(url,{...options,signal:AbortSignal.timeout(10000),redirect:'error'}); }
  catch { throw new HttpError(503,'SERVICE_UNAVAILABLE'); }
}
async function authenticate(event, env, fetcher) {
  const authorization = Object.entries(event.headers || {}).find(([k])=>k.toLowerCase()==='authorization')?.[1] || '';
  if (!/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization) || authorization.length > 8192) throw new HttpError(401,'SIGN_IN_REQUIRED');
  const cfg = config(env);
  const result = await request(fetcher, cfg.url+'/auth/v1/user',{headers:{apikey:cfg.publicKey,Authorization:authorization}});
  if (result.status === 401 || result.status === 403) throw new HttpError(401,'SESSION_EXPIRED');
  if (!result.ok) throw new HttpError(503,'SERVICE_UNAVAILABLE');
  const user = await result.json();
  if (!/^[0-9a-f-]{36}$/i.test(user?.id || '')) throw new HttpError(401,'SESSION_EXPIRED');
  return { cfg,user,authorization };
}
async function rpc(auth, name, values, fetcher, admin = true) {
  if (admin && !auth.cfg.serviceKey) throw new HttpError(503,'NOT_CONFIGURED');
  const result = await request(fetcher,auth.cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:admin?auth.cfg.serviceKey:auth.cfg.publicKey,Authorization:admin?`Bearer ${auth.cfg.serviceKey}`:auth.authorization},body:JSON.stringify(values)});
  if (!result.ok) throw new HttpError(503,'SERVICE_UNAVAILABLE');
  return result.json();
}
function failure(error) { return json(error instanceof HttpError ? error.status : 503,{error:error instanceof HttpError ? error.code : 'SERVICE_UNAVAILABLE'}); }
module.exports = { HttpError,json,method,body,config,request,authenticate,rpc,failure };
