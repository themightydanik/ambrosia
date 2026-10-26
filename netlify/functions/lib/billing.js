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
function snapshot(data, appId, cfg, now = Date.now()) {
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
  const expiry = Date.parse(entitlement.expires_date),
    subExpiry = Date.parse(sub.expires_date);
  if (!Number.isFinite(expiry) || !Number.isFinite(subExpiry))
    throw new HttpError(409, "INVALID_SUBSCRIPTION");
  const grace = Date.parse(sub.grace_period_expires_date);
  const until = Math.max(
    Math.min(expiry, subExpiry),
    Number.isFinite(grace) ? grace : 0,
  );
  result.product = product;
  result.until = new Date(until).toISOString();
  if (sub.refunded_at || until <= now) {
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
    const s = snapshot(await r.json(), account.app_user_id, cfg);
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
