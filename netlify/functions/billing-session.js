const {
  json,
  method,
  authenticate,
  rpc,
  failure,
} = require("./lib/backend.js");
const { billingConfig } = require("./lib/billing.js");
exports.createHandler =
  ({ env = process.env, fetcher = fetch } = {}) =>
  async (event) => {
    if (event.httpMethod === "OPTIONS") return json(204, {});
    try {
      method(event, "GET");
      const auth = await authenticate(event, env, fetcher);
      if (!auth.user.email_confirmed_at)
        return json(403, { error: "EMAIL_CONFIRMATION_REQUIRED" });
      const cfg = billingConfig(env),
        account = await rpc(
          auth,
          "billing_identity",
          { p_user: auth.user.id },
          fetcher,
        );
      return json(200, {
        userId: auth.user.id,
        appUserId: account.app_user_id,
        publicKey: cfg.publicKey,
        offering: cfg.offering,
        entitlement: cfg.entitlement,
        environment: cfg.environment,
        products: cfg.products,
      });
    } catch (e) {
      return failure(e);
    }
  };
exports.handler = exports.createHandler();
