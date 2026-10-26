export class ChatStore {
  constructor(storage, user, { writable = true } = {}) {
    this.writable = writable;
    this.storage = storage;
    this.user = user;
    this.key = `ambrosia_chat_v1:${user || "guest"}`;
    this.serialized = storage.getItem(this.key);
    this.doc = JSON.parse(
      this.serialized || '{"conversations":{},"active":null}',
    );
    if (!this.doc.conversations) throw Error("INVALID_CHAT_STORAGE");
  }
  commit(change) {
    if (!this.writable) throw Error("READ_ONLY");
    if (this.storage.getItem(this.key) !== this.serialized)
      throw Error("CHAT_STORAGE_CHANGED");
    const next = structuredClone(this.doc);
    change(next);
    const serialized = JSON.stringify(next);
    this.storage.setItem(this.key, serialized);
    this.serialized = serialized;
    this.doc = next;
  }
  create(title, config) {
    const id = crypto.randomUUID();
    this.commit((d) => {
      d.conversations[id] = {
        id,
        title,
        config,
        draft: "",
        messages: [],
        dirty: true,
        created_at: new Date().toISOString(),
      };
      d.active = id;
    });
    return id;
  }
  select(id) {
    this.commit((d) => {
      d.active = id;
    });
  }
  get(id = this.doc.active) {
    return this.doc.conversations[id];
  }
  edit(id, change) {
    this.commit((d) => {
      if (d.conversations[id]) Object.assign(d.conversations[id], change);
    });
  }
  mergeConversation(row) {
    if (row.user_id !== this.user) throw Error("CROSS_ACCOUNT");
    this.commit((d) => {
      if (row.deleted) {
        delete d.conversations[row.id];
        if (d.active === row.id) d.active = null;
        return;
      }
      const old = d.conversations[row.id];
      d.conversations[row.id] = {
        id: row.id,
        title: row.title,
        config: row.context_config,
        draft: "",
        messages: [],
        created_at: row.created_at,
        ...old,
        ...(!old?.dirty
          ? { title: row.title, config: row.context_config }
          : {}),
        remote: true,
      };
    });
  }
  mergeMessages(id, rows) {
    if (rows.some((r) => r.user_id !== this.user || r.conversation_id !== id))
      throw Error("CROSS_ACCOUNT");
    this.commit((d) => {
      const c = d.conversations[id];
      if (!c) return;
      const map = new Map(
        c.messages.map((m) => [m.request_id + ":" + m.role, m]),
      );
      for (const r of rows) map.set(r.request_id + ":" + r.role, r);
      c.messages = [...map.values()].sort((a, b) =>
        a.sequence && b.sequence
          ? a.sequence - b.sequence
          : String(a.created_at).localeCompare(String(b.created_at)),
      );
    });
  }
  addQuestion(id, content, requestId) {
    this.commit((d) => {
      const c = d.conversations[id];
      c.messages.push({
        request_id: requestId,
        role: "user",
        content,
        state: "sending",
        created_at: new Date().toISOString(),
      });
      c.draft = "";
    });
  }
  fail(id, requestId) {
    this.commit((d) => {
      const c = d.conversations[id];
      const m = c?.messages.find(
        (m) => m.request_id === requestId && m.role === "user",
      );
      if (m && m.state !== "completed") m.state = "failed";
    });
  }
  remove(id) {
    this.commit((d) => {
      delete d.conversations[id];
      if (d.active === id) d.active = null;
    });
  }
}
