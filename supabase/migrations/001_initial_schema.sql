-- Ambrosia: first cloud schema. Run once in Supabase SQL Editor.
-- Do not use service_role keys in browser code.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  age integer check (age between 1 and 120),
  occupation text not null default '',
  avatar text not null default '🌿',
  language text not null default 'en' check (language in ('en','ru','uk')),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  category text,
  symptoms text[] not null default '{}',
  intensity integer not null check (intensity between 1 and 10),
  triggers text[] not null default '{}',
  notes text not null default '',
  critical_tracking boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journal_entries_user_recorded_idx on public.journal_entries (user_id, recorded_at desc);

create table if not exists public.entry_status_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  status text not null check (status in ('resolved','improved','same','worse')),
  notes text not null default '',
  recorded_at timestamptz not null default now()
);
create index if not exists entry_updates_entry_idx on public.entry_status_updates (entry_id, recorded_at);

alter table public.profiles enable row level security;
alter table public.journal_entries enable row level security;
alter table public.entry_status_updates enable row level security;

create policy "profiles_owner_select" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_owner_insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_owner_update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_owner_delete" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "entries_owner_select" on public.journal_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "entries_owner_insert" on public.journal_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "entries_owner_update" on public.journal_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entries_owner_delete" on public.journal_entries for delete to authenticated using ((select auth.uid()) = user_id);

create policy "updates_owner_select" on public.entry_status_updates for select to authenticated using ((select auth.uid()) = user_id);
create policy "updates_owner_insert" on public.entry_status_updates for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid())
  )
);
create policy "updates_owner_update" on public.entry_status_updates for update to authenticated using (
  (select auth.uid()) = user_id and exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
) with check (
  (select auth.uid()) = user_id and exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
);
create policy "updates_owner_delete" on public.entry_status_updates for delete to authenticated using ((select auth.uid()) = user_id);

-- No automatic migration of localStorage data in this PR.
