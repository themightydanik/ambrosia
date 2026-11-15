import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { GooglePKCE } from "../js/auth/pkce.js";
import { generationKey, intentKey } from "../js/auth/coordination.js";
const callback = "https://app.example.invalid/auth/oauth-callback.html";
const code = "11111111-1111-4111-8111-111111111111";
const user = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email_confirmed_at: "2026-01-01",
  identities: [
    {
      provider: "google",
      identity_data: { sub: "google-fixture", email_verified: true },
    },
  ],
};
const session = {
  access_token: "fixture-access",
  refresh_token: "fixture-refresh",
  user,
};
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};
async function fixture(overrides = {}) {
  let now = 1000000;
  const calls = [],
    store = storage();
  const flow = new GooglePKCE({
    storage: store,
    cryptoProvider: webcrypto,
    clock: () => now,
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json(url.includes("/token?") ? session : user);
    },
    ...overrides,
  });
  const started = await flow.begin({
    supabaseUrl: "https://project.example.invalid",
    key: "public-fixture",
    callback,
    platform: "web",
  });
  const url = new URL(callback);
  url.searchParams.set("nonce", started.transaction.nonce);
  url.searchParams.set("code", code);
  return { flow, store, calls, started, url, advance: (ms) => (now += ms) };
}
test("PKCE uses S256, a random verifier/nonce, and leaves provider state to GoTrue", async () => {
  const f = await fixture(),
    other = await fixture();
  const url = new URL(f.started.url),
    tx = f.started.transaction;
  assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.equal(url.searchParams.get("scopes"), "openid");
  assert.equal(url.searchParams.has("state"), false);
  assert.equal(url.searchParams.get("prompt"), "select_account");
  assert.equal(tx.verifier.length, 64);
  assert.equal(tx.nonce.length, 64);
  assert.notEqual(tx.verifier, other.started.transaction.verifier);
  const digest = Buffer.from(
    await webcrypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(tx.verifier),
    ),
  ).toString("base64url");
  assert.equal(url.searchParams.get("code_challenge"), digest);
  assert.ok(
    new URL(url.searchParams.get("redirect_to")).searchParams.get("nonce"),
  );
});
test("exchange verifies server identity before returning session, consumes code once, and never writes SDK sessions", async () => {
  const f = await fixture();
  const result = await f.flow.exchange(f.url.href, callback, "web");
  assert.equal(result.user.id, user.id);
  assert.equal(f.calls.length, 2);
  assert.equal(f.flow.read().claimed, true);
  assert.deepEqual(JSON.parse(f.calls[0].options.body), {
    auth_code: code,
    code_verifier: f.started.transaction.verifier,
  });
  assert.equal(
    f.calls[1].options.headers.Authorization,
    "Bearer fixture-access",
  );
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_CALLBACK/,
  );
  assert.equal(f.calls.length, 2);
  f.flow.finish(result.transaction);
  assert.equal(f.flow.read(), null);
  assert.equal(f.store.getItem("sb-session"), null);
});
for (const [name, mutate] of Object.entries({
  origin: (u) => (u.hostname = "evil.example.invalid"),
  path: (u) => (u.pathname = "/auth/native-callback.html"),
  fragment: (u) => (u.hash = "access_token=fixture"),
  userinfo: (u) => (u.username = "evil"),
  nonce: (u) => u.searchParams.set("nonce", "wrong"),
  duplicate: (u) => u.searchParams.append("code", code),
  unknown: (u) => u.searchParams.set("redirect_to", "https://evil.invalid"),
  nonUUID: (u) => u.searchParams.set("code", "opaque"),
  mixed: (u) => u.searchParams.set("error", "access_denied"),
  orphanError: (u) => u.searchParams.set("error_description", "leftover"),
}))
  test("rejects callback " + name + " before exchange", async () => {
    const f = await fixture();
    mutate(f.url);
    await assert.rejects(
      f.flow.exchange(f.url.href, callback, "web"),
      /OAUTH_CALLBACK/,
    );
    assert.equal(f.calls.length, 0);
  });
test("rejects platform mismatch and expired/backward clock transactions", async () => {
  for (const mode of ["platform", "expired", "backward"]) {
    const f = await fixture();
    if (mode === "expired") f.advance(600000);
    if (mode === "backward") f.advance(-1);
    await assert.rejects(
      f.flow.exchange(
        f.url.href,
        callback,
        mode === "platform" ? "android" : "web",
      ),
      /OAUTH_CALLBACK/,
    );
    assert.equal(f.calls.length, 0);
  }
});
test("provider cancellation consumes pending intent without touching journal originals", async () => {
  const f = await fixture();
  f.store.setItem("ambrosia_entries", "original bytes");
  f.url.searchParams.delete("code");
  f.url.searchParams.set("error", "access_denied");
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_CANCELLED/,
  );
  assert.equal(f.flow.read(), null);
  assert.equal(f.store.getItem("ambrosia_entries"), "original bytes");
  assert.equal(f.calls.length, 0);
});
test("process restart can resume unclaimed PKCE intent but not an uncertain exchange", async () => {
  const f = await fixture();
  const resumed = new GooglePKCE({
    storage: f.store,
    cryptoProvider: webcrypto,
    clock: () => 1000000,
    fetcher: async () => {
      throw Error("network lost");
    },
  });
  await assert.rejects(
    resumed.exchange(f.url.href, callback, "web"),
    /network lost/,
  );
  const restarted = new GooglePKCE({
    storage: f.store,
    cryptoProvider: webcrypto,
    clock: () => 1000000,
    fetcher: () => assert.fail("must not retry"),
  });
  await assert.rejects(
    restarted.exchange(f.url.href, callback, "web"),
    /OAUTH_CALLBACK/,
  );
});
test("A → B → A generation changes invalidate even an otherwise matching callback", async () => {
  const f = await fixture();
  f.store.setItem(generationKey, "B");
  f.store.setItem(generationKey, "A-new-generation");
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_CALLBACK/,
  );
  assert.equal(f.calls.length, 0);
});
test("cancellation or account switch while network is pending never returns a session", async () => {
  const store = storage();
  let count = 0;
  const f = await fixture({
    storage: store,
    fetcher: async () => {
      count++;
      store.setItem(generationKey, "changed");
      return Response.json(session);
    },
  });
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_STALE/,
  );
  assert.equal(count, 1);
});
for (const [name, mutate] of Object.entries({
  unconfirmed: (u) => delete u.email_confirmed_at,
  emailOnly: (u) => (u.identities = [{ provider: "email" }]),
  unverifiedGoogle: (u) =>
    (u.identities[0].identity_data.email_verified = false),
  stringVerified: (u) =>
    (u.identities[0].identity_data.email_verified = "true"),
  missingSubject: (u) => delete u.identities[0].identity_data.sub,
  wrongUser: (u) => (u.id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
}))
  test(
    "refuses " + name + " identity even after successful token response",
    async () => {
      const other = structuredClone(user);
      mutate(other);
      let count = 0;
      const f = await fixture({
        fetcher: async () => Response.json(++count === 1 ? session : other),
      });
      await assert.rejects(
        f.flow.exchange(f.url.href, callback, "web"),
        /OAUTH_IDENTITY/,
      );
      assert.equal(count, 2);
      assert.equal(f.flow.read().claimed, true);
    },
  );
test("new transaction replaces an old callback; blocked storage fails before launch", async () => {
  const f = await fixture();
  await f.flow.begin({
    supabaseUrl: "https://project.example.invalid",
    key: "public-fixture",
    callback,
    platform: "web",
  });
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_CALLBACK/,
  );
  await assert.rejects(
    fixture({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw Error("blocked");
        },
      },
    }),
    /blocked/,
  );
});
test("rejects malformed stored intent and insecure Supabase endpoint", async () => {
  const f = await fixture();
  f.store.setItem(intentKey, "{");
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_CALLBACK/,
  );
  for (const supabaseUrl of [
    "http://example.invalid",
    "https://user@example.invalid",
    "https://example.invalid/path",
    "https://example.invalid?key=bad",
  ])
    await assert.rejects(
      f.flow.begin({ supabaseUrl, key: "fixture", callback, platform: "web" }),
      /OAUTH_CONFIG/,
    );
});

import { hasDeviceJournal } from "../js/auth/device-records.js";
test("device recovery detects malformed originals, deleted records and archives without other account access", () => {
  for (const raw of ["{", "{}", "null", '"corrupt"', "[{}]"]) {
    const s = storage();
    s.setItem("ambrosia_entries", raw);
    assert.equal(hasDeviceJournal(s), true);
    assert.equal(s.getItem("ambrosia_entries"), raw);
  }
  for (const doc of [
    { records: null },
    { records: { x: { kind: "entry", deleted: true } } },
    { records: {}, archives: [{ original: "retained" }] },
  ]) {
    const s = storage();
    s.setItem("ambrosia_sync_v2:guest", JSON.stringify(doc));
    assert.equal(hasDeviceJournal(s), true);
  }
  const s = storage();
  s.setItem("ambrosia_entries", "[]");
  s.setItem("ambrosia_sync_v2:another-account", "private");
  assert.equal(hasDeviceJournal(s), false);
  assert.equal(
    hasDeviceJournal({
      getItem: () => {
        throw Error("blocked");
      },
    }),
    true,
  );
});

import {
  invalidateAuthIntent,
  authGeneration,
} from "../js/auth/coordination.js";
test("quota errors cannot prevent auth invalidation or leave a current-document intent valid", async () => {
  const f = await fixture();
  const original = f.flow.read();
  f.store.setItem = () => {
    throw Error("quota");
  };
  assert.doesNotThrow(() => invalidateAuthIntent(f.store));
  assert.equal(f.flow.read(), null);
  assert.equal(f.flow.valid(original), false);
  const blocked = {
    getItem: () => "old",
    setItem: () => {
      throw Error("blocked");
    },
    removeItem: () => {
      throw Error("blocked");
    },
  };
  assert.doesNotThrow(() => invalidateAuthIntent(blocked));
  assert.notEqual(authGeneration(blocked), "old");
});

test("matching missing user IDs are not a verified identity", async () => {
  const missing = structuredClone(user);
  delete missing.id;
  let calls = 0;
  const f = await fixture({
    fetcher: async () =>
      Response.json(++calls === 1 ? { ...session, user: {} } : missing),
  });
  await assert.rejects(
    f.flow.exchange(f.url.href, callback, "web"),
    /OAUTH_IDENTITY/,
  );
});
