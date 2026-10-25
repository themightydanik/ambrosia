import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncStore, PROFILE_ID, defaultProfile, legacyId, normalizeEntry } from '../js/sync/store.js';
import { SyncEngine } from '../js/sync/engine.js';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = () => crypto.randomUUID();
class Memory {
  values = new Map(); fail = false;
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k,v) { if(this.fail) throw new Error('QuotaExceededError'); this.values.set(k,v); }
}
const entry = (overrides = {}) => normalizeEntry({id:id(),timestamp:'2026-10-20T12:35:00.000Z',date:'2026-10-20',time:'12:35',category:'pain',symptoms:['headache'],triggers:[],intensity:5,notes:'private note',statusUpdates:[],...overrides});
class Server {
  rows = new Map(); writes = 0; pages = 0; offline = false; afterWrite; session = A;
  key(user,id) { return `${user}:${id}`; }
  async checkUser(user) { if(this.offline) throw Error('offline'); if(this.session !== user) throw Error('expired session'); }
  async page(user,cursor) { this.pages++; return structuredClone([...this.rows.values()].filter(r=>r.user_id===user && (!cursor || r.id>cursor)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,500)); }
  async write(user,r,sent) {
    await this.checkUser(user); this.writes++;
    const key=this.key(user,r.id), old=this.rows.get(key);
    if(old && (old.version!==sent.base || old.operation_id===sent.op)) return structuredClone(old);
    const row={user_id:user,id:r.id,kind:r.kind,payload:sent.payload,deleted:sent.deleted,version:(old?.version||0)+1,operation_id:sent.op};
    this.rows.set(key,structuredClone(row));
    if(this.afterWrite) await this.afterWrite();
    return structuredClone(row);
  }
}
function device(server,user=A,storage=new Memory(),options={}) {
  const store=new SyncStore(storage,user); let phase;
  const engine=new SyncEngine(store,server,{status:p=>phase=p,...options});
  return {store,engine,storage,get phase(){return phase}};
}
test('first login does not import legacy entries or profile without consent', async()=>{
  const storage=new Memory();storage.setItem('ambrosia_entries',JSON.stringify([entry({id:123})]));
  const s=new Server(),d=device(s,A,storage);await d.engine.run();assert.equal(d.store.entries().length,0);assert.equal(s.writes,0);assert.ok(storage.getItem('ambrosia_entries'));
});
test('consented migration preserves original data, deterministically maps IDs and is repeatable', async()=>{
  const s=new Server(),d=device(s);const legacy=[entry({id:123,statusUpdates:[{date:'2026-10-21',time:'08:30',status:'improved',notes:'better'}]})];
  const snapshot=structuredClone(legacy);await d.store.migrate(legacy,defaultProfile());await d.engine.run();
  const uuid=await legacyId(A,'entry:123');assert.equal(d.store.entries()[0].id,uuid);assert.deepEqual(legacy,snapshot);assert.equal(s.rows.size,2);
  await d.store.migrate(legacy,defaultProfile());await d.engine.run();assert.equal(s.rows.size,2);assert.equal(d.store.entries()[0].statusUpdates[0].notes,'better');
});
test('two devices download and synchronize modifications and status history', async()=>{
  const s=new Server(),a=device(s),b=device(s);const e=entry();a.store.saveEntries([e]);await a.engine.run();await b.engine.run();assert.deepEqual(a.store.entries(),b.store.entries());
  const changed={...b.store.entries()[0],notes:'edited',statusUpdates:[{id:id(),status:'resolved',timestamp:'2026-10-21T12:00:00Z',date:'2026-10-21',time:'12:00',notes:'resolved note'}]};
  b.store.saveEntries([changed]);await b.engine.run();await a.engine.run();assert.deepEqual(a.store.entries(),b.store.entries());assert.equal(a.store.entries()[0].notes,'edited');
});
test('offline entry creation persists outbox through reload; reconnect retries', async()=>{
  const s=new Server(),d=device(s,A,new Memory(),{online:()=>!s.offline});s.offline=true;d.store.saveEntries([entry()]);await d.engine.run();assert.equal(d.phase,'offline');assert.equal(d.store.pending().length,1);
  const reload=device(s,A,d.storage);assert.equal(reload.store.entries().length,1);s.offline=false;await reload.engine.run();assert.equal(reload.phase,'synced');assert.equal(reload.store.pending().length,0);
});
test('simultaneous edits retain both versions until explicit resolution; no clock based loss', async()=>{
  const s=new Server(),a=device(s),b=device(s);a.store.saveEntries([entry()]);await a.engine.run();await b.engine.run();
  a.store.saveEntries(a.store.entries().map(e=>({...e,notes:'device A'})));b.store.saveEntries(b.store.entries().map(e=>({...e,notes:'device B'})));
  await a.engine.run();await b.engine.run();const conflict=b.store.conflicts()[0];assert.equal(b.phase,'conflict');assert.equal(conflict.payload.notes,'device B');assert.equal(conflict.conflict.payload.notes,'device A');
  b.store.resolve(conflict.id,'both');await b.engine.run();await a.engine.run();assert.equal(a.store.entries().length,2);assert.equal(b.store.doc.archives.length,1);
});
test('deletion propagation, delayed offline edit versus deletion and explicit resurrection', async()=>{
  const s=new Server(),a=device(s),b=device(s);a.store.saveEntries([entry()]);await a.engine.run();await b.engine.run();
  const uuid=a.store.entries()[0].id;a.store.saveEntries([]);await a.engine.run();
  b.store.saveEntries(b.store.entries().map(e=>({...e,notes:'offline edit'})));await b.engine.run();assert.equal(b.store.conflicts()[0].conflict.deleted,true);
  b.store.resolve(uuid,'cloud');assert.equal(b.store.entries().length,0);await b.engine.run();assert.equal(s.rows.get(s.key(A,uuid)).deleted,true);
  // Explicit restore of local version is permitted, never automatic.
  const c=device(s);await c.engine.run();c.store.put(uuid,'entry',entry({id:uuid,notes:'explicit restore'}));await c.engine.run();await a.engine.run();assert.equal(a.store.entries().length,1);
});
test('lost acknowledgement is safe and does not duplicate after reload', async()=>{
  const s=new Server(),a=device(s);a.store.saveEntries([entry()]);s.afterWrite=()=>{throw Error('connection lost after commit')};await a.engine.run();assert.equal(a.phase,'error');assert.equal(a.store.pending().length,1);
  s.afterWrite=null;const reload=device(s,A,a.storage);await reload.engine.run();assert.equal(reload.store.pending().length,0);assert.equal(s.rows.size,1);
});
test('edit made while request is in flight remains queued against acknowledged revision', async()=>{
  const s=new Server(),a=device(s);a.store.saveEntries([entry()]);s.afterWrite=()=>{s.afterWrite=null;a.store.saveEntries(a.store.entries().map(e=>({...e,notes:'new edit during request'})));};
  await a.engine.run();assert.equal(a.store.pending().length,1);assert.equal(a.store.entries()[0].notes,'new edit during request');await a.engine.run();assert.equal(a.store.pending().length,0);assert.equal([...s.rows.values()][0].payload.notes,'new edit during request');
});
test('logout/account switching isolates partitions and ignores in-flight old-account responses', async()=>{
  const s=new Server(),storage=new Memory(),a=device(s,A,storage);let valid=true;a.engine.valid=()=>valid;
  a.store.saveEntries([entry()]);s.afterWrite=()=>{valid=false;};await a.engine.run();const b=new SyncStore(storage,B);assert.equal(b.entries().length,0);assert.equal(new SyncStore(storage).entries().length,0);assert.equal(new SyncStore(storage,A).pending().length,1);
  const response=[...s.rows.values()][0];assert.throws(()=>b.receive(response),/Cross-account/);
});
test('expired session retains outbox and profile; recovery resumes without data loss', async()=>{
  const s=new Server(),a=device(s);a.store.saveEntries([entry()]);s.session=B;await a.engine.run();assert.equal(a.phase,'error');assert.equal(a.store.pending().length,1);s.session=A;await a.engine.run();assert.equal(a.phase,'synced');
});
test('profile language and settings sync; simultaneous profile edits require review', async()=>{
  const s=new Server(),a=device(s),b=device(s);a.store.put(PROFILE_ID,'profile',{name:'Тест',avatar:'🌸',age:29,occupation:'Engineer',language:'uk'});await a.engine.run();await b.engine.run();assert.deepEqual(b.store.profile(),a.store.profile());
  a.store.put(PROFILE_ID,'profile',{...a.store.profile(),age:30});b.store.put(PROFILE_ID,'profile',{...b.store.profile(),name:'Changed'});await a.engine.run();await b.engine.run();assert.equal(b.store.conflicts().length,1);b.store.resolve(PROFILE_ID,'local');await b.engine.run();await a.engine.run();assert.equal(a.store.profile().name,'Changed');
});
test('large journals use deterministic keyset pagination with equal timestamps and tombstones', async()=>{
  const s=new Server();for(let n=0;n<1203;n++){const e=entry();s.rows.set(s.key(A,e.id),{user_id:A,id:e.id,kind:'entry',payload:e,version:1,deleted:n===0});}
  const a=device(s);await a.engine.run();assert.equal(a.store.entries().length,1202);assert.equal(s.pages,3);assert.equal(Object.keys(a.store.doc.records).length,1203);
});
test('quota failure leaves committed data/outbox unchanged and sends nothing', async()=>{
  const s=new Server(),a=device(s);const e=entry();a.store.saveEntries([e]);await a.engine.run();const before=a.storage.getItem(a.store.key);a.storage.fail=true;assert.throws(()=>a.store.saveEntries([{...e,notes:'unsaved'}]),/Quota/);assert.equal(a.storage.getItem(a.store.key),before);assert.equal(a.store.entries()[0].notes,e.notes);assert.equal(a.store.pending().length,0);
});
test('partial migration resumes without overwriting edits or duplicating records', async()=>{
  const s=new Server(),a=device(s);const legacy=[entry({id:101}),entry({id:102})];await a.store.migrate(legacy,defaultProfile());let count=0;s.afterWrite=()=>{if(++count===1) throw Error('interrupted')};await a.engine.run();s.afterWrite=null;
  const reload=device(s,A,a.storage);await reload.store.migrate(legacy,defaultProfile());await reload.engine.run();assert.equal(s.rows.size,3);assert.equal(reload.store.pending().length,0);
});
test('prior manual import is reviewed, not duplicated or silently overwritten', async()=>{
  const s=new Server(),a=device(s),legacy=entry({id:456});const uuid=await legacyId(A,'entry:456');s.rows.set(s.key(A,uuid),{user_id:A,id:uuid,kind:'entry',payload:entry({...legacy,id:uuid,notes:'old imported'}),version:1,deleted:false});await a.engine.run();await a.store.migrate([legacy],defaultProfile());assert.equal(a.store.conflicts().length,1);await a.engine.run();assert.equal(s.rows.size,2);assert.equal(a.store.entries().length,1);
});
test('PR #11 restore aliases match unique unchanged cloud record instead of uploading duplicate', async()=>{
  const s=new Server(),a=device(s),cloud=entry();s.rows.set(s.key(A,cloud.id),{user_id:A,id:cloud.id,kind:'entry',payload:cloud,version:1,deleted:false});await a.engine.run();await a.store.migrate([{...cloud,id:1}],defaultProfile());assert.equal(a.store.entries().length,1);
});
test('account change during migration staging prevents any commit', async()=>{
  const s=new Server(),a=device(s);await assert.rejects(a.store.migrate([entry({id:1})],defaultProfile(),()=>false),/Account changed/);assert.equal(a.store.entries().length,0);assert.equal(a.store.pending().length,0);
});
test('profile form based on an older revision retains remote changes as a conflict', async()=>{
  const s=new Server(),a=device(s),b=device(s);a.store.put(PROFILE_ID,'profile',defaultProfile());await a.engine.run();await b.engine.run();const openedVersion=b.store.doc.records[PROFILE_ID].version;
  a.store.put(PROFILE_ID,'profile',{...a.store.profile(),occupation:'remote change'});await a.engine.run();await b.engine.run();
  b.store.putExpected(PROFILE_ID,'profile',{...defaultProfile(),name:'typed before remote update'},openedVersion);
  assert.equal(b.store.conflicts().length,1);assert.equal(b.store.conflicts()[0].conflict.payload.occupation,'remote change');
});
