# Supabase setup and synchronization

The current release requires **001 → 002 → 003 → 004 → 005**. Apply only unapplied migrations. Wellness/Companion setup: [Ambrosia 2.0 release guide](../docs/ambrosia-2-release.md). For AI/Premium/privacy, follow the [security setup guide](../docs/security-production.md). Follow the exact browser-only [deployment steps](../docs/deployment.md) and [architecture/conflict guide](../docs/synchronization.md). Do not rerun the original migration on an existing project.

The notes below describe the original schema milestone, not the current sync behavior.

# Ambrosia Supabase setup (Phase 1: schema only)

This PR adds database structure only. **It does not enable login, cloud sync or alter existing local data.**

1. Open [Supabase](https://supabase.com/dashboard) in the browser and create a new project in your own account. Choose a strong database password and keep it private.
2. Wait for provisioning, open **SQL Editor** → **New query**.
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql` from GitHub and click **Run** once. (Policies use `create policy`, so don't rerun unchanged migration.)
4. Open **Table Editor** and confirm `profiles`, `journal_entries`, and `entry_status_updates` exist. In **Authentication**, review email confirmation and allowed redirect URLs before enabling sign-in.
5. In the next PR, connect the frontend with Supabase Auth using the **project URL** and **publishable/anon key**. Never commit or share the **service_role** key, database password, or other secret. A publishable/anon key is designed for browser use, but requires correctly configured RLS.

## Security design
- All three tables have Row Level Security enabled. Authenticated users can only access their own rows.
- Status updates can only reference a journal entry owned by the same user.
- No anonymous read/write policies, public journal listing or auto-created profiles.
- Subscription entitlement and AI quotas intentionally do **not** live in client-editable profile columns; they will need server-managed tables/functions.
- Before storing real sensitive wellness information, complete the privacy/consent flow, authentication, deletion and export handling, and verify RLS with two distinct test accounts.

## Data mapping planned for next steps
- Current `state.entries` is local-only; cloud entries will use UUID IDs, not JavaScript timestamps.
- Entry `statusUpdates` will map to `entry_status_updates`.
- Offline/local data will not be uploaded without an explicit user choice and a duplicate-safe migration.
