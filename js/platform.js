// Native builds replace this configuration at build time; the web app has no SDK dependency.
export const isAndroid = () =>
  window.Capacitor?.isNativePlatform?.() === true &&
  window.Capacitor?.getPlatform?.() === "android";
let configPromise;
export function nativeConfig() {
  if (!isAndroid()) return Promise.resolve(null);
  return (configPromise ||= fetch("/native-config.json", {
    cache: "no-store",
  }).then((r) => {
    if (!r.ok) throw Error("BILLING_NOT_CONFIGURED");
    return r.json();
  }));
}
export async function apiFetch(path, options) {
  const cfg = await nativeConfig();
  return fetch(cfg ? new URL(path, cfg.apiOrigin).href : path, options);
}
export async function authRedirect() {
  return (
    (await nativeConfig())?.apiOrigin || location.origin + location.pathname
  );
}
