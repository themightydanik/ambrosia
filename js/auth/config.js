import { apiFetch, isAndroid, nativeConfig } from "../platform.js";
let settings = null;
function rememberedRequirement() {
  try {
    return localStorage.getItem("ambrosia_account_requirement_seen") === "1";
  } catch {
    return true;
  }
}
export const authSettings = () => settings;
export async function loadAuthSettings() {
  try {
    const response = await apiFetch("/api/auth-config", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error();
    const data = await response.json();
    settings = data;
    if (data.requireAccounts === true)
      localStorage.setItem("ambrosia_account_requirement_seen", "1");
    else localStorage.removeItem("ambrosia_account_requirement_seen");
  } catch {
    settings = {
      googleWebEnabled: false,
      googleAndroidEnabled: false,
      requireAccounts: rememberedRequirement(),
      unavailable: true,
    };
  }
  window.dispatchEvent(new Event("auth-settings-changed"));
  return settings;
}
export const accountsRequired = () => settings?.requireAccounts === true;
export async function googleAvailable() {
  const cfg = settings || (await loadAuthSettings());
  if (!crypto.subtle || !navigator.locks) return false;
  try {
    if (!isAndroid())
      return (
        cfg.googleWebEnabled === true &&
        new URL(cfg.webCallback).origin === location.origin
      );
    const native = await nativeConfig();
    return (
      cfg.googleAndroidEnabled === true &&
      native?.authCallback === cfg.nativeCallback
    );
  } catch {
    return false;
  }
}
