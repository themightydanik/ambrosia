import { cleanupNativeExports } from "../download.js";
import { state } from "../state.js";
import {
  authenticatedFetch,
  refreshAccess,
  accountAccess,
} from "../account-access.js";
import { isAndroid } from "../platform.js";
import { plansFromOfferings } from "./model.js";
let sdkPromise,
  configured = false,
  currentId = null,
  queue = Promise.resolve(),
  generation = 0;
const sdk = () => (sdkPromise ||= import("../native-sdk.js"));
// Serialize all SDK operations across account transitions. Never configure anonymously or logOut.
export function invalidateBilling() {
  generation++;
  currentId = null;
  void cleanupNativeExports().catch(() => {});
}
window.addEventListener("journal-changed", (e) => {
  if (e.detail?.accountChanged) invalidateBilling();
});
function serialized(work) {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
async function identity(user, token) {
  if (!isAndroid()) throw Error("ANDROID_ONLY");
  const config = await authenticatedFetch("/api/billing-session");
  if (
    config.userId !== user ||
    state.accountId !== user ||
    generation !== token
  )
    throw Error("ACCOUNT_CHANGED");
  const { Purchases } = await sdk();
  if (!configured) {
    await Purchases.configure({
      apiKey: config.publicKey,
      appUserID: config.appUserId,
    });
    configured = true;
  } else if (currentId !== config.appUserId)
    await Purchases.logIn({ appUserID: config.appUserId });
  if (state.accountId !== user || generation !== token)
    throw Error("ACCOUNT_CHANGED");
  currentId = config.appUserId;
  const actual = await Purchases.getAppUserID();
  if (actual.appUserID !== currentId) throw Error("ACCOUNT_CHANGED");
  return { Purchases, config };
}
export function loadPlans() {
  const user = state.accountId,
    token = generation;
  return serialized(async () => {
    if (!user) throw Error("SIGN_IN_REQUIRED");
    const { Purchases, config } = await identity(user, token);
    const offerings = await Purchases.getOfferings();
    if (state.accountId !== user || generation !== token)
      throw Error("ACCOUNT_CHANGED");
    return plansFromOfferings(offerings, config);
  });
}
export function transact(plan = null) {
  const user = state.accountId,
    token = generation;
  return serialized(async () => {
    if (!user) throw Error("SIGN_IN_REQUIRED");
    const { Purchases, config } = await identity(user, token);
    if (plan) {
      // Refresh store eligibility/price immediately before the Google confirmation sheet.
      const fresh = plansFromOfferings(
        await Purchases.getOfferings(),
        config,
      ).find((p) => p.type === plan.type);
      if (
        JSON.stringify(fresh.phases) !== JSON.stringify(plan.phases) ||
        fresh.option.id !== plan.option.id
      )
        throw Error("PRICE_CHANGED");
      if (state.accountId !== user || generation !== token)
        throw Error("ACCOUNT_CHANGED");
      await Purchases.purchaseSubscriptionOption({
        subscriptionOption: fresh.option,
      });
    } else await Purchases.restorePurchases();
    if (state.accountId !== user || generation !== token)
      throw Error("ACCOUNT_CHANGED");
    // CustomerInfo is intentionally ignored. Only our authenticated backend confirms access.
    for (const delay of [0, 3500, 5500]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (state.accountId !== user || generation !== token)
        throw Error("ACCOUNT_CHANGED");
      const result = await authenticatedFetch("/api/billing-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user }),
      });
      await refreshAccess(true);
      if (result.confirmed && accountAccess()?.tier === "premium") return true;
    }
    throw Error("BILLING_CONFIRMATION_PENDING");
  });
}
export async function verifyBilling() {
  const user = state.accountId;
  if (!user) throw Error("SIGN_IN_REQUIRED");
  const result = await authenticatedFetch("/api/billing-refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user }),
  });
  await refreshAccess(true);
  return result.confirmed;
}
export async function manageSubscription() {
  const url = "https://play.google.com/store/account/subscriptions";
  if (isAndroid()) {
    const { Browser } = await sdk();
    await Browser.open({ url });
  } else window.open(url, "_blank", "noopener,noreferrer");
}
export async function initializeNativeBilling() {
  if (!isAndroid()) return;
  await cleanupNativeExports();
  const { App } = await sdk();
  App.addListener("appStateChange", async ({ isActive }) => {
    const { getSupabaseClient } = await import("../supabase-client.js");
    const client = await getSupabaseClient().catch(() => null);
    if (isActive) {
      client?.auth.startAutoRefresh();
      if (state.accountId) void verifyBilling().catch(() => {});
    } else client?.auth.stopAutoRefresh();
  });
  App.addListener("backButton", async () => {
    const { goTo } = await import("../navigation.js");
    if (state.screen === "home") await App.minimizeApp();
    else goTo("home");
  });
}
