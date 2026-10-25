export class SyncEngine {
  constructor(store, transport, { changed = () => {}, status = () => {}, online = () => true, valid = () => true } = {}) {
    Object.assign(this, { store, transport, changed, status, online, valid }); this.running = null;
  }
  async run() {
    if (this.running) { this.again = true; return this.running; }
    this.running = this.cycle().finally(() => { this.running = null; });
    return this.running;
  }
  async cycle() {
    try {
      do {
        this.again = false;
        if (!this.valid()) return;
        if (!this.online()) { this.status('offline'); return; }
        this.status('syncing');
        await this.transport.checkUser(this.store.user);
        if (!this.valid()) return;
        // Keyset pagination is independent of recorded_at ties and includes permanent tombstones.
        let cursor = null;
        for (;;) {
          const rows = await this.transport.page(this.store.user, cursor);
          if (!this.valid()) return;
          if (rows.length) this.store.receiveBatch(rows);
          this.changed();
          if (rows.length < 500) break;
          cursor = rows.at(-1).id;
        }
        for (const record of this.store.pending()) {
          if (!this.valid()) return;
          // Re-read: a newer local edit may have arrived since the pending list was captured.
          const current = this.store.doc.records[record.id];
          if (!current.pending || current.conflict) continue;
          const sent = structuredClone(current.pending);
          const result = await this.transport.write(this.store.user, current, sent);
          if (!this.valid()) return;
          this.store.receive(result, sent); this.changed();
        }
      } while (this.again);
      if (this.valid()) this.status(this.store.conflicts().length ? 'conflict' : this.store.pending().length ? 'pending' : 'synced');
    } catch (error) {
      if (this.valid()) this.status(this.online() ? 'error' : 'offline', error);
    }
  }
}
export function supabaseTransport(client) {
  return {
    async checkUser(id) {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (data.user?.id !== id) throw new Error('Session changed; sign in again');
    },
    async page(user, cursor) {
      let q = client.from('sync_records').select('*').eq('user_id', user).order('id', { ascending: true }).limit(500);
      if (cursor) q = q.gt('id', cursor);
      const { data, error } = await q;
      if (error) throw error; return data;
    },
    async write(user, record, sent) {
      const { data, error } = await client.rpc('sync_write', { p_id:record.id,p_kind:record.kind,p_payload:sent.payload,p_deleted:sent.deleted,p_base:sent.base,p_operation:sent.op,p_user:user });
      if (error) throw error;
      if (data.user_id !== user) throw new Error('Session changed');
      return data;
    }
  };
}
