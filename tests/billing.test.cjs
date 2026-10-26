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
  REVENUECAT_PROJECT_ID: "projfixture",
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
  past = new Date(now - 86400000).toISOString(),
  purchased = new Date(now - 7 * 86400000).toISOString();
function provider(overrides = {}) {
  return {
    request_date_ms: now,
    subscriber: {
      original_app_user_id: RC,
      entitlements: {
        fixture_premium: {
          product_identifier: "fixture_month",
          expires_date: future,
          purchase_date: purchased,
        },
      },
      subscriptions: {
        fixture_month: {
          store: "play_store",
          is_sandbox: true,
          expires_date: future,
          purchase_date: purchased,
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
      if (options.outage || (url.includes("/v2/") && options.v2Outage))
        throw Error("private-key-error");
      if (url.includes("/v2/") && options.v2Status)
        return new Response("{}", { status: options.v2Status });
      value = url.includes("/v2/")
        ? {
            object: "list",
            items: options.v2 || [graceProof()],
            next_page: options.v2Page || null,
          }
        : options.data || provider();
      assert.equal(
        init.headers.Authorization,
        "Bearer " +
          (url.includes("/v2/") ? options.v2Key || "sk_fixture" : "sk_fixture"),
      );
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
      if (value)
        active =
          ["active", "trial", "cancelled"].includes(p.p_state) &&
          Date.parse(p.p_until) > Date.now();
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
function graceProof() {
  return {
    customer_id: RC,
    original_customer_id: RC,
    store: "play_store",
    environment: "sandbox",
    ownership: "purchased",
    store_subscription_identifier: "GPA.1234-5678-1234-12345..0",
    current_period_starts_at: Date.parse(purchased),
    current_period_ends_at: Date.parse(past),
    gives_access: true,
    status: "in_grace_period",
    entitlements: { items: [{ lookup_key: cfg.entitlement }] },
  };
}
function graceProvider() {
  const data = provider({
    expires_date: past,
    purchase_date: purchased,
    billing_issues_detected_at: past,
    grace_period_expires_date: future,
    unsubscribe_detected_at: past,
  });
  Object.assign(data.subscriber.entitlements.fixture_premium, {
    expires_date: past,
    purchase_date: purchased,
    grace_period_expires_date: future,
  });
  return data;
}
function parts(data) {
  return {
    entitlement: data.subscriber.entitlements.fixture_premium,
    sub: data.subscriber.subscriptions.fixture_month,
  };
}
test("cancellation and billing issues preserve only the confirmed paid period; trial remains supported", () => {
  for (const changes of [
    { unsubscribe_detected_at: past },
    { billing_issues_detected_at: past },
    { refunded_at: past },
  ]) {
    const result = snapshot(provider(changes), RC, cfg, now);
    assert.equal(result.until, future);
    assert.equal(
      result.state,
      changes.unsubscribe_detected_at ? "cancelled" : "active",
    );
  }
  assert.equal(
    snapshot(provider({ period_type: "trial" }), RC, cfg, now).state,
    "trial",
  );
});
test("grace requires matching current-period proof and an unresolved billing issue, including cancellation", () => {
  const data = graceProvider(),
    result = snapshot(data, RC, cfg, now, [graceProof()]);
  assert.equal(result.state, "cancelled");
  assert.equal(result.until, future);
  delete parts(data).sub.unsubscribe_detected_at;
  assert.equal(snapshot(data, RC, cfg, now, [graceProof()]).state, "active");
  // A potential grace is not granted in advance of the paid period ending.
  const before = provider({
    billing_issues_detected_at: past,
    grace_period_expires_date: new Date(now + 2 * 86400000).toISOString(),
  });
  parts(before).entitlement.grace_period_expires_date =
    parts(before).sub.grace_period_expires_date;
  assert.equal(snapshot(before, RC, cfg, now).until, future);
});
const noGraceCases = [
  [
    "no unresolved billing issue",
    ({ sub }) => delete sub.billing_issues_detected_at,
  ],
  [
    "resolved billing issue",
    ({ sub }) => (sub.billing_issues_detected_at = null),
  ],
  [
    "malformed billing issue",
    ({ sub }) => (sub.billing_issues_detected_at = "not-a-date"),
  ],
  [
    "future billing issue",
    ({ sub }) => (sub.billing_issues_detected_at = future),
  ],
  [
    "issue after provider snapshot",
    ({ sub }, data) => {
      data.request_date_ms = now - 1000;
      sub.billing_issues_detected_at = new Date(now - 500).toISOString();
    },
  ],
  [
    "issue from previous period",
    ({ sub }) =>
      (sub.billing_issues_detected_at = new Date(
        Date.parse(purchased) - 1000,
      ).toISOString()),
  ],
  [
    "subscription-only grace",
    ({ entitlement }) => delete entitlement.grace_period_expires_date,
  ],
  ["entitlement-only grace", ({ sub }) => delete sub.grace_period_expires_date],
  [
    "disagreeing grace ends",
    ({ entitlement }) =>
      (entitlement.grace_period_expires_date = new Date(
        now + 3600000,
      ).toISOString()),
  ],
  ["malformed grace", ({ sub }) => (sub.grace_period_expires_date = true)],
  [
    "expired grace",
    ({ sub, entitlement }) =>
      (sub.grace_period_expires_date = entitlement.grace_period_expires_date =
        past),
  ],
  ["missing period identity", ({ sub }) => delete sub.purchase_date],
  [
    "different purchase periods",
    ({ entitlement }) =>
      (entitlement.purchase_date = new Date(
        Date.parse(purchased) - 86400000,
      ).toISOString()),
  ],
  [
    "future purchase period",
    ({ sub, entitlement }) =>
      (sub.purchase_date = entitlement.purchase_date = future),
  ],
  [
    "disagreeing paid expiry",
    ({ entitlement }) =>
      (entitlement.expires_date = new Date(
        Date.parse(past) + 3600000,
      ).toISOString()),
  ],
  ["refund with stale grace", ({ sub }) => (sub.refunded_at = past)],
  [
    "pause/account hold with stale grace",
    ({ sub }) => (sub.auto_resume_date = future),
  ],
];
for (const [name, mutate] of noGraceCases)
  test("residual/contradictory grace cannot extend access: " + name, () => {
    const data = graceProvider();
    mutate(parts(data), data);
    const result = snapshot(data, RC, cfg, now, [graceProof()]);
    assert.equal(result.state, "expired");
    assert.ok(Date.parse(result.until) <= now);
    assert.deepEqual(result.transactions, []);
  });
test("residual grace never lengthens an otherwise active or cancelled paid subscription", () => {
  for (const changes of [
    {},
    { unsubscribe_detected_at: past },
    { billing_issues_detected_at: null },
  ]) {
    const data = provider({
      ...changes,
      grace_period_expires_date: new Date(now + 30 * 86400000).toISOString(),
    });
    parts(data).entitlement.grace_period_expires_date =
      parts(data).sub.grace_period_expires_date;
    const result = snapshot(data, RC, cfg, now, [graceProof()]);
    assert.equal(result.until, future);
    assert.equal(
      result.state,
      changes.unsubscribe_detected_at ? "cancelled" : "active",
    );
  }
});
test("expiration, account hold without grace, refund with revocation and removed entitlement deny access", () => {
  for (const changes of [
    {},
    { billing_issues_detected_at: past },
    { refunded_at: past },
  ]) {
    const data = provider({ ...changes, expires_date: past });
    parts(data).entitlement.expires_date = past;
    assert.equal(snapshot(data, RC, cfg, now, [graceProof()]).state, "expired");
  }
  const removed = graceProvider();
  delete removed.subscriber.entitlements.fixture_premium;
  assert.equal(snapshot(removed, RC, cfg, now).state, "free");
  // Revocation/hold expiry takes precedence over a conflicting future entitlement expiry.
  const contradicted = graceProvider();
  parts(contradicted).entitlement.expires_date = future;
  assert.equal(snapshot(contradicted, RC, cfg, now).state, "expired");
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

test("reconciliation persists expiry and Free quotas for residual grace rather than granting or preserving it", async () => {
  const data = graceProvider();
  parts(data).sub.billing_issues_detected_at = null;
  const s = service({ data }),
    r = await refresh({ env, fetcher: s.fetcher })(event({ userId: A }));
  assert.equal(r.statusCode, 200);
  assert.equal(JSON.parse(r.body).access.tier, "free");
  assert.equal(JSON.parse(r.body).access.limit, 3);
  const writes = s.calls
    .filter((c) => c.url.endsWith("billing_apply"))
    .map((c) => JSON.parse(c.init.body));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].p_state, "expired");
  assert.equal(writes[0].p_error, null);
  assert.equal(writes[0].p_until, past);
});
test("verified grace still requires the original owner, allowed store/environment and purchase fingerprint", () => {
  const data = graceProvider();
  data.subscriber.original_app_user_id = "rc_" + B;
  assert.throws(() => snapshot(data, RC, cfg, now, [graceProof()]), /IDENTITY/);
  data.subscriber.original_app_user_id = RC;
  parts(data).sub.store_transaction_id = null;
  assert.equal(snapshot(data, RC, cfg, now, [graceProof()]).state, "expired");
  parts(data).sub.store_transaction_id = "GPA.1234-5678-1234-12345";
  parts(data).sub.is_sandbox = false;
  assert.throws(
    () => snapshot(data, RC, cfg, now, [graceProof()]),
    /ENVIRONMENT/,
  );
});

test("handler lifecycle decisions preserve paid cancellation/refund but revoke hold and expired grace", async () => {
  const paidCancelled = provider({ unsubscribe_detected_at: past }),
    refundOnly = provider({ refunded_at: past });
  const hold = graceProvider();
  delete parts(hold).sub.grace_period_expires_date;
  const revoked = provider({ refunded_at: past, expires_date: past });
  parts(revoked).entitlement.expires_date = past;
  const grace = graceProvider(),
    ended = graceProvider();
  parts(ended).sub.grace_period_expires_date = parts(
    ended,
  ).entitlement.grace_period_expires_date = past;
  for (const [data, tier, limit] of [
    [paidCancelled, "premium", 60],
    [refundOnly, "premium", 60],
    [grace, "premium", 60],
    [hold, "free", 3],
    [revoked, "free", 3],
    [ended, "free", 3],
  ]) {
    const s = service({ data }),
      response = await refresh({ env, fetcher: s.fetcher })(
        event({ userId: A }),
      );
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).access.tier, tier);
    assert.equal(JSON.parse(response.body).access.limit, limit);
  }
});

const contradictoryProofs = [
  ["no proof", null],
  ["no access", { gives_access: false }],
  ["account hold", { status: "in_billing_retry", gives_access: false }],
  ["contradictory hold", { status: "in_billing_retry", gives_access: true }],
  ["paused", { status: "paused", gives_access: true }],
  ["expired/revoked", { status: "expired", gives_access: true }],
  ["unknown", { status: "unknown", gives_access: true }],
  ["only active, no grace", { status: "active" }],
  ["other owner", { original_customer_id: "rc_" + B }],
  ["other customer", { customer_id: "rc_" + B }],
  ["other store", { store: "app_store" }],
  ["other environment", { environment: "production" }],
  ["shared purchase", { ownership: "family_shared" }],
  [
    "other transaction",
    { store_subscription_identifier: "GPA.9999-9999-9999-99999" },
  ],
  ["other period", { current_period_starts_at: Date.parse(past) }],
  ["missing bound", { current_period_ends_at: null }],
  ["overlong bound", { current_period_ends_at: Date.parse(future) + 1000 }],
  ["wrong entitlement", { entitlements: { items: [{ lookup_key: "other" }] } }],
];
for (const [name, changes] of contradictoryProofs)
  test("grace requires current authenticated V2 access proof: " + name, () => {
    const proof = changes === null ? [] : [{ ...graceProof(), ...changes }];
    assert.equal(
      snapshot(graceProvider(), RC, cfg, now, proof).state,
      "expired",
    );
  });
test("ambiguous V2 subscriptions cannot establish grace", () => {
  assert.equal(
    snapshot(graceProvider(), RC, cfg, now, [
      graceProof(),
      { ...graceProof(), gives_access: false },
    ]).state,
    "expired",
  );
});
test("V2 missing configuration or access refusal applies expiry, without preserving an old overlong grant", async () => {
  for (const options of [
    {},
    {
      v2: [
        { ...graceProof(), gives_access: false, status: "in_billing_retry" },
      ],
    },
  ]) {
    const localEnv = { ...env };
    if (!options.v2) delete localEnv.REVENUECAT_PROJECT_ID;
    const s = service({ data: graceProvider(), ...options }),
      response = await refresh({ env: localEnv, fetcher: s.fetcher })(
        event({ userId: A }),
      );
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).access.tier, "free");
    assert.ok(
      s.calls.some(
        (c) =>
          c.url.endsWith("billing_apply") &&
          JSON.parse(c.init.body).p_state === "expired",
      ),
    );
  }
});

test("V2 outages, throttling, bad responses and partial pages cannot authorize extra grace", async () => {
  for (const options of [
    { v2Status: 403 },
    { v2Status: 429 },
    { v2Status: 503 },
    { v2Outage: true },
    { v2Page: "/v2/untrusted-next-page" },
    { v2: [null, {}, { entitlements: { items: "bad" } }] },
  ]) {
    const s = service({ data: graceProvider(), ...options }),
      response = await refresh({ env, fetcher: s.fetcher })(
        event({ userId: A }),
      );
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).access.tier, "free");
    const writes = s.calls
      .filter((c) => c.url.endsWith("billing_apply"))
      .map((c) => JSON.parse(c.init.body));
    assert.equal(writes.length, 1);
    assert.equal(writes[0].p_state, "expired");
    assert.equal(writes[0].p_error, null);
    assert.ok(!s.calls.some((c) => c.url.includes("untrusted-next-page")));
  }
});

test("V2 grace proof uses a private scoped key and cannot be supplied by the client", async () => {
  const s = service({ data: graceProvider(), v2Key: "sk_v2_fixture" }),
    handler = refresh({
      env: { ...env, REVENUECAT_V2_SECRET_API_KEY: "sk_v2_fixture" },
      fetcher: s.fetcher,
    });
  assert.equal(
    (await handler(event({ userId: A, subscriptions: [graceProof()] })))
      .statusCode,
    409,
  );
  assert.equal(s.calls.length, 1);
  const response = await handler(event({ userId: A }));
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).access.tier, "premium");
  assert.ok(!response.body.includes("sk_v2_fixture"));
  assert.ok(
    s.calls.some(
      (c) =>
        c.url.includes("/v2/projects/projfixture/customers/rc_") &&
        c.url.endsWith("/subscriptions?environment=sandbox&limit=100"),
    ),
  );
});
