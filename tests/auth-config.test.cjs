const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const {
  publicAuthConfig,
  createHandler,
} = require("../netlify/functions/auth-config.js");
const {
  nativeCallback,
  writeAssociation,
} = require("../scripts/app-links.cjs");
const configured = {
  AUTH_WEB_CALLBACK_URL: "https://app.example.invalid/auth/oauth-callback.html",
  AUTH_NATIVE_CALLBACK_URL:
    "https://app.example.invalid/auth/native-callback.html",
  GOOGLE_WEB_FLOW_VALIDATED: "true",
  GOOGLE_ANDROID_FLOW_VALIDATED: "true",
  AUTH_ROLLOUT_VALIDATED: "true",
  AUTH_REQUIRE_ACCOUNTS: "true",
  SUPABASE_URL: "https://project.example.invalid",
  SUPABASE_PUBLISHABLE_KEY: "public-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "SECRET-NEVER-EXPOSE",
};
const event = { httpMethod: "GET", headers: {} };
test("default configuration does not expose Google or require accounts", async () => {
  let called = false;
  const r = await createHandler({ env: {}, fetcher: () => (called = true) })(
    event,
  );
  assert.equal(r.statusCode, 200);
  const b = JSON.parse(r.body);
  assert.equal(b.requireAccounts, false);
  assert.equal(b.googleWebEnabled, false);
  assert.equal(b.googleAndroidEnabled, false);
  assert.equal(called, false);
});
test("each owner acceptance gate is required; web and native must share a trusted origin", () => {
  assert.equal(publicAuthConfig(configured).requireAccounts, true);
  for (const key of [
    "GOOGLE_WEB_FLOW_VALIDATED",
    "GOOGLE_ANDROID_FLOW_VALIDATED",
    "AUTH_ROLLOUT_VALIDATED",
    "AUTH_REQUIRE_ACCOUNTS",
  ])
    assert.equal(
      publicAuthConfig({ ...configured, [key]: "false" }).requireAccounts,
      false,
      key,
    );
  const b = publicAuthConfig({
    ...configured,
    AUTH_NATIVE_CALLBACK_URL:
      "https://other.example.invalid/auth/native-callback.html",
  });
  assert.equal(b.nativeCallback, null);
  assert.equal(b.nativeValidated, false);
  assert.equal(b.requireAccounts, false);
});
test("rejects unsafe callback variants rather than broad allowlists", () => {
  for (const value of [
    "http://app.example.invalid/auth/oauth-callback.html",
    "https://x:secret@app.example.invalid/auth/oauth-callback.html",
    "https://app.example.invalid:8443/auth/oauth-callback.html",
    "https://app.example.invalid/",
    "https://app.example.invalid/auth/oauth-callback.html?x=1",
    "https://app.example.invalid/auth/oauth-callback.html#x",
  ])
    assert.equal(
      publicAuthConfig({ ...configured, AUTH_WEB_CALLBACK_URL: value })
        .webValidated,
      false,
      value,
    );
});
test("queries actual Supabase Google availability with only the public key, never leaks service key", async () => {
  for (const enabled of [false, true]) {
    let calls = 0;
    const r = await createHandler({
      env: configured,
      fetcher: async (url, opts) => {
        calls++;
        assert.equal(url, "https://project.example.invalid/auth/v1/settings");
        assert.equal(opts.headers.apikey, "public-fixture");
        return Response.json({ external: { google: enabled } });
      },
    })(event);
    const b = JSON.parse(r.body);
    assert.equal(calls, 1);
    assert.equal(b.googleWebEnabled, enabled);
    assert.equal(b.googleAndroidEnabled, enabled);
    assert.ok(!r.body.includes("SECRET"));
    assert.equal(r.headers["Cache-Control"], "no-store");
  }
});
test("provider failure cannot make Google functional; cross-origin request rejected", async () => {
  let r = await createHandler({
    env: configured,
    fetcher: async () => {
      throw Error("unreachable");
    },
  })(event);
  assert.equal(r.statusCode, 503);
  assert.ok(!r.body.includes("SECRET"));
  r = await createHandler({ env: configured, fetcher: () => assert.fail() })({
    httpMethod: "GET",
    headers: { host: "app.example.invalid", origin: "https://evil.invalid" },
  });
  assert.equal(r.statusCode, 403);
  r = await createHandler({
    env: configured,
    fetcher: async () => new Response("", { status: 503 }),
  })(event);
  assert.equal(JSON.parse(r.body).googleWebEnabled, false);
});
test("native App Links are exact HTTPS and association requires owner ID/certificates", () => {
  assert.equal(nativeCallback(undefined), null);
  assert.equal(
    nativeCallback(configured.AUTH_NATIVE_CALLBACK_URL).pathname,
    "/auth/native-callback.html",
  );
  for (const value of [
    "ambrosia://callback",
    "https://app.example.invalid/",
    "https://app.example.invalid/auth/native-callback.html?x=1",
    "https://app.example.invalid:8443/auth/native-callback.html",
  ])
    assert.throws(() => nativeCallback(value));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ambrosia-links-"));
  try {
    writeAssociation(out, {});
    assert.equal(fs.existsSync(path.join(out, ".well-known")), false);
    writeAssociation(out, configured);
    assert.equal(fs.existsSync(path.join(out, ".well-known")), false);
    assert.throws(() =>
      writeAssociation(out, {
        ...configured,
        GOOGLE_PLAY_APPLICATION_ID: "org.example.fixture",
      }),
    );
    const fingerprint = Array(32).fill("AB").join(":");
    writeAssociation(out, {
      ...configured,
      GOOGLE_PLAY_APPLICATION_ID: "org.example.fixture",
      ANDROID_APP_LINK_CERT_SHA256: fingerprint,
    });
    const doc = JSON.parse(
      fs.readFileSync(path.join(out, ".well-known/assetlinks.json")),
    );
    assert.equal(doc[0].target.package_name, "org.example.fixture");
    assert.deepEqual(doc[0].target.sha256_cert_fingerprints, [fingerprint]);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("Android filter regeneration is exact, idempotent and reversible", () => {
  const { androidIntentFilter } = require("../scripts/app-links.cjs");
  const xml = "<manifest><activity></activity></manifest>",
    url = nativeCallback(configured.AUTH_NATIVE_CALLBACK_URL);
  const updated = androidIntentFilter(xml, url);
  assert.equal(androidIntentFilter(updated, url), updated);
  assert.ok(updated.includes('android:autoVerify="true"'));
  assert.ok(
    updated.includes(
      'android:host="app.example.invalid" android:path="/auth/native-callback.html"',
    ),
  );
  assert.ok(!updated.includes("pathPrefix"));
  assert.ok(!updated.includes('android:scheme="ambrosia"'));
  assert.equal(androidIntentFilter(updated, null), xml);
  assert.throws(() =>
    nativeCallback("https://host&invalid/auth/native-callback.html"),
  );
});
