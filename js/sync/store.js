// One atomic localStorage document per account: data, outbox and conflicts commit together.
export const PROFILE_ID = '00000000-0000-4000-8000-000000000001';
const clone = value => structuredClone(value);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
// PostgreSQL jsonb reorders object keys; equality must follow content, not serialization order.
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export const defaultProfile = () => ({ name: '', age: null, occupation: '', avatar: '🌿', language: 'en' });
export function localWhen(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid journal timestamp');
  return { date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` };
}
export function normalizeEntry(entry, id = entry.id) {
  // Keep the original wall date/time as well as the absolute instant. Never use "now" for historical records.
  let timestamp = entry.timestamp;
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    const wall = `${entry.date}T${/^\d{2}:\d{2}$/.test(entry.time || '') ? entry.time : '12:00'}:00`;
    const d = new Date(wall);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid legacy journal date');
    timestamp = d.toISOString();
  }
  const when = localWhen(timestamp);
  return { ...clone(entry), id, date: entry.date || when.date, time: entry.time || when.time, timestamp,
    symptoms: entry.symptoms || [], triggers: entry.triggers || [], notes: entry.notes || '',
    statusUpdates: (entry.statusUpdates || []).map(u => ({ ...u })) };
}
// Compatible with PR #10: identical local numeric IDs map to the same existing cloud UUID.
export async function legacyId(user, value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ambrosia-v1:${user}:${value}`)));
  digest[6] = digest[6] & 15 | 64; digest[8] = digest[8] & 63 | 128;
  const s = Array.from(digest.slice(0,16), x => x.toString(16).padStart(2,'0')).join('');
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export class SyncStore {
  constructor(storage, user = null) {
    this.storage = storage; this.user = user;
    this.key = `ambrosia_sync_v2:${user || 'guest'}`;
    const saved = storage.getItem(this.key);
    this.doc = saved ? JSON.parse(saved) : { records: {}, archives: [], migration: null };
    if (!this.doc.records || !Array.isArray(this.doc.archives)) throw new Error('Invalid local sync storage; preserve browser data and recover from backup');
  }
  commit(change) {
    const next = clone(this.doc); change(next);
    // Quota/permission errors propagate. Never announce a successful save or send unpersisted data.
    this.storage.setItem(this.key, JSON.stringify(next)); this.doc = next;
  }
  entries() { return Object.values(this.doc.records).filter(r => r.kind === 'entry' && !r.deleted).map(r => clone(r.payload)).sort((a,b) => a.timestamp.localeCompare(b.timestamp) || String(a.id).localeCompare(String(b.id))); }
  records(kind) { return Object.values(this.doc.records).filter(r=>r.kind===kind&&!r.deleted).map(r=>clone(r.payload)); }
  profile() { return clone(this.doc.records[PROFILE_ID]?.payload || defaultProfile()); }
  put(id, kind, payload, deleted = false) {
    this.commit(doc => this.edit(doc, id, kind, payload, deleted));
  }
  putExpected(id, kind, payload, expectedVersion, deleted = false) {
    this.commit(doc => {
      const old = doc.records[id];
      this.edit(doc, id, kind, payload, deleted);
      if (expectedVersion !== undefined && old && old.version !== expectedVersion) doc.records[id].conflict = clone(old);
    });
  }
  edit(doc, id, kind, payload, deleted) {
    const old = doc.records[id];
    if (old && old.deleted === deleted && equal(old.payload, payload)) return;
    const record = { ...old, id, kind, payload: clone(payload), deleted, version: old?.version || 0 };
    if (this.user) record.pending = { op: crypto.randomUUID(), base: record.version, payload: clone(payload), deleted };
    doc.records[id] = record;
  }
  saveEntries(entries) {
    const normalized = entries.map(e => normalizeEntry(e));
    this.commit(doc => {
      const ids = new Set(normalized.map(e => String(e.id)));
      for (const r of Object.values(doc.records)) if (r.kind === 'entry' && !r.deleted && !ids.has(String(r.id))) this.edit(doc, r.id, r.kind, r.payload, true);
      for (const entry of normalized) this.edit(doc, entry.id, 'entry', entry, false);
    });
  }
  pending() { return Object.values(this.doc.records).filter(r => r.pending && !r.conflict).map(clone); }
  conflicts() { return Object.values(this.doc.records).filter(r => r.conflict).map(clone); }
  receive(remote, sent = null) {
    if (remote.user_id !== this.user) throw new Error('Cross-account response rejected');
    this.commit(doc => this.merge(doc, remote, sent));
  }
  receiveBatch(rows) {
    this.commit(doc => { for (const row of rows) {
      if (row.user_id !== this.user) throw new Error('Cross-account response rejected');
      this.merge(doc, row);
    } });
  }
  merge(doc, remote, sent) {
      const old = doc.records[remote.id];
      const canonical = { id: remote.id, kind: remote.kind, payload: remote.payload, deleted: remote.deleted, version: remote.version };
      if (!old) { doc.records[remote.id] = canonical; return; }
      if (remote.version < old.version) return;
      if (sent && remote.operation_id === sent.op) {
        // An edit made during the request is a new operation against this acknowledged revision.
        if (old.pending?.op !== sent.op) {
          old.version = remote.version;
          if (old.pending) old.pending.base = remote.version;
        } else doc.records[remote.id] = canonical;
      } else if (old.pending || old.conflict) {
        if (equal(old.payload, remote.payload) && old.deleted === remote.deleted) doc.records[remote.id] = canonical;
        else if (remote.version !== old.version || old.conflict) old.conflict = canonical;
      } else doc.records[remote.id] = canonical;
  }
  resolve(id, choice) {
    this.commit(doc => {
      const r = doc.records[id]; if (!r?.conflict) return;
      const remote = r.conflict;
      doc.archives.push({ savedAt: new Date().toISOString(), local: clone(r), remote: clone(remote) });
      if (choice === 'both') {
        if (r.kind !== 'entry' || r.deleted) throw new Error('Only a live journal entry can be copied');
        const newId = crypto.randomUUID();
        this.edit(doc, newId, 'entry', { ...r.payload, id: newId }, false);
        doc.records[id] = remote;
      } else if (choice === 'cloud') doc.records[id] = remote;
      else if (choice === 'local') {
        r.version = remote.version; delete r.conflict;
        r.pending = { op: crypto.randomUUID(), base: remote.version, payload: clone(r.payload), deleted: r.deleted };
      } else throw new Error('Unknown conflict choice');
    });
  }
  async migrate(entries, profile, valid = () => true, extraRecords = []) {
    // Consent is required by the caller. Stage the complete mapping locally before any upload.
    const mapped = [];
    for (const e of entries.filter(e => !e.isUpdate)) {
      let id = await legacyId(this.user, `entry:${String(e.id)}`);
      if (!this.doc.records[id]) {
        // PR #11 discarded cloud IDs. Match a unique, unchanged restored record by its instant and content.
        const fields = ['timestamp','category','symptoms','intensity','triggers','notes'];
        const matches = Object.values(this.doc.records).filter(r => r.kind === 'entry' && fields.every(k => k === 'timestamp' ? Date.parse(r.payload[k]) === Date.parse(e[k]) : equal(r.payload[k], e[k])));
        if (matches.length === 1) id = matches[0].id;
        else if (matches.length > 1) throw new Error('Ambiguous legacy records: review the recovery archive before merging');
      }
      const extra = entries.filter(u => u.isUpdate && u.parentId === e.id).map(u => ({ date:u.date,time:u.time,timestamp:u.timestamp,status:u.updateStatus,notes:u.notes || '' }));
      mapped.push(normalizeEntry({ ...e, statusUpdates:[...(e.statusUpdates || []), ...extra], legacyId:e.id }, id));
    }
    if (!valid()) throw new Error('Account changed');
    this.commit(doc => {
      for (const entry of mapped) {
        if (doc.migration?.ids?.includes(entry.id)) continue; // interrupted migrations never overwrite subsequent edits
        const existing = doc.records[entry.id];
        if (!existing) this.edit(doc, entry.id, 'entry', entry, false);
        else if (!equal(existing.payload, entry)) {
          // Same ID from an earlier manual import. Preserve both until the owner chooses.
          doc.records[entry.id] = { ...existing, payload:entry, deleted:false,
            pending:{op:crypto.randomUUID(),base:existing.version,payload:entry,deleted:false}, conflict:clone(existing) };
        }
      }
      for(const r of extraRecords.filter(r=>['checkin','episode'].includes(r.kind)&&!r.deleted)) {
        if(doc.migration?.extraSources?.[r.id]===JSON.stringify(canonical(r.payload)))continue;
        const old=doc.records[r.id];
        if(!old)this.edit(doc,r.id,r.kind,r.payload,false);
        else if(!equal(old.payload,r.payload))doc.records[r.id]={...old,payload:clone(r.payload),deleted:false,pending:{op:crypto.randomUUID(),base:old.version,payload:clone(r.payload),deleted:false},conflict:clone(old)};
      }
      if (!doc.migration?.profile) {
        const old = doc.records[PROFILE_ID];
        if (!old) this.edit(doc, PROFILE_ID, 'profile', profile, false);
        else if (!equal(old.payload, profile)) doc.records[PROFILE_ID] = { ...old, payload:clone(profile), pending:{op:crypto.randomUUID(),base:old.version,payload:clone(profile),deleted:false}, conflict:clone(old) };
      }
      doc.migration = { extraSources:{...(doc.migration?.extraSources||{}),...Object.fromEntries(extraRecords.filter(r=>['checkin','episode'].includes(r.kind)).map(r=>[r.id,JSON.stringify(canonical(r.payload))]))}, extraIds:[...new Set([...(doc.migration?.extraIds||[]),...extraRecords.map(r=>r.id)])], profile:true, ids: [...new Set([...(doc.migration?.ids || []), ...mapped.map(e => e.id)])], stagedAt:new Date().toISOString() };
    });
  }
}
