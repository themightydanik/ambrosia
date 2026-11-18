import { GooglePKCE } from "./pkce.js";
import {
  authGeneration,
  invalidateAuthIntent,
  authTransition,
  oauthCommit,
} from "./coordination.js";
import { authSettings, googleAvailable } from "./config.js";
import { getSupabaseClient } from "../supabase-client.js";
import { apiFetch, isAndroid } from "../platform.js";
import { state } from "../state.js";
const flow = new GooglePKCE();
let working = false;
export const pendingGoogle = () => {
  const tx = flow.read();
  return flow.valid(tx) ? tx : null;
};
export function cancelGoogle() {
  invalidateAuthIntent();
  working = false;
  window.dispatchEvent(new Event("google-auth-changed"));
}
export async function startGoogle() {
  if (working || state.accountId || !(await googleAvailable()))
    throw Error("OAUTH_UNAVAILABLE");
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  if (data.session) throw Error("OAUTH_SIGN_OUT_FIRST");
  invalidateAuthIntent();
  const cfg = authSettings(),
    response = await apiFetch("/api/supabase-config", { cache: "no-store" });
  if (!response.ok) throw Error("OAUTH_CONFIG");
  const pub = await response.json();
  const platform = isAndroid() ? "android" : "web";
  const started = await navigator.locks.request("ambrosia-google-pkce", () =>
    flow.begin({
      supabaseUrl: pub.url,
      key: pub.publishableKey,
      callback: platform === "web" ? cfg.webCallback : cfg.nativeCallback,
      platform,
    }),
  );
  working = true;
  window.dispatchEvent(new Event("google-auth-changed"));
  try {
    if (platform === "web") location.assign(started.url);
    else {
      const { Browser } = await import("../native-sdk.js");
      await Browser.open({ url: started.url });
    }
  } catch {
    cancelGoogle();
    throw Error("OAUTH_UNAVAILABLE");
  }
}
export async function finishGoogle(url) {
  if (!(await googleAvailable())) throw Error("OAUTH_UNAVAILABLE");
  const cfg = authSettings(),
    platform = isAndroid() ? "android" : "web";
  return navigator.locks.request("ambrosia-google-pkce", async () => {
    const client = await getSupabaseClient();
    const initial = await client.auth.getSession();
    if (state.accountId || initial.data.session) throw Error("OAUTH_STALE");
    const pub = await (
      await apiFetch("/api/supabase-config", { cache: "no-store" })
    ).json();
    const pending = flow.read();
    if (pending?.supabaseUrl !== pub.url || pending?.key !== pub.publishableKey)
      throw Error("OAUTH_CONFIG");
    const result = await flow.exchange(
      url,
      platform === "web" ? cfg.webCallback : cfg.nativeCallback,
      platform,
    );
    await authTransition(async () => {
      if (
        !flow.valid(result.transaction) ||
        state.accountId ||
        (await client.auth.getSession()).data.session
      )
        throw Error("OAUTH_STALE");
      const generation = authGeneration();
      await oauthCommit(result.user.id, async () => {
        const { error } = await client.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (error) throw Error("OAUTH_IDENTITY");
        if (authGeneration() !== generation) {
          const current = await client.auth.getSession();
          if (current.data.session?.user.id === result.user.id)
            await client.auth.signOut({ scope: "local" });
          throw Error("OAUTH_STALE");
        }
      });
      flow.finish(result.transaction);
      window.dispatchEvent(
        new CustomEvent("google-session-committed", {
          detail: { userId: result.user.id },
        }),
      );
    });
    working = false;
    window.dispatchEvent(new Event("google-auth-changed"));
    return result.user;
  });
}
export async function initializeNativeOAuth() {
  if (!isAndroid()) return;
  const { App, Browser } = await import("../native-sdk.js");
  let receiving = false;
  async function receive(url) {
    const cfg = authSettings();
    if (!cfg?.nativeCallback) return;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    const expected = new URL(cfg.nativeCallback);
    if (
      parsed.origin !== expected.origin ||
      parsed.pathname !== expected.pathname
    )
      return;
    receiving = true;
    try {
      await finishGoogle(url);
      await Browser.close().catch(() => {});
    } catch {
      working = false;
      window.dispatchEvent(new Event("google-auth-failed"));
    } finally {
      receiving = false;
    }
  }
  await App.addListener("appUrlOpen", ({ url }) => {
    void receive(url);
  });
  await Browser.addListener("browserFinished", () => {
    setTimeout(() => {
      if (!receiving && flow.read() && !flow.read().claimed) cancelGoogle();
    }, 1000);
  });
  const launch = await App.getLaunchUrl();
  if (launch?.url) await receive(launch.url);
}
