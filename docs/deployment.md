# Browser-only deployment and acceptance checklist

The owner needs GitHub, Supabase Dashboard and Netlify Dashboard. No local CLI, download or development setup is required. The implementation must be reviewed as **one PR targeting `main`**. Do not merge or deploy it until approved.

## Prepare a test environment

1. In GitHub, open the PR's **Files changed** and **Checks** tabs. Wait for all Synchronization checks to pass.
2. In Supabase Dashboard, create or select a **test project**, not the production project. Open **SQL Editor → New query**.
3. If the project has no Ambrosia schema, open `supabase/migrations/001_initial_schema.sql` in GitHub, copy its entire contents, paste into SQL Editor and click **Run** once. Do not rerun it on a project where its policies already exist.
4. Open `supabase/migrations/002_bidirectional_sync.sql` in GitHub, copy its complete contents into a **new query**, and click **Run** once. It includes `BEGIN`/`COMMIT`; a failure rolls back the whole migration. Investigate errors before retrying. Do not rerun after success: the migration intentionally creates new objects without hiding duplicate application.
5. In Table Editor, verify `sync_records` exists, RLS is enabled, and earlier cloud records (if present in the test project) appear with `version = 1`. The three original tables must remain present. In SQL Editor, this read-only check shows counts without displaying private records:

   ```sql
   select kind, deleted, count(*) from public.sync_records group by kind, deleted;
   select policyname, roles, cmd from pg_policies where schemaname='public' and tablename='sync_records';
   ```

6. In Supabase **Project Settings → API / API Keys**, obtain the project URL and **publishable** key (or legacy **anon** key). Never use `service_role`, secret server keys or the database password in the frontend or Netlify configuration endpoint.
7. In Supabase **Authentication → Providers → Email**, enable email/password sign-in. Under **URL Configuration**, set the test site's URL and allow its exact confirmation/redirect URL. Create two test users, completing email confirmation if enabled.
8. In Netlify Dashboard, open the site's **Environment variables**. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the **Deploy Preview** context to the test project's values. Leave production bindings unchanged. `GROQ_API_KEY` is optional for testing AI and does not affect journal sync.
9. Open the PR's Netlify Deploy Preview. If Netlify did not create it automatically, use the site's deploy settings to enable Deploy Previews for this PR. Rebuild the preview after changing environment variables. The repository uses `netlify.toml`; there is no build command, publish directory is `.`, and functions directory is `netlify/functions`.
10. In the preview, go to Settings → Cloud account. Sign in as test account A. If configuration is missing, check the preview-context variables and redeploy the preview. If an error mentions missing `sync_records`/`sync_write`, check that migration 002 ran in the project used by that preview.

## Acceptance checklist (two devices or separate browser profiles)

Use artificial symptom notes, not real health data. Use two browser profiles/devices so their localStorage differs. A second tab in the same profile is intentionally read-only where Web Locks is supported.

- [ ] On a guest device, create an entry and edit its profile. Sign in as A. Guest entries/profile must not upload or appear in the account journal without consent.
- [ ] In Settings select **Merge device journal into this account**, read and accept the warning. Wait for synced status; resolve any conflicts. Original local data must remain. A second attempt must not create duplicate records.
- [ ] On device 2 sign in as A. Wait up to 30 seconds or use **Sync now / retry**. Confirm dates, times, notes and status histories match.
- [ ] Create a new entry on device 1 using the normal log form. It must appear on device 2. Open its card, append a status with a note and check both devices.
- [ ] After one full online visit, in browser developer tools **Network → Offline**, create another entry. The banner must say changes are saved locally. Reload while offline; the record and account partition must remain. Switch back to **Online**; wait for synced status and verify device 2 receives it. Restore normal network settings after this check.
- [ ] With both devices holding the same entry, take device 2 offline. Add a status update on each device. Reconnect device 2. Settings must present both versions; choose a version or keep both as separate entries. The decision must synchronize, and a repeated concurrent write must raise another conflict.
- [ ] Delete an entry on device 1 and sync device 2: it must disappear. Repeat with an offline edit on device 2 before reconnecting: the edit-versus-delete conflict must require a decision rather than silently resurrecting or discarding notes.
- [ ] Modify the profile's name, age, occupation, avatar and language on one device. Verify the other device updates. Open a profile form, change the profile remotely, then save the old form: expect a conflict. Canceling avatar edits must not change the saved profile.
- [ ] Interrupt a sync using browser offline mode, then reconnect or reload. Pending changes must recover without duplicates. Test a session expiry/sign-out; sign back into the same account and retry.
- [ ] Sign out on device 1: account A's records/profile/AI output must disappear. Sign in as B: A's data must remain hidden. Create a B entry; account A on device 2 must not receive it. Sign back into A on device 1 and verify A's own journal returns.
- [ ] Confirm conflict/migration/offline labels in English, Ukrainian and Russian via language settings. Open a second tab in the same browser profile: it must show the read-only notice and must not overwrite the editing tab's data.
- [ ] In Supabase Table Editor, confirm deleted sync documents remain as `deleted = true` tombstones. Do not delete those rows manually. Automated database tests cover authenticated RLS; SQL Editor normally uses a privileged role and is **not** a valid RLS-isolation test by itself.

## Production cutover (only after explicit approval)

1. Finish the preview checklist and review any legacy-data ambiguities described in `docs/synchronization.md`. Ensure the project's normal backup/recovery arrangements are in place.
2. Arrange a short maintenance window for older clients: migration 002 revokes their writes to old tables to prevent two divergent cloud journals. Their existing local journals remain, but old import/restore flows must not be used for new cloud writes.
3. In the **production** project's SQL Editor, apply only unapplied migrations in numeric order, as above. A project already using 001 needs **only 002**. The migration retains original table data and backfills the new protocol once.
4. After approval, merge the single PR through GitHub and deploy that reviewed commit through Netlify. Confirm production `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` reference the production project and that Auth redirect URLs include the production origin. Do not replace them with test-project bindings.
5. Ask users with old open tabs to close them and reopen the site, allowing the new shell worker to activate. Verify a synthetic account on two devices before inviting migrations of real records.
6. If deployment is unhealthy, pause rollout and preserve local storage/outboxes, `sync_records` and the original tables. Do **not** roll back by deleting sync tables, tombstones, clearing browser data or re-enabling old writes: changes made after cutover live in the new protocol. A reviewed forward fix is safer than a blind destructive rollback.

This PR and its tooling do not run production SQL, merge themselves or deploy production automatically.
