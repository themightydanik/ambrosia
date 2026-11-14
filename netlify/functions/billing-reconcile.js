const { admin, rows, reconcile, billingConfig } = require("./lib/billing.js");
// No public HTTP route. Netlify invokes this scheduled function internally.
exports.config = { schedule: "* * * * *" };
exports.handler = async () => {
  try {
    billingConfig(process.env);
  } catch {
    return { statusCode: 200 };
  }
  const auth = admin(process.env),
    cutoff = new Date(Date.now() - 5 * 60000).toISOString();
  const accounts = await rows(
    auth,
    "billing_accounts?or=(attempted_at.is.null,attempted_at.lt." +
      encodeURIComponent(cutoff) +
      ")&order=attempted_at.asc.nullsfirst,user_id.asc&limit=25",
    fetch,
  );
  // Bounded batches; failure never invents a grant. Retrying stale rows occurs next run.
  await Promise.allSettled(
    accounts.map((a) => reconcile(a.user_id, process.env, fetch)),
  );
  return { statusCode: 200 };
};
