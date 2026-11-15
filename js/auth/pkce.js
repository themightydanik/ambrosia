// Supabase Auth's documented PKCE authorize/token endpoints; no session is installed here.
import { intentKey, authGeneration } from "./coordination.js";
const lifetime = 10 * 60 * 1000;
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const base64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
export class GooglePKCE {
  constructor({
    storage = localStorage,
    fetcher = (...args) => fetch(...args),
    clock = () => Date.now(),
    cryptoProvider = crypto,
  } = {}) {
    Object.assign(this, { storage, fetcher, clock, cryptoProvider });
  }
  read() {
    try {
      return JSON.parse(this.storage.getItem(intentKey) || "null");
    } catch {
      return null;
    }
  }
  valid(tx) {
    const current = this.read();
    return (
      !!tx &&
      current?.nonce === tx.nonce &&
      authGeneration(this.storage) === tx.generation &&
      this.clock() >= tx.created &&
      this.clock() - tx.created < lifetime
    );
  }
  async begin({ supabaseUrl, key, callback, platform }) {
    const base = new URL(supabaseUrl);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.pathname !== "/" ||
      base.search ||
      base.hash ||
      !key
    )
      throw Error("OAUTH_CONFIG");
    const target = new URL(callback);
    if (
      target.protocol !== "https:" ||
      target.search ||
      target.hash ||
      target.username ||
      target.password
    )
      throw Error("OAUTH_CONFIG");
    const verifier = base64(
      this.cryptoProvider.getRandomValues(new Uint8Array(48)),
    );
    const nonce = hex(this.cryptoProvider.getRandomValues(new Uint8Array(32)));
    const challenge = base64(
      new Uint8Array(
        await this.cryptoProvider.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      ),
    );
    const tx = {
      nonce,
      verifier,
      generation: authGeneration(this.storage),
      created: this.clock(),
      callback: target.href,
      platform,
      supabaseUrl,
      key,
      claimed: false,
    };
    this.storage.setItem(intentKey, JSON.stringify(tx));
    target.searchParams.set("nonce", nonce);
    const url = new URL("/auth/v1/authorize", supabaseUrl);
    url.search = new URLSearchParams({
      provider: "google",
      redirect_to: target.href,
      code_challenge: challenge,
      code_challenge_method: "s256",
      scopes: "openid", // GoTrue Google adds its default email/profile scopes.
      prompt: "select_account",
    }).toString();
    return { url: url.href, transaction: tx };
  }
  async exchange(raw, expectedCallback, platform) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      throw Error("OAUTH_CALLBACK");
    }
    const target = new URL(expectedCallback),
      tx = this.read();
    if (
      u.origin !== target.origin ||
      u.pathname !== target.pathname ||
      u.username ||
      u.password ||
      u.hash ||
      !this.valid(tx) ||
      tx.platform !== platform ||
      tx.callback !== target.href ||
      tx.claimed
    )
      throw Error("OAUTH_CALLBACK");
    const keys = [...u.searchParams.keys()];
    if (
      new Set(keys).size !== keys.length ||
      keys.some(
        (k) =>
          ![
            "nonce",
            "code",
            "error",
            "error_code",
            "error_description",
          ].includes(k),
      ) ||
      u.searchParams.get("nonce") !== tx.nonce
    )
      throw Error("OAUTH_CALLBACK");
    if (u.searchParams.has("error") && u.searchParams.has("code"))
      throw Error("OAUTH_CALLBACK");
    if (u.searchParams.has("error")) {
      this.storage.removeItem(intentKey);
      throw Error("OAUTH_CANCELLED");
    }
    if (
      u.searchParams.has("error_code") ||
      u.searchParams.has("error_description")
    )
      throw Error("OAUTH_CALLBACK");
    const code = u.searchParams.get("code");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        code || "",
      )
    )
      throw Error("OAUTH_CALLBACK");
    // Caller holds a same-origin Web Lock. Claim durably BEFORE network; no uncertain retry.
    tx.claimed = true;
    this.storage.setItem(intentKey, JSON.stringify(tx));
    const response = await this.fetcher(
      tx.supabaseUrl + "/auth/v1/token?grant_type=pkce",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: { apikey: tx.key, "Content-Type": "application/json" },
        body: JSON.stringify({ auth_code: code, code_verifier: tx.verifier }),
      },
    );
    if (!response.ok) throw Error("OAUTH_EXCHANGE");
    const session = await response.json();
    if (!this.valid(tx) || !session.access_token || !session.refresh_token)
      throw Error("OAUTH_STALE");
    const userResponse = await this.fetcher(tx.supabaseUrl + "/auth/v1/user", {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: tx.key,
        Authorization: "Bearer " + session.access_token,
      },
    });
    if (!userResponse.ok) throw Error("OAUTH_IDENTITY");
    const user = await userResponse.json();
    if (
      !this.valid(tx) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        user.id || "",
      ) ||
      user.id !== session.user?.id ||
      !user.email_confirmed_at ||
      !user.identities?.some(
        (i) =>
          i.provider === "google" &&
          i.identity_data?.email_verified === true &&
          typeof i.identity_data?.sub === "string" &&
          i.identity_data.sub,
      )
    )
      throw Error("OAUTH_IDENTITY");
    return { session, user, transaction: tx };
  }
  finish(tx) {
    if (!this.valid(tx)) throw Error("OAUTH_STALE");
    this.storage.removeItem(intentKey);
  }
}
