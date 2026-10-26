import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localDay,
  shiftDay,
  validDay,
  checkinId,
  makeCheckin,
  makeEpisode,
  statistics,
  episodeEntries,
} from "../js/wellness/model.js";
import {
  prepareContext,
  contextMarkdown,
  contextCSV,
} from "../js/wellness/context.js";
import { SyncStore } from "../js/sync/store.js";
import { SyncEngine } from "../js/sync/engine.js";
import { ChatStore } from "../js/companion/store.js";
class Memory {
  data = new Map();
  getItem(k) {
    return this.data.get(k) || null;
  }
  setItem(k, v) {
    this.data.set(k, v);
  }
}
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const values = {
  feeling: 4,
  mood: 3,
  energy: 4,
  sleep: 2,
  note: "a healthy day",
};
const e = (id = crypto.randomUUID(), date = "2026-10-25") => ({
  id,
  date,
  time: "12:00",
  timestamp: date + "T12:00:00Z",
  symptoms: ["fatigue"],
  intensity: 3,
  triggers: [],
  notes: "private note",
});
class Server {
  rows = new Map();
  async checkUser() {}
  async page(user, cursor) {
    return structuredClone(
      [...this.rows.values()]
        .filter((r) => r.user_id === user && (!cursor || r.id > cursor))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 500),
    );
  }
  async write(user, r, s) {
    const old = this.rows.get(user + r.id);
    if (old && old.version !== s.base) return structuredClone(old);
    const row = {
      user_id: user,
      id: r.id,
      kind: r.kind,
      payload: s.payload,
      deleted: s.deleted,
      version: (old?.version || 0) + 1,
      operation_id: s.op,
    };
    this.rows.set(user + r.id, row);
    return structuredClone(row);
  }
}
const device = (server, user = A, storage = new Memory()) => {
  const store = new SyncStore(storage, user);
  return { store, storage, engine: new SyncEngine(store, server) };
};
test("local calendar labels and shifts cross UTC and DST boundaries without UTC day drift", () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(localDay(new Date("2026-03-09T01:30:00Z")), "2026-03-08");
    assert.equal(shiftDay("2026-03-08", 1), "2026-03-09");
    assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
  } finally {
    process.env.TZ = old;
  }
  assert.ok(validDay("2028-02-29"));
  assert.ok(!validDay("2026-02-29"));
});
test("check-in deterministic daily identity, edit and four validated dimensions", async () => {
  const a = await makeCheckin("2026-10-25", values),
    b = await makeCheckin("2026-10-25", { ...values, mood: 5 });
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, await checkinId("2026-10-26"));
  await assert.rejects(makeCheckin("2026-10-25", { ...values, energy: 0 }));
  const s = new SyncStore(new Memory(), A);
  s.put(a.id, "checkin", a);
  s.put(b.id, "checkin", b);
  assert.equal(s.records("checkin").length, 1);
  assert.equal(s.records("checkin")[0].mood, 5);
});
test("offline check-in reload, two-device synchronization, account isolation, conflicts and deletion", async () => {
  const server = new Server(),
    a = device(server),
    b = device(server);
  const c = await makeCheckin("2026-10-25", values);
  a.store.put(c.id, "checkin", c);
  const reloaded = device(server, A, a.storage);
  assert.equal(reloaded.store.records("checkin").length, 1);
  assert.equal(new SyncStore(a.storage, B).records("checkin").length, 0);
  await reloaded.engine.run();
  await b.engine.run();
  assert.equal(b.store.records("checkin")[0].note, c.note);
  reloaded.store.put(c.id, "checkin", { ...c, feeling: 5 });
  b.store.put(c.id, "checkin", { ...c, mood: 1 });
  await reloaded.engine.run();
  await b.engine.run();
  assert.equal(b.store.conflicts().length, 1);
  b.store.resolve(c.id, "local");
  await b.engine.run();
  await reloaded.engine.run();
  b.store.put(c.id, "checkin", b.store.records("checkin")[0], true);
  await b.engine.run();
  await reloaded.engine.run();
  assert.equal(reloaded.store.records("checkin").length, 0);
});
test("consent migration stages wellness with stable IDs and never overwrites interrupted edits", async () => {
  const guest = new SyncStore(new Memory());
  const c = await makeCheckin("2026-10-25", values);
  guest.put(c.id, "checkin", c);
  const account = new SyncStore(guest.storage, A);
  assert.equal(account.records("checkin").length, 0);
  await account.migrate([], {}, () => true, Object.values(guest.doc.records));
  account.put(c.id, "checkin", { ...c, note: "edited" });
  await account.migrate([], {}, () => true, Object.values(guest.doc.records));
  assert.equal(account.records("checkin")[0].note, "edited");
  assert.equal(guest.records("checkin")[0].note, "a healthy day");
});
test("episode lifecycle groups explicit observations, preserves legacy numeric IDs and validates recovery", () => {
  const episode = makeEpisode({
    title: "Recovery notes",
    startDate: "2026-10-20",
    endDate: null,
    status: "ongoing",
  });
  assert.throws(() => makeEpisode({ ...episode, status: "recovered" }));
  const recovered = makeEpisode(
    { ...episode, status: "recovered", endDate: "2026-10-25" },
    episode,
  );
  assert.equal(recovered.id, episode.id);
  const records = [e(123), { ...e(), episodeId: episode.id }];
  assert.equal(episodeEntries(episode, records).length, 1);
  const store = new SyncStore(new Memory());
  store.saveEntries(records);
  store.put(recovered.id, "episode", recovered);
  assert.equal(store.entries()[0].id, 123);
  assert.equal(store.records("episode")[0].status, "recovered");
});
test("weekly statistics use recorded days only; baseline requires 14 earlier observations", () => {
  const days = Array.from({ length: 21 }, (_, i) => ({
    ...values,
    date: shiftDay("2026-10-25", i - 20),
  }));
  const summary = statistics(days, [e()], { end: "2026-10-25" });
  assert.equal(summary.observedDays, 7);
  assert.equal(summary.dimensions.feeling.mean, 4);
  assert.equal(summary.dimensions.feeling.baseline, 4);
  assert.equal(summary.dimensions.feeling.baselineCount, 14);
  assert.equal(
    statistics(days.slice(1), [], { end: "2026-10-25" }).dimensions.feeling
      .baseline,
    null,
  );
  const sparse = statistics([days.at(-1)], [], { end: "2026-10-25" });
  assert.equal(sparse.missingDays, 6);
  assert.equal(sparse.dimensions.feeling.mean, 4);
});
test("context engine bounds multi-year histories, reports omissions and excludes notes unless approved", () => {
  const entries = Array.from({ length: 2000 }, (_, i) =>
    e("id-" + i, shiftDay("2026-10-25", -i)),
  );
  const context = prepareContext(
    { entries, checkins: [], episodes: [] },
    { period: "all" },
    "2026-10-25",
  );
  assert.equal(context.coverage.available, 2000);
  assert.ok(context.records.length <= 24);
  assert.ok(context.coverage.partial);
  assert.ok(!JSON.stringify(context).includes("private note"));
  assert.ok(JSON.stringify(context.records).length < 10000);
  assert.ok(contextMarkdown(context).includes("omitted"));
});
test("context selected dates, fields, symptoms, entries and episodes do not silently expand", async () => {
  const c = await makeCheckin("2026-10-25", values),
    ep = makeEpisode({
      title: "An episode",
      startDate: "2026-10-24",
      status: "ongoing",
    });
  const entries = [{ ...e("a"), episodeId: ep.id }, e("b", "2026-09-01")];
  const data = { entries, checkins: [c], episodes: [ep] };
  const one = prepareContext(
    data,
    { period: "all", entryIds: ["b"], fields: { notes: true } },
    "2026-10-25",
  );
  assert.equal(one.records.length, 1);
  assert.equal(one.records[0].id, "b");
  const selected = prepareContext(
    data,
    { period: "all", episodeIds: [ep.id] },
    "2026-10-25",
  );
  assert.ok(
    selected.records.every((r) => r.kind === "episode" || r.id === "a"),
  );
  const exact = prepareContext(
    data,
    {
      period: "all",
      startDate: "2026-10-25",
      endDate: "2026-10-25",
      fields: { sleep: false },
    },
    "2026-10-25",
  );
  assert.ok(
    exact.records.every((r) => r.date === "2026-10-25" || r.kind === "episode"),
  );
  assert.equal(
    exact.records.find((r) => r.kind === "checkin").payload.sleep,
    undefined,
  );
  assert.equal(exact.summary.dimensions.sleep, undefined);
});
test("CSV export quotes and neutralizes spreadsheet formulas, markdown/JSON preserve literal unsafe notes", () => {
  const context = prepareContext(
    {
      entries: [{ ...e(), notes: '=HYPERLINK("https://bad")' }],
      checkins: [],
      episodes: [],
    },
    { period: "7", fields: { notes: true } },
    "2026-10-25",
  );
  assert.ok(contextCSV(context).includes("'=HYPERLINK"));
  assert.ok(contextMarkdown(context).includes("HYPERLINK"));
});
test("conversation drafts and failed questions survive reload and stay isolated from journal/other accounts", () => {
  const memory = new Memory(),
    a = new ChatStore(memory, A),
    id = a.create("Test", { period: "7" });
  a.edit(id, { draft: "offline draft" });
  a.addQuestion(id, "Question that must persist", "request");
  a.fail(id, "request");
  const reload = new ChatStore(memory, A);
  assert.equal(reload.get(id).messages[0].state, "failed");
  assert.equal(
    reload.get(id).messages[0].content,
    "Question that must persist",
  );
  assert.equal(
    Object.keys(new ChatStore(memory, B).doc.conversations).length,
    0,
  );
  assert.throws(() =>
    reload.mergeConversation({ user_id: B, id, deleted: false }),
  );
  reload.mergeConversation({ user_id: A, id, deleted: true });
  assert.equal(reload.get(id), undefined);
});
test("late chat callbacks cannot recreate a deleted account cache or overwrite another tab", () => {
  const m = new Memory(),
    old = new ChatStore(m, A),
    id = old.create("Private", {});
  old.addQuestion(id, "private draft", "r");
  m.data.delete(old.key);
  assert.throws(() => old.fail(id, "r"), /CHAT_STORAGE_CHANGED/);
  assert.equal(m.getItem(old.key), null);
  const first = new ChatStore(m, A),
    cid = first.create("New", {}),
    second = new ChatStore(m, A);
  first.edit(cid, { draft: "newer" });
  assert.throws(
    () => second.edit(cid, { draft: "stale" }),
    /CHAT_STORAGE_CHANGED/,
  );
});
test("a later consented guest check-in edit becomes a conflict rather than being skipped or overwriting account edits", async () => {
  const s = new SyncStore(new Memory(), A),
    c = await makeCheckin("2026-10-25", values),
    record = { id: c.id, kind: "checkin", payload: c };
  await s.migrate([], {}, () => true, [record]);
  s.put(c.id, "checkin", { ...c, note: "account edit" });
  await s.migrate([], {}, () => true, [
    { ...record, payload: { ...c, note: "later guest edit" } },
  ]);
  assert.equal(s.conflicts().length, 1);
  assert.equal(s.conflicts()[0].payload.note, "later guest edit");
  assert.equal(s.conflicts()[0].conflict.payload.note, "account edit");
});
test("chat quota/storage failures preserve the last committed draft and never overwrite malformed storage", () => {
  const m = new Memory(),
    s = new ChatStore(m, A),
    id = s.create("Saved", {});
  s.edit(id, { draft: "retained" });
  const before = m.getItem(s.key),
    set = m.setItem;
  m.setItem = () => {
    throw Error("QuotaExceeded");
  };
  assert.throws(() => s.addQuestion(id, "not persisted", "r"), /Quota/);
  assert.equal(m.getItem(s.key), before);
  assert.equal(s.get(id).draft, "retained");
  m.setItem = set;
  m.setItem(s.key, "{bad-json");
  assert.throws(() => new ChatStore(m, A));
  assert.equal(m.getItem(s.key), "{bad-json");
});
