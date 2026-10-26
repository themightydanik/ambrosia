# Ambrosia 2.0 — architecture, migration and release

One cohesive product/Companion milestone, built on merged #17/#18 and the no-banner mobile fix #19. [Audit and source-backed competitor comparison](product-audit-2.md). No live SQL or production deployment is performed by this PR.

## Storage and compatibility

`004_daily_wellness.sql` extends `sync_records` with `checkin` and `episode`. Its wrapper keeps the original entry/profile validator as a private helper and preserves CAS ownership, idempotency, revision checks and tombstones. `001`, `002` and `003` are unchanged.

A daily check-in contains local `date`, four required integer values 1–5, an optional 600-character note and `updatedAt`. Its ID is a deterministic SHA-256-derived UUID of `ambrosia-checkin-v1:<YYYY-MM-DD>`. JavaScript and PostgreSQL tests verify the same ID. The existing owner/id composite key makes the same day distinct across accounts and stable across devices. A simultaneous different value on two devices becomes a reviewable conflict rather than a second day or silent overwrite.

Episodes contain an owner-scoped UUID, user-defined title, start/end dates, `ongoing`/`recovering`/`recovered`, optional notes and update time. Recovered episodes require a valid end date. Entries optionally gain `symptomStart`, `symptomEnd` and `episodeId`; original entry IDs, notes, timestamps and status updates remain valid. Removing an episode does not delete its observations. A missing source is reported instead of pretending an old link still opens its original version.

The existing single-document local transaction stores wellness records, pending operations and conflicts together. Storage failures leave the form and committed snapshot intact. Account switching clears typed wellness state and active forms. Guest records remain separate; the existing explicit merge action stages their stable IDs and detects differences as conflicts. Fingerprints distinguish a later explicitly consented guest edit from a retry of the same staged source. Account/guest originals and conflict archives are not silently removed by migration.

“Clear wellness journal” tombstones symptom entries, check-ins and episodes together; it does not delete the account or its recovery archives. Permanent account deletion remains the separately confirmed privacy operation. Export includes typed records and local pending/conflict versions.

## Deterministic insights and date rules

`wellness/model.js` uses local wall dates, not `toISOString()` day labels. Calendar navigation, daily identity, onset/recovery dates, weekly windows and DST tests follow that convention. Absolute timestamps remain separately preserved for legacy entries and message ordering.

Weekly statistics use actual observed days, do not impute missing data, and explicitly show missing/sparse coverage. Each 1–5 dimension has a mean and count. A personal baseline needs at least 14 earlier recorded days from the preceding 28-day window, excluding the current week. Premium compares two non-overlapping 90-day windows with their observed-day counts. These are descriptive, not causes or medical conclusions. Charts have gaps for missing observations.

## Context engine and portability

`wellness/context.js` prepares one explicit context configuration: last 7/30/90/365 days, all available history or an explicit date range; optional symptom, entry and episode selection; check-ins; and included fields. Notes are **off by default** for selected health records. Earlier conversation turns can themselves contain notes discussed previously; start a new conversation to omit those prior turns. Individual wellness dimensions can be omitted. Defaults never send a multi-year journal.

Local filtering/statistics happen before provider invocation. At most 24 recent/relevant records and approximately 9,500 serialized record characters enter the preview. Coverage states available/selected/omitted counts, dates, note inclusion, observed days and whether the selection is partial. Supplied statistics are not recalculated by the model from a limited sample. A longer period is an explicit context expansion and still has bounded records. Missing measurements are never synthesized.

The same selected context exports as human-readable Markdown, structured JSON or CSV, independently of Premium. Markdown uses fences longer than any user-provided fence; CSV quotes cells and neutralizes leading spreadsheet formula characters. Export itself uploads nothing. A separate explicit privacy warning explains that ChatGPT/Gemini/other services have their own retention policies. Machine-readable field keys stay stable in English; the app's selection and privacy controls are localized.

## Companion persistence and security

`005_ai_companion.sql` adds `chat_conversations`, `chat_messages` and `ai_chat_usage`, with owner-only SELECT RLS. Browser clients can create/rename/configure their own conversation through a bounded RPC, and delete it through an owner-bound RPC. Both require the explicitly expected account to match `auth.uid()`, so a token changed mid-request cannot write one account’s metadata into another. They cannot insert assistant messages, reserve usage directly, change entitlements or overwrite health records. Conversations have a maximum of 200 active records per account. Lists use owner-scoped keyset pages; message views load 50 at a time, with earlier-message pagination.

A separate `ambrosia_chat_v1:<owner>` document keeps titles/configuration, the active conversation, locally cached messages and the current draft. Guest drafts never move into a signed-in account implicitly. Input is committed before sending. Storage-change detection prevents late callbacks from recreating a deleted cache or overwriting a different tab. Where Web Locks is available, the second browser tab remains read-only, including chat drafts. In-memory metadata/form state is invalidated across account changes.

Drafts, sending, failed and completed messages are distinguished. The server stores a user question **before** calling Groq; provider failure marks it failed without removing it. A response lost after completion is recoverable by loading persisted messages or replaying the same completed receipt without another provider call. A retry after failure is an explicit new attempt with a new request ID; the failed question remains visible. No automatic provider redispatch or free refund is used. A function crash can leave `sending`; after two minutes, a later begin operation marks that stale turn failed. Another live sending turn in the same conversation is rejected, so replies do not silently interleave.

Chat and report allowances are separate persistent monthly counters. Defaults are **10 Free / 120 Premium chat attempts** per UTC month, while the existing report defaults remain **3 / 60**. The shared per-user burst limit, `ai_policy.enabled` kill switch and global monthly request ceiling apply to **both**, under the same database advisory lock. Every accepted attempt counts, including provider failures. The service key is required and never exposed. Entitlement verification remains server-side; local flags and points do not grant access. Tests race 36 mixed chat/report requests in addition to the earlier 24-request security race.

`/api/chat` verifies the Supabase Auth token and confirmed email, then fetches conversation, source records and recent completed turns through the user's RLS-bound token. Every source UUID, kind, owner and revision is checked against its actual synced row. Pending/conflicting local sources receive version zero and are rejected **before reservation**. A stale/missing/foreign source yields `CONTEXT_CHANGED`; the user must sync and inspect context again. Browser-supplied record text never substitutes for the server-owned snapshot.

At most six recent completed exchanges are considered; older turns are removed first to fit a **24,000-byte UTF-8 serialized message budget**. Questions are capped at 2,000 characters; output at 900 tokens. Use a configured model supporting at least a 32k context; the default model supports this workflow. Oversized remaining contexts are rejected before spending. The report route retains its own existing caps. Supabase reads, provider calls and client requests have explicit timeouts. Client context totals/statistics are treated as user-supplied descriptive data, not an authorization input or a verified medical measurement.

Journal notes/context remain separately labelled untrusted user data, not system instructions. The system policy prohibits definitive diagnosis, invented measurements/clinical citations/causes and journal mutation, and encourages appropriate professional/emergency care for potentially urgent concerns. The model has **no mutation tools**. Only source labels from the verified context can become structured links; unknown labels are dropped and unknown `[S…]` citations are stripped. Prior-turn source labels are removed before forwarding to avoid reusing an old label for a new context. A source link records its revision; the UI warns if opening a newer version or if the record is missing. Prompt policy reduces injection risk; it does not constitute a clinical safety guarantee.

Conversation deletion clears message content on the server and leaves a minimal deleted-conversation marker, so a stale device cannot recreate it. The local cache is removed on confirmed deletion; disconnected device copies disappear when that device refreshes the list. It does not erase separate journal records. `export_account_data` now includes conversations/messages/chat usage alongside the original archive. Auth-user deletion cascades through all new tables. Existing exports, other offline devices, provider retention and managed backups cannot be remotely erased by a browser button; the privacy limits from the security guide still apply.

## Browser-only setup: no separate project or CLI required

1. Review the PR, audit, screenshots and GitHub **Checks**. The CI database is a disposable internal PostgreSQL container; no live project is touched.
2. In your existing Supabase project, open **SQL Editor → New query**. Confirm `001`, `002`, `003` were already applied. Do not rerun them.
3. Open `supabase/migrations/004_daily_wellness.sql` in GitHub, copy the complete file, paste into the query and click **Run** once. It is transactional and retains existing journal data.
4. In another new query, paste the complete `005_ai_companion.sql` and **Run** once. Do not rerun after success. Check Table Editor for the new chat tables with RLS enabled, and `sync_records` for the additional kinds. SQL Editor is privileged; it is not itself an RLS test.
5. Netlify needs the existing Functions-scoped `SUPABASE_URL`, public `SUPABASE_PUBLISHABLE_KEY`, private `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY`; optional `GROQ_MODEL` must support JSON-object responses and the input budget. No new credential is required. Keep secret keys out of public/build variables. See [security configuration](security-production.md).
6. Review the policy/allowances in SQL Editor; these reads do not display health data:

   ```sql
   select tier, monthly_requests as report_attempts, chat_monthly_requests as chat_attempts
   from public.ai_plan_limits order by tier;
   select enabled, global_monthly_requests, user_requests_per_minute from public.ai_policy;
   ```

   Migration 005 does not enable AI or reset counters. If the owner chooses to enable spending after review, use the existing `ai_policy` switch. Configure limits through explicit owner SQL updates, never client flags. Google Play purchase verification remains a future milestone; the UI does not invent billing.
7. Open the normal Netlify Deploy Preview for this PR. It has the same static publishing/functions setup; there is no application build or dependency install required of the owner. Do not apply secret credentials to untrusted preview code. Missing configuration fails closed.
8. After approval, merge/deploy the reviewed commit through GitHub/Netlify. No automatic production deploy is performed by this task. Close old application tabs and reopen so the updated shell/service worker activates. Existing source data remains; do not clear browser storage as a migration technique.

## Concise release checklist

Use synthetic records/designated accounts in the existing project. A separate test project is optional, not required.

- On a healthy day save four check-in values, edit them, then verify another device sees **one** record for that local day. Test a date near UTC midnight and a DST transition if relevant to your timezone.
- Take a previously visited device offline, save a previous-day check-in, reload and reconnect. Verify preservation, pending upload and conflict review if the same day changed elsewhere. Confirm account B cannot see account A's records.
- Log a symptom quickly, repeat with Advanced, associate an episode, append a follow-up and explicitly complete recovery with an end date. Old numeric-ID records must still open and remain exportable.
- Inspect empty, sparse and longer calendar histories and weekly means. Missing days must not look like healthy days. Baseline should appear only with enough earlier observations. Free retains full history and essential statistics; Premium unlocks the richer comparison and configured allowances, never billing claims.
- Start Companion from its main tab, an entry, an episode, selected history records/dates and a weekly summary. Inspect sources/field choices, decline consent once, then accept with synthetic notes. Check a follow-up has continuity and clickable valid sources. Edited/deleted source revisions must be explained rather than silently mis-cited.
- Interrupt a chat provider call. The question must remain sending/failed and reloadable. An explicit retry counts as a new attempt. Reopening a completed request must not cause another provider call. Rename/delete a conversation and check another device. Drafting offline must not automatically send on reconnect.
- Export selected context as Markdown/JSON/CSV with a chosen time range and note/dimension fields. Verify a privacy warning appears, no upload occurs, and full account export includes check-ins, episodes and chat. Account deletion of an explicitly expendable account should cascade to the new tables too.
- Check EN/UK/RU, 320/375/390/430 px, zoom, visible keyboard focus and Android keyboard/composer resizing. No sidebar or permanent sync banner should consume width. Open all nine screens including onboarding and forms.

## Validation and known limits

The suites cover legacy sync/security plus daily IDs, DST/local dates, offline/deduplicated check-ins, episode recovery, statistical thresholds, 2,000-record bounded context, note/dimension exclusion, safe exports, conversation ownership, source freshness, multi-turn continuity, failures/retries, quotas, deletion and late-callback isolation. Browser tests use real UI and protected handlers with simulated external services. PostgreSQL tests apply all five migrations and check actual permissions/RLS, CAS, separate accounting, deletion/export and concurrency. Screenshot artifacts contain synthetic data only.

No live Supabase Auth/SMTP/Groq deployment is claimed by those credential-free tests. A provider-generated answer is not clinically validated. Conversation metadata uses last-confirmed-write semantics; drafts are local to a device and are not a cross-device collaborative editor. Browser storage and exceptionally large exports remain finite. The initial offline shell still needs one successful online installation. Source links open current records with a revision warning rather than storing an immutable duplicate of all health records in every message. Streaming, embeddings/vector search, native Android packaging/billing, wearable/portal import and clinical/independent accessibility studies are not part of this release.
