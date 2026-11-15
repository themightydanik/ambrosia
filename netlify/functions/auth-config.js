const { json, method, config, request, failure } = require("./lib/backend.js");
function callback(value, path) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      !/^[a-z0-9.-]+$/i.test(u.hostname) ||
      u.port ||
      u.search ||
      u.hash ||
      u.pathname !== path
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
function publicAuthConfig(env) {
  const webCallback = callback(
    env.AUTH_WEB_CALLBACK_URL,
    "/auth/oauth-callback.html",
  );
  const nativeCallback = callback(
    env.AUTH_NATIVE_CALLBACK_URL,
    "/auth/native-callback.html",
  );
  const sameOrigin =
    webCallback &&
    nativeCallback &&
    new URL(webCallback).origin === new URL(nativeCallback).origin;
  const webValidated =
    !!webCallback && env.GOOGLE_WEB_FLOW_VALIDATED === "true";
  const nativeValidated =
    !!sameOrigin && env.GOOGLE_ANDROID_FLOW_VALIDATED === "true";
  // A-stage rollout stays off until owner acceptance of A/B/C, not just an SDK success.
  const rolloutReady =
    webValidated && nativeValidated && env.AUTH_ROLLOUT_VALIDATED === "true";
  return {
    webCallback,
    nativeCallback: sameOrigin ? nativeCallback : null,
    webValidated,
    nativeValidated,
    requireAccounts: rolloutReady && env.AUTH_REQUIRE_ACCOUNTS === "true",
  };
}
exports.publicAuthConfig = publicAuthConfig;
exports.createHandler =
  ({ env = process.env, fetcher = fetch } = {}) =>
  async (event) => {
    if (event.httpMethod === "OPTIONS") return json(204, {});
    try {
      method(event, "GET");
      const value = publicAuthConfig(env);
      let providerEnabled = false;
      if (value.webValidated || value.nativeValidated) {
        const cfg = config(env);
        const response = await request(fetcher, cfg.url + "/auth/v1/settings", {
          headers: { apikey: cfg.publicKey },
        });
        if (response.ok)
          providerEnabled = (await response.json()).external?.google === true;
      }
      return json(200, {
        ...value,
        googleWebEnabled: value.webValidated && providerEnabled,
        googleAndroidEnabled: value.nativeValidated && providerEnabled,
      });
    } catch (e) {
      return failure(e);
    }
  };
exports.handler = exports.createHandler();
