import { clearAccess, refreshAccess } from '../account-access.js';
import { state, setPersistence } from '../state.js';
import { getSupabaseClient } from '../supabase-client.js';
import { SyncStore, defaultProfile, PROFILE_ID } from './store.js';
import { SyncEngine, supabaseTransport } from './engine.js';
import { copy } from './copy.js';
const unsavedDrafts = new Map();
let connecting, subscribed = false;
let store, engine, client, generation = 0, phase = 'local', writable = true, draft = null;
const t = () => copy[state.lang] || copy.en;
const emit = (accountChanged = false) => window.dispatchEvent(new CustomEvent('journal-changed', { detail:{ accountChanged } }));
function status(next) {
  phase = next;
  const banner = document.getElementById('sync-status');
  if (banner) { banner.textContent = writable ? t()[next] || t().error : t().locked; banner.dataset.status = next;
    if (draft) { banner.textContent = `${t().failedSave} ${t().backup}`; banner.onclick = downloadRecovery; banner.tabIndex = 0; banner.onkeydown = e => { if (e.key === 'Enter') downloadRecovery(); }; }
    else { banner.onclick = null; banner.removeAttribute('tabindex'); banner.onkeydown = null; }
  }
  document.querySelectorAll('[data-sync-panel]').forEach(panel => populate(panel));
}
function apply(accountChanged = false) {
  state.entries = store.entries();
  const { language, ...profile } = store.profile(); state.profile = profile; state.lang = language;
  emit(accountChanged);
}
export function profileVersion() { return store?.doc.records[PROFILE_ID]?.version || 0; }
function persist(kind, expectedVersion) {
  try {
    if (!writable || !store) throw new Error('Read-only tab');
    if (kind === 'entries') store.saveEntries(state.entries);
    else store.putExpected(PROFILE_ID, 'profile', { ...state.profile, language:state.lang }, expectedVersion);
    draft = null; unsavedDrafts.delete(store.key);
    status(store.user ? (navigator.onLine ? 'pending' : 'offline') : 'local');
    if (store.user) void engine?.run();
  } catch (error) {
    draft = { entries:structuredClone(state.entries), profile:structuredClone(state.profile), language:state.lang };
    unsavedDrafts.set(store?.key || 'unavailable', draft);
    status('error'); alert(writable ? t().failedSave : t().locked);
    throw error;
  }
}
function guestStore() {
  const guest = new SyncStore(localStorage);
  // Original keys are never changed or deleted. Do not re-expose old restored account data after logout.
  if (writable && !localStorage.getItem('ambrosia_sync_seen_account') && !localStorage.getItem(guest.key)) {
    const entries = JSON.parse(localStorage.getItem('ambrosia_entries') || '[]');
    guest.saveEntries(entries);
    guest.put(PROFILE_ID, 'profile', { ...defaultProfile(), ...JSON.parse(localStorage.getItem('ambrosia_profile') || '{}'), language:localStorage.getItem('ambrosia_lang') || 'en' });
  }
  return guest;
}
export function switchAccount(user) {
  if (user && localStorage.getItem('ambrosia_sync_logout_requested')) user = null;
  if (store && store.user === (user?.id || null)) {
    if (user && client && writable && !engine) startEngine();
    else if (user) void engine?.run();
    return;
  }
  const accountChanged = !!store;
  generation++; engine = null; draft = null; clearAccess(); status('switching');
  // Clear memory before reading another partition; failures must never leave the previous account visible.
  state.accountId = user?.id || null;
  if (!user) state.recoveringPassword = false;
  state.entries = []; state.profile = defaultProfile(); state.historyFilter = null;
  document.querySelectorAll('#entry-modal, #daily-streak-modal, .critical-warning-overlay, .insufficient-points-overlay').forEach(el => { if (el.id === 'entry-modal') el.classList.remove('active'); else el.remove(); });
  document.body.style.overflow = '';
  for (const id of ['ai-result-area','history-list','home-recent','today-chips','history-filter','home-chart','home-profile-header','modal-body','profile-section','cloud-account']) { const el = document.getElementById(id); if (el) el.replaceChildren(); }
  const notes = document.getElementById('log-notes'); if (notes) notes.value = '';
  state.logCat = null; state.logSymptoms = []; state.logTriggers = [];
  try {
    if (user) {
      if (writable) { localStorage.setItem('ambrosia_sync_seen_account', '1'); localStorage.setItem('ambrosia_sync_last_account', JSON.stringify({id:user.id})); }
      store = new SyncStore(localStorage, user.id);
    } else { if (writable) localStorage.removeItem('ambrosia_sync_last_account'); store = guestStore(); }
    draft = unsavedDrafts.get(store.key) || null;
    apply(accountChanged);
    if (user && client && writable) {
      startEngine();
      void refreshAccess();
    } else status(user ? (navigator.onLine ? 'error' : 'offline') : 'local');
  } catch (error) { store = null; status('error'); emit(true); }
}
function startEngine() {
  const token = generation;
  engine = new SyncEngine(store, supabaseTransport(client), { valid:() => generation === token, online:() => navigator.onLine,
    changed:() => apply(), status });
  // Supabase auth callbacks must not await auth operations under its auth lock.
  queueMicrotask(() => { if (generation === token) void engine?.run(); });
}
export async function initializeSync() {
  setPersistence({ entries:() => persist('entries'), profile:version => persist('profile', version) });
  state.entries = []; state.profile = defaultProfile();
  if (navigator.locks) await new Promise(resolve => {
    navigator.locks.request('ambrosia-journal-writer', { ifAvailable:true }, lock => {
      writable = !!lock; resolve();
      return lock ? new Promise(() => {}) : undefined;
    }).catch(() => { writable = false; resolve(); });
  });
  if (!navigator.onLine) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('ambrosia_sync_last_account') || 'null'); } catch { /* fail closed */ }
    switchAccount(cached);
  } else await connectCloud();
  window.addEventListener('online', () => { void refreshAccess(true); if (client && !localStorage.getItem('ambrosia_sync_logout_requested')) void engine?.run(); else void connectCloud(); });
  window.addEventListener('offline', () => { clearAccess();window.dispatchEvent(new Event('access-changed')); if (store?.user) status('offline'); });
  window.addEventListener('focus', () => { void engine?.run();void refreshAccess(); });
  window.addEventListener('storage', event => {
    if (event.key === 'ambrosia_account_deleted' && event.newValue) { void eraseDeletedAccount(event.newValue,[],false); return; }
    if (event.key === 'ambrosia_sync_logout_requested' && event.newValue) { void requestSignOut(); return; }
    if (event.key === 'ambrosia_sync_last_account' && (!writable || !client)) {
      try { switchAccount(JSON.parse(event.newValue || 'null')); } catch { switchAccount(null); }
      return;
    }
    if (event.key === store?.key && !writable) {
      try { store = new SyncStore(localStorage, store.user); apply(); } catch { status('error'); }
    }
  });
  setInterval(() => { if (document.visibilityState === 'visible') void engine?.run(); }, 30000);
  status(phase);
}
async function connectCloud() {
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      client = await getSupabaseClient();
      if (!client) { switchAccount(null); return; }
      if (localStorage.getItem('ambrosia_sync_logout_requested')) {
        const { error } = await client.auth.signOut({scope:'local'});
        if (error) { switchAccount(null); throw error; }
        localStorage.removeItem('ambrosia_sync_logout_requested');
      }
      if (!subscribed) {
        client.auth.onAuthStateChange((event, session) => {
          if(event === 'PASSWORD_RECOVERY') state.recoveringPassword = true;
          switchAccount(session?.user || null);
          if(event === 'PASSWORD_RECOVERY') queueMicrotask(() => window.dispatchEvent(new Event('password-recovery')));
        });
        subscribed = true;
      }
      const { data, error } = await client.auth.getSession(); if (error) throw error;
      switchAccount(data.session?.user || null);
    } catch {
      // A network failure cannot grant another account access to cached records.
      if (!store) switchAccount(null);
      status(navigator.onLine ? 'error' : 'offline');
    }
  })().finally(() => { connecting = null; });
  return connecting;
}
export async function requestSignOut() {
  // Hide cached records immediately even when the SDK/session endpoint is unavailable offline.
  localStorage.setItem('ambrosia_sync_logout_requested','1');
  switchAccount(null);
  if (client && navigator.onLine) {
    const { error } = await client.auth.signOut({scope:'local'});
    if (error) throw error;
    localStorage.removeItem('ambrosia_sync_logout_requested');
  }
}
function button(panel, label, action) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-ghost'; b.textContent = label;
  b.onclick = async () => {
    b.disabled = true;
    try { await action(); } catch { status('error'); } finally { b.disabled = false; }
  }; panel.append(b); return b;
}
export function renderSyncControls(root) {
  const panel = document.createElement('div'); panel.dataset.syncPanel = ''; panel.className = 'sync-panel'; root.append(panel); populate(panel);
}
function populate(panel) {
  panel.replaceChildren(); if (!store?.user) return;
  const labels = t();
  const text = document.createElement('p'); text.textContent = `${labels[phase] || labels.error} · ${store.pending().length} ${labels.count}`; text.setAttribute('role','status'); panel.append(text);
  if (writable) {
    button(panel, labels.retry, () => client ? engine?.run() : connectCloud());
    button(panel, labels.migration, async () => {
      if (!confirm(labels.consent)) return;
      const token = generation, target = store;
      // Use pre-existing guest journal, or immutable old keys on devices upgraded while signed in.
      const guest = new SyncStore(localStorage);
      const entries = localStorage.getItem(guest.key) ? guest.entries() : JSON.parse(localStorage.getItem('ambrosia_entries') || '[]');
      const profile = localStorage.getItem(guest.key) ? guest.profile() : { ...defaultProfile(), ...JSON.parse(localStorage.getItem('ambrosia_profile') || '{}'), language:localStorage.getItem('ambrosia_lang') || 'en' };
      await target.migrate(entries, profile, () => token === generation);
      if (token !== generation) return;
      apply(); status('pending'); await engine?.run();
    });
  }
  button(panel, labels.backup, downloadRecovery);
  for (const r of store.conflicts()) {
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = `${labels.resolve} · ${r.payload.date || r.kind}`; details.append(summary);
    for (const [label, version] of [[labels.localVersion,r],[labels.cloudVersion,r.conflict]]) {
      const pre = document.createElement('pre'); pre.textContent = `${label}${version.deleted ? ` — ${labels.deleted}` : ''}\n${JSON.stringify(version.payload,null,2)}`; details.append(pre);
    }
    if (writable) for (const [choice,label] of [['cloud',labels.cloud],['local',labels.mine],['both',labels.both]]) {
      if (choice === 'both' && (r.kind !== 'entry' || r.deleted)) continue;
      button(details,label, () => { store.resolve(r.id,choice); apply(); status('pending'); return engine?.run(); });
    }
    panel.append(details);
  }
}

function downloadRecovery() {
  if (!store || !confirm(t().archive)) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ account:store.user, data:store.doc, unsavedDraft:draft },null,2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'ambrosia-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}

export function localAccountArchive() {
  return {account:store?.user || null,data:store?.doc || null,unsavedDraft:draft};
}
export async function eraseDeletedAccount(userId,snapshot=[],broadcast=true) {
  const active=state.accountId===userId;
  if(active){generation++;engine=null;store=null;draft=null;unsavedDrafts.clear();clearAccess();state.entries=[];state.profile=defaultProfile();}
  else snapshot=[]; // Never erase another account's newly active journal after a slow delete response.
  unsavedDrafts.delete(`ambrosia_sync_v2:${userId}`);
  localStorage.removeItem(`ambrosia_sync_v2:${userId}`);
  for(const [key,value] of snapshot)if(localStorage.getItem(key)===value)localStorage.removeItem(key);
  if(broadcast)localStorage.setItem('ambrosia_account_deleted',userId);
  if(active){
    // Persist local sign-out even if Auth has become unavailable after hard deletion.
    localStorage.setItem('ambrosia_sync_logout_requested','1');switchAccount(null);
    try { await client?.auth.signOut({scope:'local'}); } catch { /* deferred sign-out remains */ }
  }
}
