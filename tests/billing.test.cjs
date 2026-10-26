const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  snapshot,
  billingConfig,
  authorizeWebhook,
  reconcile,
} = require("../netlify/functions/lib/billing.js");
const session =
  require("../netlify/functions/billing-session.js").createHandler;
const refresh =
  require("../netlify/functions/billing-refresh.js").createHandler;
const webhook =
  require("../netlify/functions/revenuecat-webhook.js").createHandler;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  RC = "rc_" + A;
// Synthetic fixtures, never owner product IDs or credentials.
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-fixture",
  REVENUECAT_SECRET_API_KEY: "sk_fixture",
  REVENUECAT_ANDROID_PUBLIC_KEY: "goog_fixture",
  REVENUECAT_PRODUCT_IDS: "fixture_month,fixture_year",
  REVENUECAT_ENTITLEMENT_ID: "fixture_premium",
  REVENUECAT_OFFERING_ID: "fixture_offering",
  REVENUECAT_ENVIRONMENT: "SANDBOX",
  REVENUECAT_WEBHOOK_AUTH: "Bearer fixture-only-long-secret-at-least-32-bytes",
};
const cfg = billingConfig(env),
  now = Date.now(),
  future = new Date(now + 86400000).toISOString(),
  past = new Date(now - 86400000).toISOString();
function provider(overrides = {}) {
  return {
    request_date_ms: now,
    subscriber: {
      original_app_user_id: RC,
      entitlements: {
        fixture_premium: {
          product_identifier: "fixture_month",
          expires_date: future,
        },
      },
      subscriptions: {
        fixture_month: {
          store: "play_store",
          is_sandbox: true,
          expires_date: future,
          store_transaction_id: "GPA.1234-5678-1234-12345..0",
          period_type: "normal",
          ...overrides,
        },
      },
    },
  };
}
const event = (body = {}, extra = {}) => ({
  httpMethod: "POST",
  headers: {
    host: "example.test",
    origin: "https://example.test",
    authorization: "Bearer valid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
  ...extra,
});
function service(options = {}) {
  const calls = [],
    events = new Set();
  let completed = false,
    active = false,
    applyCount = 0;
  const fetcher = async (url, init = {}) => {
    calls.push({ url, init });
    assert.ok(init.signal);
    assert.equal(init.redirect, "error");
    const p = init.body ? JSON.parse(init.body) : {};
    let value;
    if (url.endsWith("/auth/v1/user"))
      value = { id: A, email_confirmed_at: "2026-01-01" };
    else if (url.includes("api.revenuecat.com")) {
      if (options.outage) throw Error("private-key-error");
      value = options.data || provider();
      assert.equal(init.headers.Authorization, "Bearer sk_fixture");
    } else if (url.endsWith("/billing_identity"))
      value = { user_id: A, app_user_id: RC };
    else if (url.endsWith("/billing_start"))
      value = {
        acquired: !options.busy,
        account: {
          user_id: A,
          app_user_id: RC,
          generation: 1,
          checked_at: options.busy ? "2026-01-01" : null,
          lease_until: options.busy ? future : null,
        },
      };
    else if (url.endsWith("/billing_apply")) {
      applyCount++;
      value = !p.p_error && !options.conflict;
      if (value) active = p.p_state === "active";
    } else if (url.endsWith("/account_status"))
      value = {
        userId: A,
        tier: active ? "premium" : "free",
        limit: active ? 60 : 3,
      };
    else if (url.endsWith("/billing_event_receive")) {
      events.add(p.p_id);
      value = { completed };
    } else if (url.includes("/billing_accounts?")) value = [{ user_id: A }];
    else if (url.includes("/billing_events?")) {
      completed = true;
      return new Response(null, { status: 204 });
    } else throw Error("Unexpected URL " + url);
    return new Response(JSON.stringify(value), { status: 200 });
  };
  return {
    fetcher,
    calls,
    events,
    get applyCount() {
      return applyCount;
    },
  };
}
test("verified Play initial purchase, renewal and immutable order-root fingerprints", () => {
  const a = snapshot(provider(), RC, cfg, now),
    b = snapshot(
      provider({ store_transaction_id: "GPA.1234-5678-1234-12345..6" }),
      RC,
      cfg,
      now,
    );
  assert.equal(a.state, "active");
  assert.deepEqual(a.transactions, b.transactions);
  assert.equal(a.transactions[0].length, 64);
});
test("cancellation keeps paid access, trial, refund, expiry and grace reflect verified provider state", () => {
  assert.equal(
    snapshot(provider({ unsubscribe_detected_at: past }), RC, cfg, now).state,
    "cancelled",
  );
  assert.equal(
    snapshot(provider({ period_type: "trial" }), RC, cfg, now).state,
    "trial",
  );
  assert.equal(
    snapshot(provider({ refunded_at: past }), RC, cfg, now).state,
    "expired",
  );
  const expired = provider({ expires_date: past });
  expired.subscriber.entitlements.fixture_premium.expires_date = past;
  assert.equal(snapshot(expired, RC, cfg, now).state, "expired");
  expired.subscriber.subscriptions.fixture_month.grace_period_expires_date =
    future;
  assert.equal(snapshot(expired, RC, cfg, now).state, "active");
});
test("unknown ownership, client-created grants, wrong store, environment and product fail closed", () => {
  const wrong = provider();
  wrong.subscriber.original_app_user_id = "attacker";
  assert.throws(() => snapshot(wrong, RC, cfg, now), /IDENTITY/);
  for (const change of [
    { store: "promotional" },
    { store: "app_store" },
    { is_sandbox: false },
    { store_transaction_id: null },
  ])
    assert.throws(() => snapshot(provider(change), RC, cfg, now));
  const unknown = provider();
  unknown.subscriber.entitlements.fixture_premium.product_identifier =
    "unconfigured";
  assert.throws(() => snapshot(unknown, RC, cfg, now), /PRODUCT/);
  const stale = provider();
  stale.request_date_ms = now - 600000;
  assert.throws(() => snapshot(stale, RC, cfg, now));
});
test("session returns opaque identity and public config only; web/native auth and preflight remain protected", async () => {
  const s = service(),
    handler = session({ env, fetcher: s.fetcher });
  const r = await handler(event({}, { httpMethod: "GET" }));
  assert.equal(r.statusCode, 200);
  assert.equal(JSON.parse(r.body).appUserId, RC);
  assert.ok(!r.body.includes("sk_fixture"));
  assert.ok(!r.body.includes("service-fixture"));
  const e = event({}, { httpMethod: "GET" });
  e.headers.origin = "https://localhost";
  assert.equal((await handler(e)).statusCode, 200);
  e.headers.origin = "https://evil.test";
  assert.equal((await handler(e)).statusCode, 403);
  assert.equal(
    (await handler(event({}, { httpMethod: "OPTIONS" }))).statusCode,
    204,
  );
  e.headers.origin = "https://example.test";
  delete e.headers.authorization;
  assert.equal((await handler(e)).statusCode, 401);
});
test("purchase/restore confirmation ignores client flags and updates server plan before success", async () => {
  const s = service(),
    handler = refresh({ env, fetcher: s.fetcher });
  assert.equal(
    (await handler(event({ userId: A, premium: true }))).statusCode,
    409,
  );
  assert.equal(s.applyCount, 0);
  assert.equal((await handler(event({ userId: B }))).statusCode, 409);
  const r = await handler(event({ userId: A }));
  assert.equal(r.statusCode, 200);
  assert.equal(JSON.parse(r.body).access.tier, "premium");
  assert.equal(JSON.parse(r.body).confirmed, true);
});
test("provider failure preserves entitlement and releases lease, explicit recovery succeeds", async () => {
  const s = service({ outage: true }),
    r = await refresh({ env, fetcher: s.fetcher })(event({ userId: A }));
  assert.equal(r.statusCode, 503);
  assert.ok(!r.body.includes("private-key"));
  assert.ok(
    s.calls.some(
      (c) => c.url.endsWith("billing_apply") && JSON.parse(c.init.body).p_error,
    ),
  );
  const good = service();
  assert.equal((await reconcile(A, env, good.fetcher, true)).confirmed, true);
});
function notification(type = "RENEWAL", id = "fixture-event") {
  return {
    api_version: "1.0",
    event: {
      id,
      type,
      app_user_id: RC,
      original_app_user_id: RC,
      environment: "SANDBOX",
      event_timestamp_ms: now,
    },
  };
}
function hook(payload = notification()) {
  const e = event(payload);
  e.headers.authorization = env.REVENUECAT_WEBHOOK_AUTH;
  delete e.headers.origin;
  return e;
}
test("webhook authorization fails before any DB/provider operation; missing config never grants", async () => {
  const s = service();
  assert.equal(
    (await webhook({ env, fetcher: s.fetcher })(event(notification())))
      .statusCode,
    401,
  );
  assert.equal(s.calls.length, 0);
  assert.throws(() =>
    authorizeWebhook(hook(), { ...env, REVENUECAT_WEBHOOK_AUTH: "" }),
  );
  assert.throws(() =>
    billingConfig({ ...env, REVENUECAT_SECRET_API_KEY: "goog_not_secret" }),
  );
});
test("duplicate delivery completes once; late expiration uses current server snapshot instead of event fields", async () => {
  const s = service(),
    handler = webhook({ env, fetcher: s.fetcher }),
    e = hook(notification("EXPIRATION"));
  assert.equal((await handler(e)).statusCode, 200);
  assert.equal((await handler(e)).statusCode, 200);
  assert.equal(s.applyCount, 1);
  assert.equal(s.events.size, 1);
  const applied = s.calls.find((c) => c.url.endsWith("billing_apply"));
  assert.equal(JSON.parse(applied.init.body).p_state, "active");
});
test("in-flight verification and ownership conflicts never acknowledge event as processed", async () => {
  for (const options of [
    { busy: true },
    { conflict: true },
    { outage: true },
  ]) {
    const s = service(options),
      r = await webhook({ env, fetcher: s.fetcher })(hook());
    assert.ok(r.statusCode >= 400);
    assert.ok(!s.calls.some((c) => c.url.includes("/billing_events?")));
  }
});
test("sandbox webhooks cannot touch production, transfer reconciles both sides without client grants", async () => {
  const s = service(),
    bad = notification();
  bad.event.environment = "PRODUCTION";
  assert.equal(
    (await webhook({ env, fetcher: s.fetcher })(hook(bad))).statusCode,
    409,
  );
  assert.equal(s.calls.length, 0);
  const transfer = notification("TRANSFER");
  delete transfer.event.app_user_id;
  delete transfer.event.original_app_user_id;
  transfer.event.transferred_from = [RC];
  transfer.event.transferred_to = ["rc_" + B];
  assert.equal(
    (await webhook({ env, fetcher: s.fetcher })(hook(transfer))).statusCode,
    200,
  );
  assert.equal(
    s.calls.filter((c) => c.url.includes("/billing_accounts?")).length,
    2,
  );
});
