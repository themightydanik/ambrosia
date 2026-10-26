const { createHash, timingSafeEqual } = require("node:crypto");
const { HttpError, config, request, rpc } = require("./backend.js");
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function billingConfig(env) {
  const environment = env.REVENUECAT_ENVIRONMENT;
  const products = (env.REVENUECAT_PRODUCT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !env.REVENUECAT_SECRET_API_KEY?.startsWith("sk_") ||
    !env.REVENUECAT_ENTITLEMENT_ID ||
    !env.REVENUECAT_OFFERING_ID ||
    !env.REVENUECAT_ANDROID_PUBLIC_KEY?.startsWith("goog_") ||
    !["PRODUCTION", "SANDBOX"].includes(environment) ||
    products.length !== 2 ||
    new Set(products).size !== 2
  )
    throw new HttpError(503, "BILLING_NOT_CONFIGURED");
  return {
    environment,
    products,
    entitlement: env.REVENUECAT_ENTITLEMENT_ID,
    offering: env.REVENUECAT_OFFERING_ID,
    publicKey: env.REVENUECAT_ANDROID_PUBLIC_KEY,
  };
}
function admin(env) {
  const cfg = config(env);
  if (!cfg.serviceKey) throw new HttpError(503, "NOT_CONFIGURED");
  return { cfg };
}
async function rows(auth, path, fetcher, options = {}) {
  const r = await request(fetcher, auth.cfg.url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: auth.cfg.serviceKey,
      Authorization: `Bearer ${auth.cfg.serviceKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!r.ok) throw new HttpError(503, "SERVICE_UNAVAILABLE");
  return r.status === 204 ? null : r.json();
}
function authorizeWebhook(event, env) {
  const secret = env.REVENUECAT_WEBHOOK_AUTH;
  const supplied =
    Object.entries(event.headers || {}).find(
      ([k]) => k.toLowerCase() === "authorization",
    )?.[1] || "";
  if (!secret || secret.length < 32)
    throw new HttpError(503, "BILLING_NOT_CONFIGURED");
  const a = Buffer.from(secret),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new HttpError(401, "WEBHOOK_UNAUTHORIZED");
}
function snapshot(data, appId, cfg, now = Date.now(), subscriptions = []) {
  if (
    !data ||
    !Number.isFinite(data.request_date_ms) ||
    Math.abs(data.request_date_ms - now) > 300000 ||
    !data.subscriber
  )
    throw new HttpError(409, "BILLING_SNAPSHOT_INVALID");
  if (data.subscriber.original_app_user_id !== appId)
    throw new HttpError(409, "BILLING_IDENTITY_MISMATCH");
  const subscriber = data.subscriber,
    entitlement = subscriber.entitlements?.[cfg.entitlement];
  const result = {
    at: new Date(data.request_date_ms).toISOString(),
    state: "free",
    until: null,
    product: null,
    environment: cfg.environment,
    transactions: [],
  };
  if (!entitlement) return result;
  // Play base plans may be returned as subscription:base-plan. Allow only explicitly configured IDs.
  const product = entitlement.product_identifier;
  if (!cfg.products.includes(product))
    throw new HttpError(409, "UNEXPECTED_PRODUCT");
  const sub = subscriber.subscriptions?.[product];
  if (
    !sub ||
    sub.store !== "play_store" ||
    typeof sub.is_sandbox !== "boolean" ||
    (sub.is_sandbox ? "SANDBOX" : "PRODUCTION") !== cfg.environment
  )
    throw new HttpError(409, "BILLING_ENVIRONMENT_MISMATCH");
  const date = (value) => (typeof value === "string" ? Date.parse(value) : NaN);
  const expiry = date(entitlement.expires_date),
    subExpiry = date(sub.expires_date);
  if (!Number.isFinite(expiry) || !Number.isFinite(subExpiry))
    throw new HttpError(409, "INVALID_SUBSCRIPTION");
  // V1 grace dates can describe historical/potential grace, not an independent grant.
  // Corroborate the SAME current period in both objects and an unresolved billing issue.
  // Cancellation is allowed here: RevenueCat can report cancellation upon entering grace.
  const grace = date(sub.grace_period_expires_date),
    entitlementGrace = date(entitlement.grace_period_expires_date),
    issue = date(sub.billing_issues_detected_at),
    purchase = date(sub.purchase_date),
    entitlementPurchase = date(entitlement.purchase_date);
  const paidUntil = Math.min(expiry, subExpiry);
  const graceCandidate =
    paidUntil <= now &&
    expiry === subExpiry &&
    Number.isFinite(grace) &&
    grace === entitlementGrace &&
    grace > Math.max(now, paidUntil) &&
    Number.isFinite(purchase) &&
    purchase === entitlementPurchase &&
    purchase <= paidUntil &&
    Number.isFinite(issue) &&
    issue >= purchase &&
    issue <= Math.min(now, data.request_date_ms) &&
    grace > issue &&
    // Paused/held or refunded periods must not be resurrected by leftover grace.
    sub.auto_resume_date == null &&
    sub.refunded_at == null;
  // V1 cannot distinguish every contradictory hold/revocation snapshot. V2 explicitly
  // reports access and lifecycle status. Never turn a V1 grace hint into access alone.
  const orderRoot = (id) =>
    typeof id === "string" ? id.replace(/\.\.[0-9]+$/, "") : null;
  const matching = subscriptions.filter(
    (s) =>
      s &&
      typeof s === "object" &&
      s.customer_id === appId &&
      s.original_customer_id === appId &&
      s.store === "play_store" &&
      s.environment === cfg.environment.toLowerCase() &&
      s.ownership === "purchased" &&
      orderRoot(s.store_subscription_identifier) !== null &&
      orderRoot(s.store_subscription_identifier) ===
        orderRoot(sub.store_transaction_id) &&
      s.current_period_starts_at === purchase &&
      Array.isArray(s.entitlements?.items) &&
      s.entitlements.items.some((e) => e?.lookup_key === cfg.entitlement),
  );
  const proof = matching.length === 1 ? matching[0] : null;
  const confirmedGrace =
    graceCandidate &&
    proof?.gives_access === true &&
    proof.status === "in_grace_period" &&
    Number.isFinite(proof.current_period_ends_at) &&
    proof.current_period_ends_at >= paidUntil &&
    proof.current_period_ends_at <= grace;
  const until = confirmedGrace ? grace : paidUntil;
  // Internal hint only; never sent to a browser or persisted as an entitlement flag.
  result.needsGraceConfirmation = graceCandidate && !confirmedGrace;
  result.product = product;
  result.until = new Date(until).toISOString();
  // A refund without revocation can retain paid access. V1 expires_date (or absence
  // of the entitlement) determines revocation, never an event name or client flag.
  if (until <= now) {
    result.state = "expired";
    return result;
  }
  if (
    typeof sub.store_transaction_id !== "string" ||
    !/^GPA\.[0-9-]+(?:\.\.[0-9]+)?$/.test(sub.store_transaction_id)
  )
    throw new HttpError(409, "MISSING_PURCHASE_OWNERSHIP");
  result.transactions = [
    createHash("sha256")
      .update(
        "google_play:" + sub.store_transaction_id.replace(/\.\.[0-9]+$/, ""),
      )
      .digest("hex"),
  ];
  result.state = sub.unsubscribe_detected_at
    ? "cancelled"
    : sub.period_type === "trial"
      ? "trial"
      : "active";
  return result;
}
async function graceSubscriptions(appId, env, fetcher) {
  const project = env.REVENUECAT_PROJECT_ID,
    key = env.REVENUECAT_V2_SECRET_API_KEY || env.REVENUECAT_SECRET_API_KEY;
  if (!/^proj[A-Za-z0-9]+$/.test(project || "") || !key?.startsWith("sk_"))
    return [];
  // Only a fixed RevenueCat host/path is queried. Do not follow response next_page URLs.
  try {
    const url =
      "https://api.revenuecat.com/v2/projects/" +
      encodeURIComponent(project) +
      "/customers/" +
      encodeURIComponent(appId) +
      "/subscriptions?environment=" +
      env.REVENUECAT_ENVIRONMENT.toLowerCase() +
      "&limit=100";
    const response = await request(fetcher, url, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return [];
    const list = await response.json();
    if (
      list.object !== "list" ||
      !Array.isArray(list.items) ||
      list.items.length > 100 ||
      list.next_page != null
    )
      return [];
    return list.items;
  } catch {
    return [];
  }
}
async function reconcile(user, env, fetcher, force = false) {
  const cfg = billingConfig(env),
    auth = admin(env);
  const start = await rpc(
    auth,
    "billing_start",
    { p_user: user, p_force: force },
    fetcher,
  );
  const account = start.account;
  if (!start.acquired)
    return {
      fresh: false,
      confirmed:
        !!account.checked_at && !account.lease_until && !account.last_error,
      account,
    };
  try {
    const r = await request(
      fetcher,
      "https://api.revenuecat.com/v1/subscribers/" +
        encodeURIComponent(account.app_user_id),
      {
        headers: {
          Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}`,
          "Content-Type": "application/json",
          "X-Is-Sandbox": String(cfg.environment === "SANDBOX"),
        },
      },
    );
    if (!r.ok) throw new HttpError(503, "BILLING_VERIFICATION_UNAVAILABLE");
    const data = await r.json();
    let s = snapshot(data, account.app_user_id, cfg);
    if (s.needsGraceConfirmation) {
      const subscriptions = await graceSubscriptions(
        account.app_user_id,
        env,
        fetcher,
      );
      s = snapshot(data, account.app_user_id, cfg, Date.now(), subscriptions);
    }
    const applied = await rpc(
      auth,
      "billing_apply",
      {
        p_user: user,
        p_generation: account.generation,
        p_snapshot_at: s.at,
        p_state: s.state,
        p_until: s.until,
        p_product: s.product,
        p_environment: s.environment,
        p_transactions: s.transactions,
        p_error: null,
      },
      fetcher,
    );
    if (!applied) throw new HttpError(409, "BILLING_CONFIRMATION_PENDING");
    return {
      fresh: true,
      confirmed: true,
      account: {
        ...account,
        status: s.state,
        product_id: s.product,
        checked_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    await rpc(
      auth,
      "billing_apply",
      {
        p_user: user,
        p_generation: account.generation,
        p_snapshot_at: null,
        p_state: null,
        p_until: null,
        p_product: null,
        p_environment: null,
        p_transactions: [],
        p_error: error.code || "VERIFICATION_FAILED",
      },
      fetcher,
    ).catch(() => {});
    throw error;
  }
}
module.exports = {
  UUID,
  billingConfig,
  admin,
  rows,
  authorizeWebhook,
  snapshot,
  reconcile,
};
