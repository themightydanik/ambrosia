# Current security milestone

[Security milestone 003](security-production.md) supersedes the Premium/AI and account-management behavior described below. It removes local Premium authority, keeps full journal/history/export on Free, and adds protected quotas and account deletion. Existing synchronization semantics remain.

# Account synchronization

## Architecture and audit

Ambrosia remains a static ES-module application with ordinary Netlify Functions for configuration and Groq. There is no application build. The browser uses only the Supabase publishable/anon key; RLS and the owner-bound database RPC enforce access. No service role key is involved.

Before this change:

- `ambrosia_entries` held one device-wide journal; numeric timestamp IDs were interpolated into inline handlers.
- PR #10 mapped numeric IDs to deterministic UUIDs, but had no durable outbox, download, deletion tracking or revision check. Its date regex was overescaped and could replace historical dates with import-time fallbacks.
- PR #11 restored entries with new numeric aliases and discarded cloud UUIDs. Importing those aliases again could duplicate cloud records.
- Auth UI was confined to Settings; logout and account switching left the same journal and profile visible.
- Status history lived inside `entry.statusUpdates`; older versions also used standalone `isUpdate` entries. AI history ignored the embedded updates.
- Profile persistence and cloud schema were separate. `updated_at` alone was not a safe concurrency control mechanism.

`js/sync/store.js` owns persisted data, the outbox, migration progress and conflict archives. `engine.js` owns pull/push ordering and the Supabase transport. `runtime.js` connects auth, connectivity, state persistence and the existing UI. These modules have no Premium entitlement logic.

## Local storage and identifiers

Each account has a single atomic localStorage document at `ambrosia_sync_v2:<user UUID>`. Guest data uses `ambrosia_sync_v2:guest`. Records, pending operations, migration markers and conflict decisions commit together before any network request. A storage failure raises an error, retains the previous committed snapshot and leaves an unsaved recovery draft in the current tab. The warning can be activated to download it. Do not close a tab with a storage-failure warning before recovering the draft.

Original `ambrosia_entries`, `ambrosia_profile` and `ambrosia_lang` keys are neither rewritten nor deleted. On the first upgrade as a guest, the journal is copied to guest storage. First login always opens an account partition, never uploads the guest journal. After an account has been used, logout cannot display an old unscoped restored journal. Old raw keys remain available to the explicit migration action. Fresh guest entries stay separate.

New entries use UUIDs, and the existing modal/card handlers now safely support both numeric legacy IDs and UUIDs. Absolute `timestamp` plus original wall `date`/`time` are retained. Status updates remain embedded in the entry document, with UUID and timestamp for newly created events. Legacy standalone update entries are folded into their parent during migration. Whole-entry conflicts preserve the entire status history on both sides rather than silently discarding concurrent events.

`sw.js` caches only the same-origin static application shell. It never caches API responses, auth tokens or journal records. After one successful online visit and worker installation, the app can reload offline and open the last active account's local partition. Reconnection validates the actual session before uploading. A first-ever offline visit cannot install the shell. Shell updates activate after old tabs close; increment the cache version whenever changing cached application files.

Modern browsers supporting secure contexts, ES modules, structuredClone, crypto.randomUUID, localStorage and service workers are expected. Web Locks makes additional tabs read-only so two tabs cannot race over one localStorage document. The existing app still works where Web Locks is unavailable, but use a single tab there. Browser storage is private to the browser profile, not encrypted against a person with access to that profile or developer tools.

## Server protocol

Migration `002_bidirectional_sync.sql` creates `sync_records` with composite `(user_id,id)` primary key, entry/profile kind, JSON payload, monotonically increasing server revision, operation UUID and permanent deletion marker. A reserved per-owner UUID identifies the profile. The key supports owner-scoped keyset pagination, including tombstones.

The migration backfills existing cloud UUIDs, timestamps, profiles and all status updates once. The old tables remain as read-only archives. Legacy cloud rows did not store wall timezone; their backfilled wall date/time uses UTC, while their absolute timestamps are preserved. Dates already damaged by the old importer cannot be reconstructed automatically; the original local journal is retained for review.

Authenticated users can SELECT only their own sync rows. They cannot directly INSERT, UPDATE or DELETE them. The `sync_write` RPC:

1. Verifies both `auth.uid()` and the explicitly expected `p_user`. A token changed during a request cannot write account A's pending data into account B.
2. Validates document identity, payload size and journal/profile structure.
3. Locks the owner/document pair, including an as-yet nonexistent record.
4. Applies a write only when `p_base` equals the stored revision. Creates require revision zero.
5. Recognizes a repeated operation UUID and otherwise returns the current canonical row on a revision mismatch.
6. Assigns the next server revision. Client clocks never determine a winner.

Physical deletions are unavailable to browser clients. Deletion is a versioned tombstone, retained indefinitely to stop old offline devices from recreating records. Account deletion through Supabase Auth can still cascade; retention/account-deletion administration is outside this milestone.

The engine validates the session, pulls pages of 500 records ordered by UUID, and then sends pending operations. A page commits atomically. It includes tombstones, handles equal timestamps and has no 10,000-entry restore cap. For simplicity each pass scans all account documents rather than using a clock-based cursor that could miss concurrent changes. Very large journals will be limited by browser storage and full-scan cost, not a fixed page count. Polls run every 30 seconds while visible, plus on reconnect, focus, login, local edits and manual retry. New edits arriving during a write remain queued against the acknowledged revision. Lost acknowledgements are recoverable after reload.

## Conflict policy

An uncontested edit wins only against the revision it actually observed. If remote content changed while a local operation was pending, synchronization pauses **that document** and retains both complete versions. Other records continue to synchronize. Edit-versus-delete follows the same rule: there is no automatic resurrection or silent deletion of a dirty local record.

Settings shows both payloads and deletion flags, with explicit choices:

- **Use cloud version:** adopt the current remote entry or tombstone.
- **Use this device version:** queue the local version against the reviewed remote revision, including an explicit resurrection or deletion.
- **Keep cloud + separate local copy:** adopt the cloud document and queue a fresh UUID copy of the live local entry. Profiles and local tombstones do not offer this choice.

Every resolution first records both versions in the account's local recovery archive. If another device writes after the review, CAS causes another conflict. Profile forms capture the revision when editing starts so a remote change arriving while the form is open also requires review. No unreviewed field-by-field merge or last-writer-wins policy is used.

## Consent and migration

Settings → Cloud account → **Merge device journal into this account** explicitly describes uploading sensitive records and retaining the source data. Nothing is uploaded before confirmation.

The complete local mapping and outbox are staged atomically. PR #10's deterministic owner-scoped IDs are reused. Existing matching IDs become reviewable conflicts if contents differ. For unchanged PR #11 restores whose cloud IDs were discarded, a unique timestamp/content match reuses the cloud UUID; multiple matches abort migration rather than guess. If an old restored record has since been edited so extensively that neither its old ID nor original content is recoverable, automatic identity reconstruction is impossible; review the preserved source and cloud journal before consenting to merge. No source data is deleted to resolve this ambiguity.

Staged IDs are retained, so retrying after interruption does not duplicate uploads or overwrite later edits. Source records remain indefinitely, even after successful sync. Migration is verified when Settings reports synced with no pending changes or conflicts and a second device displays the expected records. If the account already has a profile, importing a different device profile creates a conflict rather than replacing it silently.

## Auth, profile and device settings

Auth changes immediately switch the in-memory journal and profile, clear journal/AI/modal content, and invalidate old asynchronous responses. No previous account outbox is flushed under another user's credentials. Missing/expired authorization retains pending changes and reports an error; sign in again to retry. Offline sign-out hides records immediately and persists a deferred local-session sign-out; reconnect completes it before any account can reopen or upload. Logout hides account data but keeps its private local partition for the next sign-in to the same account. An offline reload opens only the last active partition; explicit sign-out clears that pointer.

Name, age, occupation, avatar and language synchronize with the account. Premium flags, promo codes, bonus points, streaks, AI-period selection, onboarding state and browser-specific preferences retain their existing device-local behavior. This milestone does not grant, revoke or implement server-side subscription entitlements. AI reads synchronized journal data and embedded status histories; delayed responses are ignored after an account switch.

## Validation and limitations

- `npm test`: state/outbox/engine scenarios, including 1,203 server documents, consent, interrupted migration, retry, concurrent editing, tombstones, expired sessions, account partitions, profile conflicts and quota errors.
- `npm run test:browser`: real app forms, cards, modal actions, service worker, offline reload and two independent browser contexts. Uses a test-only Supabase SDK/auth/transport fixture; no real health data or external credentials. A temporary static server starts automatically, or set `AMBROSIA_TEST_URL` to test a running server. Playwright and Chromium are development tools installed outside application dependencies.
- `npm run test:db`: actual PostgreSQL 17 in a disposable Docker container, applying both migrations and asserting backfill, CAS, idempotence, tombstones, RLS, owner-bound writes, anonymous denial and old-client write revocation. Auth roles/`auth.uid()` are modeled locally; this is not a live Supabase service test.
- GitHub Actions runs these checks on the PR. The owner can inspect results entirely through GitHub.

A live two-device Supabase Auth/PostgREST check is still required in the deployment preview using the configured project and two designated synthetic accounts. No credentials were available to execute that external check here. There is no production deployment or production migration in these automated tests.

Recovery archives and tombstones consume local storage. Quota warnings require recovery before closing the tab; browser eviction/clearing site data cannot be prevented. Account-isolated storage does not protect against XSS or someone operating an unlocked browser profile. Keep the existing RLS and auth protections, and do not expose any service role key.
