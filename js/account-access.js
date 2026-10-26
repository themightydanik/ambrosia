import { state } from './state.js';
import { getSupabaseClient } from './supabase-client.js';
let access = null, epoch = 0, pending;
export function clearAccess() { epoch++; access=null; pending=null; }
export function accountAccess() {
  if (!access || access.userId !== state.accountId || Date.now()-access.checkedAt > 300000) return null;
  return access;
}
export function verifiedPremium() {
  const value=accountAccess();
  return !!value && value.tier==='premium' && Date.parse(value.validUntil)>Date.now();
}
export async function authenticatedFetch(path, options = {}, allowAccountChange = false) {
  const id=state.accountId, generation=epoch;
  if (!id) throw new Error('SIGN_IN_REQUIRED');
  const client=await getSupabaseClient();
  if (!client) throw new Error('NOT_CONFIGURED');
  const { data,error }=await client.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id!==id || epoch!==generation) throw new Error('SESSION_EXPIRED');
  let response;
  try { response=await fetch(path,{...options,cache:'no-store',headers:{...options.headers,Authorization:`Bearer ${data.session.access_token}`},signal:AbortSignal.timeout(path==='/api/chat'?65000:35000)}); }
  catch { throw new Error('SERVICE_UNAVAILABLE'); }
  if (!allowAccountChange && (state.accountId!==id || epoch!==generation)) throw new Error('SESSION_EXPIRED');
  const result=await response.json();
  if (!response.ok) { const e=new Error(result.error || 'SERVICE_UNAVAILABLE');e.usage=result.usage;throw e; }
  return result;
}
export function refreshAccess(force = false) {
  if (!state.accountId || !navigator.onLine) { access=null;return Promise.resolve(null); }
  if (pending) return pending;
  if (!force && accountAccess() && Date.now()-access.checkedAt<60000) return Promise.resolve(access);
  const id=state.accountId, generation=epoch;
  pending=(async()=>{
    try {
      const value=await authenticatedFetch('/api/account-status');
      if (generation!==epoch || id!==state.accountId) return null;
      if (value.userId!==id || !['free','premium'].includes(value.tier) || !['free','active','trial','cancelled','expired'].includes(value.state)
        || !Number.isInteger(value.limit) || !Number.isInteger(value.used) || !Number.isInteger(value.remaining) || !Number.isFinite(Date.parse(value.renewsAt))) throw Error('INVALID_RESPONSE');
      access=Object.freeze({...value,checkedAt:Date.now()});
    } catch { if (generation===epoch) access=null; }
    if (generation===epoch) window.dispatchEvent(new Event('access-changed'));
    return access;
  })().finally(()=>{if(generation===epoch) pending=null;});
  return pending;
}
