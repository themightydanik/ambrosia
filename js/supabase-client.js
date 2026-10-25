let clientPromise;
export async function getSupabaseClient() {
  if (!clientPromise) clientPromise = (async () => {
    const res = await fetch('/api/supabase-config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Supabase configuration unavailable');
    const { url, publishableKey } = await res.json();
    if (!url || !publishableKey) return null;
    let timer;
    const { createClient } = await Promise.race([
      import('https://esm.sh/@supabase/supabase-js@2.118.0'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Supabase SDK unavailable')), 20000); })
    ]).finally(() => clearTimeout(timer));
    return createClient(url, publishableKey, { global: { fetch:(input, init = {}) => fetch(input, { ...init, signal:init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) }) } });
  })().catch(e => { clientPromise = null; throw e; });
  return clientPromise;
}
