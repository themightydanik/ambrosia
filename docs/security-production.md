> Ambrosia 2.0 adds separate chat allowances and wellness records. For current migrations 004/005 and product behavior, see [ambrosia-2-release.md](ambrosia-2-release.md). This guide describes the security foundation retained by that release.

# Security, AI quotas and Premium foundation

This milestone follows synchronization PR #17. Apply **003 after 001 and 002**; do not rerun or edit the applied migrations. The application owner can configure everything through GitHub, Supabase Dashboard and Netlify Dashboard. A separate Supabase project, local CLI and manual file downloads are not required.

## Audit and implemented boundaries

The previous Groq proxy accepted anonymous POSTs, trusted an arbitrary client prompt and had no durable cost control. A second Vercel proxy bypassed Netlify's implementation. Premium could be enabled with a public universal code or `ambrosia_premium=1`, and editable points paid for AI. The upgrade page advertised unconfirmed prices, purchases and a seven-day trial. Accounts had no password-recovery or deletion UI. Export omitted cloud archives and billing metadata. Profile age and some legacy status labels could reach HTML templates without escaping, while appointment data was interpolated into report HTML. Home-page rules also made unsupported health inferences.

The new boundaries are:

- Every AI request uses a Bearer session. Netlify calls the configured Supabase Auth `/auth/v1/user` endpoint to validate the token, including its expiry and actual user identity. Tokens are never accepted by simply decoding their JWT payload. Confirmed email is required for AI.
- The authenticated user ID comes only from Auth. Client `userId`, `premium`, points, arbitrary prompt, model and token-limit fields are rejected. Origin validation is only defense in depth, not authentication.
- Netlify alone has the service-role and Groq keys. Browser configuration returns only a validated publishable/anon key, refusing known secret/service-role formats. Auth validation uses the public key plus the user's token, never the service key.
- The legacy Vercel `/api/ai` delegates to the same protected implementation. Complete application routing is supported on Netlify; the old Vercel deployment is not a separate feature-complete hosting target.
- Request and response sizes, feature names, language, consent version and appointment length are bounded. Model and system instructions are server-controlled. Prompts ask for factual observations, uncertainty and professional-care questions, not diagnosis or medication instructions.
- Provider calls time out after 20 seconds; Supabase calls after 10 seconds. Errors are fixed codes, never raw upstream messages, prompts, token values or database errors. No health journal, password or provider output is logged by the handlers.
- Model output is plain text. Profile, legacy status and journal HTML paths escape untrusted values. Security headers add CSP, no-referrer, nosniff, frame denial and permissions restrictions. CSP still permits existing inline application handlers/styles; it is defense in depth, not a substitute for escaping. Custom Supabase domains need an explicit CSP `connect-src` adjustment.

## Persistent quotas and cost semantics

`ai_plan_limits` defaults to **3 Free / 60 Premium attempts per UTC calendar month**, shared across all five AI tools. One request costs one attempt. `ai_policy` defaults to **disabled**, with a global **1,000 attempts/month** ceiling and **3 attempts/user/minute**. The owner configures these values in SQL Editor; they are not client inputs. The UI reads actual current limits, remaining attempts and the next UTC renewal boundary from the database.

`reserve_ai_request` is executable only by `service_role`. Under transaction-scoped advisory locks, it checks policy, effective entitlement, persistent monthly usage, recent requests, a global budget and the `(user_id, request_id)` receipt. It reserves usage before the provider call. Global lock ordering prevents concurrent instances or different users exceeding the same budget. The SQL tests use 24 independent PostgreSQL connections, not only an in-memory limiter.

A request ID can dispatch at most once. A repeated ID returns `DUPLICATE_REQUEST` without calling Groq. **All accepted attempts count**, including provider errors, timeouts and a process crash after reservation. The provider may already have billed them, so automatic refunds or redispatch would allow unbounded spending. The application does not store AI responses for replay. The user may explicitly try again with a new ID and another attempt. Invalid input, missing configuration, failed Auth verification and denied reservations do not consume attempts.

`ai_requests` stores only owner UUID, request UUID, feature, consent-policy version, timestamps, period and outcome. It never stores health content or AI output. `ai_usage` is owner-specific; `ai_global_usage` is an anonymous monthly aggregate that deliberately survives account deletion so deletion cannot reset the global ceiling. Request/usage rows cascade with account deletion. No automatic receipt cleanup is installed; deleting receipts during their deduplication period would weaken retry protection. Budget counts are **request ceilings, not guaranteed currency budgets**: model pricing can change. Configure a provider-side spend ceiling too where available.

Verified-email accounts can still be created abusively. Per-user quotas plus the global ceiling bound Groq dispatch, but cannot prevent account farming or denial of the shared budget. Supabase email confirmation, signup CAPTCHA, Auth rate limits, appropriate SMTP and hosting-provider abuse controls remain operational requirements.

## Entitlements and plan behavior

`entitlements` is owner-readable but cannot be inserted, updated or deleted by an authenticated browser. Only SQL Editor administration or trusted service-role processes can change it. Each owner has one row:

| State | Effective access |
| --- | --- |
| absent / `free` | Free |
| `active` | Premium until `valid_until` |
| `trial` | Premium until the explicitly granted trial expiry |
| `cancelled` | Premium until the already-granted expiry; no implied renewal |
| `expired`, or any paid/trial/cancelled state past expiry | Free |

There is no automatic trial and no fake payment. No confirmed price or product availability is advertised. “Restore account access” re-reads verified server state; signing in on another device sees the same entitlement. It does not claim to restore an unverified Google purchase.

Browser feature presentation uses an in-memory response tied to the current account, checked within five minutes and bounded by entitlement expiry. It is cleared on logout, account change and offline transition. Old Premium flags and bonus points are ignored; no client activation function or promo list remains. DevTools can always change a local UI, but cannot grant a database entitlement or increase the server AI quota. Local feature filtering is presentation, not a server security boundary.

Journal creation, full history, export and deletion are available to everyone, including offline, so private health data is not held behind an unverifiable local gate. Premium currently provides larger server AI allowance and the existing advanced symptom filter. Legacy streak/points displays are motivational only; they are not currency, entitlements or AI credits.

### Secure development grants

For an internal account only, copy its UUID from **Supabase Authentication → Users**, then explicitly run this reviewed SQL in SQL Editor. This is an administrative test grant, not a browser bypass or a purchase:

```sql
insert into public.entitlements(user_id,state,valid_until,source)
values ('REPLACE_WITH_INTERNAL_USER_UUID'::uuid,'active',now()+interval '24 hours','development')
on conflict (user_id) do update
set state='active',valid_until=excluded.valid_until,source='development',updated_at=now();
```

Revoke that specific grant after checking it:

```sql
update public.entitlements set state='expired',valid_until=now(),updated_at=now()
where user_id='REPLACE_WITH_INTERNAL_USER_UUID'::uuid and source='development';
```

Future Google Play integration must verify purchase tokens with Google on a trusted server, bind each purchase uniquely to one owner, process authenticated renewal/cancellation/revocation events idempotently and update this same entitlement row. `source='google_play'` and unique `provider_reference` are integration hooks, not implemented receipt verification. Use a non-secret provider reference; do not store raw purchase credentials in owner-readable fields. No webhook or client purchase-token grant endpoint exists in this milestone.

## Privacy and account operations

AI consent is requested **for every request**, after selecting the journal period and before sending any health text. It names Groq, explains external processing/retention, the attempt charge and the observational purpose. No permanent localStorage consent authorizes later records. Only the chosen period and optional appointment details are transmitted. Ambrosia's functions do not persist prompts/responses, but Groq's account-specific retention policy, hosting access logs, Supabase-managed Auth logs and backups must be covered by the owner's published privacy/retention policy. This implementation does not assert zero provider retention or regulatory/medical-device compliance.

Password reset uses Supabase's supported email recovery flow and an exact same-origin redirect. The UI gives a generic delivery message. A `PASSWORD_RECOVERY` event opens a 12-character minimum password form; success requests revocation of other refresh sessions and signs out locally. A failure to revoke other sessions is reported. Configure the same password policy in Supabase to enforce it for direct API callers. Existing access JWTs may remain valid until expiry even after refresh-session revocation; use a suitably short access-token lifetime. SDK/Auth configuration and mail delivery require the browser checklist below.

Account deletion requires a currently verified token, typed `DELETE`, explicit browser-data consent and password reauthentication as the **same Auth user**. The server hard-deletes that Auth user using the Auth Admin API. Existing foreign keys delete all profile, legacy journal/status, sync/tombstone, entitlement, receipt and per-user quota rows. Other users' rows are untouched. There are no application Storage buckets or billing-provider records in the current repository. MFA-enabled and future federated-only accounts are refused until an appropriate step-up deletion flow is implemented; do not weaken that check to accept a stale session.

After confirmed deletion, the current browser invalidates sync callbacks, removes the account partition and unchanged Ambrosia browser keys covered by the confirmation, clears cached/unsaved data and signs out. Other open tabs are notified. If the user switches accounts while deletion is in flight, cleanup is restricted to the deleted account to avoid erasing the newly active journal. A timeout may leave deletion outcome unknown; the UI never claims success without a confirmed response. The owner can inspect Auth Users to reconcile such an exceptional outcome.

No web application can erase copies on an offline/disconnected device, downloads already made by the user, provider-retained records or retained backups remotely. Clear the corresponding browser data on other devices; those devices cannot upload deleted-owner records because the Auth user is gone and foreign keys reject orphan writes. Managed backup/log retention remains an operational policy, not a hidden promise of this button.

Export is free. Signed-in export uses owner-bound `export_account_data` and includes all cloud sync documents/tombstones, original legacy tables, profile, entitlement, request and usage metadata, plus the current local account archive/outbox/conflicts and in-memory recovery draft. Signed-out export is device-only. Unscoped legacy/guest records are exported separately while signed out; they are not appended to another account's export. The RPC returns one JSON document to avoid a REST row-page cap; extremely large exports are limited by database response and browser memory. The export itself contains sensitive data and remains under the user's control.

## Browser-only rollout

1. Review this PR and its **Checks** tab in GitHub. No production deployment or live SQL is performed by the tests. The owner decides when to merge/deploy.
2. In the existing Supabase project's **SQL Editor → New query**, paste the complete `003_security_premium_ai.sql` from GitHub and click **Run** once, after confirming 001/002 are applied. Do not rerun older migrations. It adds tables/functions, retains existing journal data and leaves AI disabled.
3. In **Project Settings → API / API Keys**, identify the project URL, public publishable/anon key and the **legacy service_role JWT key**. The service-role key is powerful; keep it in Netlify Functions scope only, never in a browser, GitHub file, screenshot or chat.
4. In Netlify **Site configuration → Environment variables**, set the following for the intended deploy context and **Functions** scope (not a public build variable):

   | Name | Purpose |
   | --- | --- |
   | `SUPABASE_URL` | HTTPS project root URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable or legacy anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Legacy service-role JWT, functions only; quota RPC and Auth Admin deletion |
   | `GROQ_API_KEY` | Functions-only provider credential |
   | `GROQ_MODEL` | Optional owner-selected model; defaults to `openai/gpt-oss-120b` |

   Never put service/Groq keys in `SUPABASE_PUBLISHABLE_KEY`. If the UI supports hiding/marking secret values, use it. Restrict Preview-context keys to collaborators you trust: any code with a service key has administrative access. You may initially leave Preview admin/Groq credentials unset and run credential-free tests; those features fail closed. A separate Supabase project is optional, not required.
5. In Supabase **Authentication → URL Configuration**, set the actual site URL and allow its exact recovery/confirmation redirect URL, including any approved preview origin. Under **Authentication → Email / Providers**, require email confirmation, configure reliable SMTP and rate limits, set the supported password minimum to 12, and enable signup CAPTCHA where available. Do not disable these protections to make a test pass.
6. Trigger the reviewed Netlify deploy. There is no build command; `netlify.toml` retains static publishing and adds the protected function redirects/security headers. Close old app tabs and reopen so the new shell worker activates. Old cached clients fail closed because arbitrary old AI payloads are no longer accepted.
7. In SQL Editor, review/adjust the selected policy before enabling AI. Example values are the defaults, not commercial price promises:

   ```sql
   select * from public.ai_plan_limits;
   select enabled,global_monthly_requests,user_requests_per_minute from public.ai_policy;
   -- Run the following only when ready to enable provider spending:
   update public.ai_policy set enabled=true where id=true;
   ```

   Change `monthly_requests` for a tier, or `global_monthly_requests` for the service ceiling, through explicit SQL Editor updates. A kill switch is `update public.ai_policy set enabled=false where id=true;`. Set provider spend alerts/ceilings separately. Do not reset counters to test enforcement.
8. Use designated synthetic accounts/notes in the existing project for the checklist. Do not use real patients' health records to test AI. Account-deletion verification must target only an expendable account whose deletion the owner explicitly intends. Production records of existing users must not be modified for testing.

### Short manual checklist

- Signed out, invoke an AI action: sign-in is required. A direct anonymous POST to `/api/ai` must return 401.
- Sign in with a confirmed synthetic account. Verify the actual Free allowance, remaining usage and UTC renewal date. Changing `ambrosia_premium`, points or `state.premium` in browser tools must not affect the verified badge/quota.
- With synthetic entries selected, decline the AI confirmation: no provider request. Accept once: one attempt is charged and output renders as text. Try the five tools and verify shared limits. Confirm a used-up allowance gives a clear message. Never reset production counters for tests.
- Grant the designated internal account the 24-hour development entitlement above, refresh access on two devices, and confirm the larger allowance. Revoke it and refresh again. No trial/purchase can be started by the UI.
- Send a password reset to an address you control. Follow its email link on an allowed origin, set a new password and sign in again. Check the generic error path for an expired recovery link.
- Export on Free and verify the account, profile, sync/status and usage sections. A different account must not see those data.
- For an expendable synthetic account only, open Delete, enter its current password, type `DELETE` and check the explicit browser-data confirmation. Confirm Auth Users and all owner-scoped tables contain no rows for its UUID. Another test account must remain intact. This step is an intentional deletion by the owner, never an automated live-data test.
- Create/reload a journal offline and reconnect; repeat account switching. Premium verification may be unavailable offline, but records and exports of device data remain usable.
- Check English, Ukrainian and Russian account/upgrade/consent messages. Check Netlify function logs contain status/operational metadata only, not journal text, passwords or key values.

## Automated evidence and remaining work

`npm test` includes backend handlers and all sync tests. `npm run test:browser` runs actual application forms and protected handlers in Chromium with simulated Auth/PostgREST/Groq, alongside the original offline/two-device regression. `npm run test:db` applies 001/002/003 to disposable PostgreSQL, asserts actual permissions/RLS, entitlement state changes, deletion cascades/export, and races 24 connections over durable quotas. It never connects to the live Supabase project. GitHub Actions runs these checks without external credentials. Local Netlify requests also verify that anonymous function routes fail closed.

The hosted Auth email/SMTP, configured Supabase/PostgREST and actual Groq account are not exercised by credential-free tests; the owner performs the short checklist through existing dashboards. Google Play Billing, verified receipts/webhooks, paid checkout, support flows for MFA/federated account deletion, strict CSP without inline handlers, provider-specific deletion/retention automation and regulatory review remain future work. No unverified purchase, price, trial or compliance claim is made.
