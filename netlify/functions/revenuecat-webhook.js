const { json, body, failure, HttpError, rpc } = require("./lib/backend.js");
const {
  billingConfig,
  admin,
  rows,
  authorizeWebhook,
  reconcile,
} = require("./lib/billing.js");
exports.createHandler =
  ({ env = process.env, fetcher = fetch } = {}) =>
  async (event) => {
    try {
      if (event.httpMethod !== "POST")
        throw new HttpError(405, "METHOD_NOT_ALLOWED");
      authorizeWebhook(event, env);
      const cfg = billingConfig(env),
        payload = body(event, 64000),
        e = payload.event;
      if (
        payload.api_version !== "1.0" ||
        !e ||
        typeof e.id !== "string" ||
        e.id.length > 200 ||
        !e.id ||
        typeof e.type !== "string" ||
        e.type.length > 100 ||
        !Number.isFinite(e.event_timestamp_ms)
      )
        throw new HttpError(400, "INVALID_EVENT");
      if (e.environment !== cfg.environment)
        throw new HttpError(409, "BILLING_ENVIRONMENT_MISMATCH");
      const subjects = [
        ...new Set(
          [
            e.app_user_id,
            e.original_app_user_id,
            ...(Array.isArray(e.aliases) ? e.aliases : []),
            ...(Array.isArray(e.transferred_from) ? e.transferred_from : []),
            ...(Array.isArray(e.transferred_to) ? e.transferred_to : []),
          ].filter(
            (x) => typeof x === "string" && /^rc_[0-9a-f-]{36}$/.test(x),
          ),
        ),
      ].sort();
      if (subjects.length > 100) throw new HttpError(400, "INVALID_EVENT");
      const auth = admin(env),
        received = await rpc(
          auth,
          "billing_event_receive",
          {
            p_id: e.id,
            p_type: e.type,
            p_environment: e.environment,
            p_subjects: subjects,
            p_at: new Date(e.event_timestamp_ms).toISOString(),
          },
          fetcher,
        );
      if (received.completed)
        return json(200, { received: true, duplicate: true });
      // Webhook state is never applied directly: even late expiration/refund events fetch current state.
      for (const subject of subjects) {
        const accounts = await rows(
          auth,
          "billing_accounts?app_user_id=eq." +
            encodeURIComponent(subject) +
            "&select=user_id",
          fetcher,
        );
        for (const a of accounts) {
          const r = await reconcile(a.user_id, env, fetcher, true);
          if (!r.confirmed || !r.fresh)
            throw new HttpError(503, "BILLING_CONFIRMATION_PENDING");
        }
      }
      await rows(
        auth,
        "billing_events?event_id=eq." + encodeURIComponent(e.id),
        fetcher,
        {
          method: "PATCH",
          body: JSON.stringify({ completed_at: new Date().toISOString() }),
          headers: { Prefer: "return=minimal" },
        },
      );
      return json(200, { received: true });
    } catch (e) {
      return failure(e);
    }
  };
exports.handler = exports.createHandler();
