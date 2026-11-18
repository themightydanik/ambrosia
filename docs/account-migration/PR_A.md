# PR A — staged accounts and Google OAuth

Owner decision: the target journey is onboarding → Google/email account → verified subscription → Home. Target US pricing is $3.49 monthly / $29.99 annually, with a seven-day introductory trial **only where Play declares eligibility**. These supersede the optional freemium blueprint as product requirements; they are not new purchase constants or an enabled access policy.

**This PR implements A only. Stop for owner review before PR B; stop again before PR C. All access-policy rollout stays disabled until A/B/C and real Android OAuth and Google Play acceptance pass.** No production configuration, SQL, store products, RevenueCat settings, deployment or release is authorized by these instructions.

## Audit and blockers

Audited merged [blueprint #22](https://github.com/themightydanik/ambrosia/pull/22), [visual foundation #23](https://github.com/themightydanik/ambrosia/pull/23), `docs/premium-billing.md`, onboarding/roadmap documents, Supabase Auth/sync/store/engine, migrations 001–006/RLS, account APIs and RevenueCat ownership/lifecycle checks. Existing email confirmation/recovery uses the Supabase client's implicit callback detection. Existing device migration already has deterministic IDs, durable pending operations, conflict review and retry; it does not clear originals. Existing billing verifies entitlements on the server, but **does not yet require a subscription for all journal writes**.

Missing owner inputs: verified canonical HTTPS domain, Supabase Google provider credentials and redirect allowlist, Google OAuth consent configuration, actual Android package and signing certificate fingerprints, verified installed App Links, and live owner acceptance. No values have been invented or production settings changed. Synthetic `.invalid` domains and certificates appear only in tests.

## Changes and trust boundaries

- `/api/auth-config` reports server-controlled configuration, checks `/auth/v1/settings` for actual Google enablement and never returns provider/service secrets. Google controls are absent until explicit platform acceptance plus provider availability and a matching callback configuration.
- A separate Google PKCE adapter uses Supabase's documented authorize and PKCE token endpoints. It generates a 384-bit verifier with S256 and a separate 256-bit random redirect nonce. **GoTrue owns and verifies Google's OAuth `state`; the app never overrides it.** The nonce binds the resulting redirect to this device's pending transaction.
- Exact HTTPS callback origin/path, nonce, unique recognized query fields, platform, current auth generation, expiry and code format are checked before exchange. No fragment-token or custom-scheme sign-in. A same-origin Web Lock serializes claims; a durable claim precedes network access. Uncertain exchanges require starting again, not retrying the code. `/auth/v1/user` must corroborate the returned user, confirmed email and verified Google identity before `setSession` installs credentials.
- The web callback scrubs its query **before constructing the SDK**, so legacy automatic URL detection cannot bypass Google verification. Email confirmation/password recovery keep their existing SDK defaults and redirect contract.
- Android launches the system browser using the official Capacitor Browser plugin; App handles only the configured HTTPS callback. `getLaunchUrl()` resumes an unclaimed saved attempt after process recreation. The bundled callback must match server configuration. Cancellation invalidates the generation; late responses cannot commit. An unclaimed attempt expires after ten minutes; Supabase's code itself remains subject to its five-minute, one-use limit. Local storage contains a short-lived PKCE verifier and public configuration, never client secrets.
- Auth mutations are serialized. Sign-out, email sign-in and account changes invalidate previous Google attempts, including A → B → A. A stale result is rejected before switching the journal partition; an in-flight cancelled commit is cleared locally. Real multi-window/WebView lifecycle acceptance is still required.
- Mandatory authentication is a **staged navigation change**, not subscription authorization. It hides guest entry points when the validated flag is enabled, preserves recovery/password flows and offers original-device export without authentication. A remembered mandatory requirement survives temporary config failure; an explicit server rollback clears it. A fresh offline installation cannot discover server policy. PR B must enforce policy in APIs, RLS/RPCs and offline writes before rollout; this PR makes no protection claim against old clients, direct requests or local code modification.

### Identity linking and duplicate accounts — owner security gate

[Supabase automatically links verified same-email identities](https://supabase.com/docs/guides/auth/auth-identity-linking). A client cannot disable or replace that server policy. The app does **not** call manual link/unlink APIs, search accounts by email, copy journal partitions by email, select RevenueCat IDs by email or create fallback accounts after an OAuth error. GoTrue's resulting immutable user ID is the sole account identity. Google uses `prompt=select_account`; an already active account must sign out first.

Before setting validation flags, review the deployed GoTrue version/policy with disposable Google and email accounts, including verified/unverified same-address identities, pre-account-takeover protections, existing verified email login and stable Supabase UID. If the owner requires **no automatic verified-identity linking at all**, that is an unresolved provider-policy blocker: do not enable Google without a reviewed supported server solution. Do not substitute an email-only client check or claim this is configurable in the app. No purchase ownership or RevenueCat restore settings are changed.

Deletion keeps the existing server password reauthentication. Google-created users without a password receive localized instructions to use the existing password-reset email, set a password, sign in again and then confirm deletion. Do not bypass reauthentication with a client flag or a recent-login timestamp. Verify that real email recovery works for these accounts before enabling Google.

### Threat model

Protect against login CSRF/callback injection, malicious redirect origins, duplicate/foreign/replayed callbacks, code theft without verifier, provider cancellation, interrupted exchange, process death and late-account results. Session installation follows server identity verification and intent checks. Exact App Links plus certificate association reduce callback interception. The browser/WebView origin remains trusted: XSS, compromised devices and extensions that can read same-origin storage are outside PKCE's protection. Existing CSP, HTTPS, no-referrer policy and no token logging are preserved. Recovery exports deliberately contain sensitive original records and stay on the device; use a trusted device and protect the downloaded archive.

## Device migration and rollback

1. Existing guest/legacy data stays in its original keys. On account entry it is not uploaded, cleared or reassigned. Recovery detects malformed originals as well as normal entries/check-ins/episodes.
2. Before login, a staged mandatory account screen offers **Recover device records**. After login, Settings exposes **Review device records** and the existing explicit merge control. Review/export reads only known guest/legacy keys, never other account partitions. Original bytes are preserved in the recovery JSON.
3. Open the review, inspect the original records, optionally export, then explicitly confirm the existing merge to the current account. Dismissing review or confirmation does nothing. Stable IDs, collision/conflict preservation and idempotent retries are inherited from the existing SyncStore/SyncEngine. Inspect conflicts before selecting a version; retain the browser until pending changes sync. Failed migration keeps originals and the durable outbox/recovery archives.
4. Roll back `AUTH_REQUIRE_ACCOUNTS=false`, then set Google validation flags false if needed. On the next successful config fetch, guest navigation returns and cached restriction clears. Existing sessions, records, migrations, purchase IDs and quotas remain intact. No database backup restore or storage reset is needed. A temporary outage intentionally retains a previously observed restriction; restore config access for rollback.

No schema migration, no paid enforcement, no new trial grant and no journal/AI quota changes occur in A. B must inventory guest/free/paid/trial states without health-data telemetry, preserve pending writes and all data rights, and audit every existing table, RPC, service-role path and offline mutation. C must consume actual localized Play offers; no fabricated prices or eligibility.

## Owner dashboard/build checklist

Use disposable accounts and an isolated test environment first. Do not use credentials in source or screenshots.

1. **Google Cloud:** configure consent screen/test users, privacy/terms/support details and a Web OAuth client. Authorize the actual app origin and the Supabase project's exact Google callback (`/auth/v1/callback`) shown in its dashboard. Store the real client ID/secret in Supabase Google provider settings only. Do not confuse Google's provider callback with the app return URLs below.
2. **Supabase Auth:** enable Google, review email confirmation/password policy and the identity-linking gate above. Keep existing email confirmation/recovery redirects. Add the owner-selected web/native return paths to Redirect URLs. Because the app adds `?nonce=<64 hex characters>`, configure matching **path-specific** query patterns (`/auth/oauth-callback.html?nonce=*` and `/auth/native-callback.html?nonce=*` on the actual HTTPS origin); no `/**` wildcard across arbitrary paths. Check redirect matching against the project's deployed GoTrue version and do not assume query parameters are ignored. Use the actual production Site URL only after acceptance.
3. **Netlify environment (initially flags absent/false):** `AUTH_WEB_CALLBACK_URL` must end exactly `/auth/oauth-callback.html`; `AUTH_NATIVE_CALLBACK_URL` on the same origin must end exactly `/auth/native-callback.html`. HTTPS only; no credentials, explicit non-default ports, query or fragment. Existing `SUPABASE_URL` and public key remain server-owned; no Google secret goes to the app.
4. **Android build:** supply the existing owner `GOOGLE_PLAY_APPLICATION_ID` and `NATIVE_API_ORIGIN`, plus **the exact same native return URL** as `NATIVE_AUTH_CALLBACK_URL`. The prepare script adds a narrow `android:autoVerify` HTTPS intent filter. No native callback value means no new filter, and Google stays unavailable in that build.
5. **Association hosting:** on the callback web build set `AUTH_NATIVE_CALLBACK_URL`, actual `GOOGLE_PLAY_APPLICATION_ID` and comma-separated real SHA-256 signing fingerprints in `ANDROID_APP_LINK_CERT_SHA256`. The web build emits `/.well-known/assetlinks.json`; missing inputs emit no pretend association, partial/invalid inputs fail. Include Play **app-signing** certificate for Play installs, and the actual debug certificate only on an isolated test domain if debug acceptance is required. Serve it as JSON over HTTPS, without redirects. Verify installed domain association using Android tools, not just a successful fetch.
6. **Platform feature flags:** `GOOGLE_WEB_FLOW_VALIDATED=true` and `GOOGLE_ANDROID_FLOW_VALIDATED=true` are owner attestations, not automatic proof. Exercise a staging/test build with these knobs before attesting the real environments. Provider settings must also report Google enabled; Web Locks/crypto and exact web/native callback match are required. A static server without Netlify APIs truthfully hides Google.
7. **Mandatory rollout:** keep `AUTH_ROLLOUT_VALIDATED` and `AUTH_REQUIRE_ACCOUNTS` false. Both platform flags, both valid same-origin URLs and `AUTH_ROLLOUT_VALIDATED=true` are prerequisites for `AUTH_REQUIRE_ACCOUNTS=true`. **Do not turn these on after A alone.** Complete B/C, real OAuth, rights/recovery, rollback and Play billing acceptance first. No feature flag grants a subscription.

## Real Android / owner acceptance (not satisfied by fixtures)

- [ ] Install intended debug/internal-track build; inspect package, callback manifest and actual certificate. Verify domain with `adb shell pm verify-app-links --re-verify <actual-package>` and `adb shell pm get-app-links <actual-package>`; launch the exact owner HTTPS native path and verify it resolves to Ambrosia, not a chooser or unrelated app.
- [ ] Fresh Google registration/login on web and Android, user cancels Google/provider browser, denies consent, backgrounds/foregrounds app, returns after browser close, kills/restarts app during consent and during exchange. Confirm no stale or wrong account opens; uncertain codes require restarting. The one-second browser-close cancellation grace is race handling, not entitlement grace; validate it on actual target devices.
- [ ] Web back/navigation cancellation, expired code, missing/wrong nonce, duplicate code, foreign origin/path, replay, disallowed redirects, multiple tabs/windows; no tokens in URL/history/app logs after callback processing.
- [ ] Existing email login, new signup + real confirmation email, actual password reset/recovery, expired/invalid emails; no automatic guest upload. Same-email Google/email linking and unverified pre-created-account scenarios retain the correct UID and do not transfer purchases.
- [ ] A → B → A while a callback/network response is pending; sign out before callback; verify UI, cached partitions, outbox, server user and RevenueCat identity remain separated. Email sign-in must win over cancelled Google results.
- [ ] Existing guest records/check-ins/episodes, malformed legacy JSON and full storage: review/export before sign-in, cancel/dismiss merge, retry after network loss, duplicate IDs/conflicts and recovery; compare original bytes and stable IDs. Confirm existing cloud/free/paid users and paid expiry are unchanged.
- [ ] EN/UK/RU, light/dark, 320px width, large text, keyboard/screen reader, safe areas and focus/scroll. Original Ari PNGs remain unchanged.
- [ ] Flag defaults, temporary config outage, explicit rollback, offline returning accounts, export/recovery without subscription. Confirm no production policy is enabled until B/C acceptance.

## Later Google Play / RevenueCat owner work (B/C, not executed)

- [ ] Existing product: configure owner-selected monthly auto-renewing base plan **P1M**, annual **P1Y**, target US **$3.49/$29.99**, eligible introductory **P7D** trial offers with reviewed eligibility and regional pricing. Do not invent product IDs, base-plan IDs or offer tokens.
- [ ] Import products/offers into RevenueCat; map Monthly/Annual packages to the existing entitlement. Preserve original App User ID restore behavior and immutable Play transaction ownership; never grant another trial by reinstall/email change/account switch.
- [ ] Add license testers and install through Play internal track. Test actual eligible/ineligible offers, monthly/yearly purchases, pending/cancellation, renewal, trial expiry, payment failure/corroborated grace, account hold, refund/revocation, original-account restore and rejected other-account restore.
- [ ] B: direct API/PostgREST/RPC/old-client/offline-write rejection without entitlement, retained pending writes, read/export/delete/manage/restore/auth rights, concurrency and rollback. C: real localized price/billing phases, truthful trial terms/renewal/cancellation/terms/privacy and truthful web read-only subscription explanation.

## Verification and screenshots

Focused automated coverage: `node --test tests/oauth.test.mjs tests/auth-config.test.cjs`, `npm run build`, `npm run test:auth` (Playwright). Existing regression commands: `npm test`, `npm run test:onboarding`, `npm run test:browser`, `npm run test:db` (disposable PostgreSQL only). CI runs these plus the existing Android debug compile; no public release is produced.

Screenshots in [screenshots/](screenshots/) use synthetic provider/account configuration, not a live accepted Google integration. This is deliberate test-only configuration; production buttons remain hidden by default. See [verification.md](verification.md) for actual run results, sizes and remaining limits.

## Protocol references

- [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase PKCE (five-minute, one-use codes)](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase identity linking and verified-email behavior](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [GoTrue OpenAPI: `/authorize`, `/token`, `/user`](https://github.com/supabase/auth/blob/master/openapi.yaml)
- [GoTrue redirect allowlist matching](https://github.com/supabase/auth/blob/master/internal/utilities/request.go)
- [Capacitor App URL events/launch URL](https://capacitorjs.com/docs/apis/app), [Browser lifecycle](https://capacitorjs.com/docs/apis/browser)
- [Android verified App Links](https://developer.android.com/training/app-links/verify-android-applinks)
