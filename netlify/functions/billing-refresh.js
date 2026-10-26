const {
  json,
  method,
  body,
  authenticate,
  rpc,
  failure,
  HttpError,
} = require("./lib/backend.js");
const { reconcile } = require("./lib/billing.js");
exports.createHandler =
  ({ env = process.env, fetcher = fetch } = {}) =>
  async (event) => {
    if (event.httpMethod === "OPTIONS") return json(204, {});
    try {
      method(event, "POST");
      const input = body(event, 1000),
        auth = await authenticate(event, env, fetcher);
      if (
        Object.keys(input).some((k) => k !== "userId") ||
        input.userId !== auth.user.id
      )
        throw new HttpError(409, "ACCOUNT_CHANGED");
      if (!auth.user.email_confirmed_at)
        throw new HttpError(403, "EMAIL_CONFIRMATION_REQUIRED");
      const result = await reconcile(auth.user.id, env, fetcher, true);
      return json(200, {
        confirmed: result.confirmed,
        access: await rpc(auth, "account_status", {}, fetcher, false),
      });
    } catch (e) {
      return failure(e);
    }
  };
exports.handler = exports.createHandler();
