-- Apply once AFTER 001 and 002 in Supabase Dashboard SQL Editor. No existing data is deleted.
begin;
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'free' check (state in ('free','active','trial','cancelled','expired')),
  valid_until timestamptz,
  source text not null default 'manual' check (source in ('manual','development','google_play')),
  provider_reference text unique,
  updated_at timestamptz not null default now(),
  check (state not in ('active','trial','cancelled') or valid_until is not null)
);
create table public.ai_plan_limits (
  tier text primary key check (tier in ('free','premium')),
  monthly_requests integer not null check (monthly_requests between 0 and 10000)
);
insert into public.ai_plan_limits values ('free',3),('premium',60);
create table public.ai_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  global_monthly_requests integer not null default 1000 check (global_monthly_requests between 0 and 100000),
  user_requests_per_minute integer not null default 3 check (user_requests_per_minute between 1 and 100)
);
insert into public.ai_policy(id) values(true);
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period date not null,
  used integer not null default 0 check (used >= 0),
  primary key(user_id,period)
);
-- No journal content, prompts, tokens, passwords, email addresses or AI output in billing metadata.
create table public.ai_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  consent_version text not null default 'groq-health-v1' check (consent_version='groq-health-v1'),
  feature text not null check (feature in ('analyze','correlations','report','recommend','doctor_visit')),
  period date not null,
  state text not null default 'dispatched' check (state in ('dispatched','succeeded','failed')),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
create index ai_requests_user_created on public.ai_requests(user_id,created_at desc);
-- Aggregate global counts intentionally survive account deletion. They contain no user identity.
create table public.ai_global_usage (period date primary key,used integer not null default 0 check(used >= 0));

alter table public.entitlements enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_plan_limits enable row level security;
alter table public.ai_policy enable row level security;
alter table public.ai_global_usage enable row level security;
create policy entitlement_owner_read on public.entitlements for select to authenticated using ((select auth.uid())=user_id);
create policy usage_owner_read on public.ai_usage for select to authenticated using ((select auth.uid())=user_id);
create policy request_owner_read on public.ai_requests for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.entitlements,public.ai_usage,public.ai_requests,public.ai_plan_limits,public.ai_policy,public.ai_global_usage from public,anon,authenticated;
grant select on public.entitlements,public.ai_usage,public.ai_requests to authenticated;
grant all on public.entitlements,public.ai_usage,public.ai_requests,public.ai_plan_limits,public.ai_policy,public.ai_global_usage to service_role;

create function public.entitlement_snapshot(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('state',case when e.state in ('active','trial','cancelled') and e.valid_until <= now() then 'expired' else coalesce(e.state,'free') end,
    'tier',case when e.state in ('active','trial','cancelled') and e.valid_until > now() then 'premium' else 'free' end,
    'validUntil',e.valid_until)
  from (select p_user as user_id) u left join public.entitlements e on e.user_id=u.user_id;
$$;
revoke all on function public.entitlement_snapshot(uuid) from public,anon,authenticated;

create function public.account_snapshot(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select public.entitlement_snapshot(p_user) || jsonb_build_object('userId',p_user,'used',coalesce(u.used,0),'limit',l.monthly_requests,
    'remaining',greatest(0,l.monthly_requests-coalesce(u.used,0)),
    'renewsAt',((date_trunc('month',now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'),
    'period',date_trunc('month',now() at time zone 'UTC')::date,'aiEnabled',p.enabled,
    'allowances',(select jsonb_object_agg(tier,monthly_requests) from public.ai_plan_limits))
  from public.ai_plan_limits l cross join public.ai_policy p
  left join public.ai_usage u on u.user_id=p_user and u.period=date_trunc('month',now() at time zone 'UTC')::date
  where l.tier=public.entitlement_snapshot(p_user)->>'tier';
$$;
revoke all on function public.account_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.account_snapshot(uuid) to service_role;
create function public.account_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return public.account_snapshot(auth.uid());
end;
$$;
revoke all on function public.account_status() from public,anon;
grant execute on function public.account_status() to authenticated;

create function public.reserve_ai_request(p_user uuid,p_request uuid,p_feature text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  month_utc date := date_trunc('month',now() at time zone 'UTC')::date;
  policy public.ai_policy;
  snapshot jsonb;
  global_used integer;
begin
  if p_user is null or p_request is null or p_feature is null or p_feature not in ('analyze','correlations','report','recommend','doctor_visit') then raise exception 'Invalid request' using errcode='22023'; end if;
  -- Always lock global budget, then user. Concurrent users and concurrent instances obey the same ceiling.
  perform pg_advisory_xact_lock(81337001);
  perform pg_advisory_xact_lock(hashtextextended('ai:'||p_user::text,0));
  select * into policy from public.ai_policy where id=true;
  snapshot := public.account_snapshot(p_user);
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'Account not found' using errcode='42501'; end if;
  if exists(select 1 from public.ai_requests where user_id=p_user and request_id=p_request) then
    return jsonb_build_object('allowed',false,'code','DUPLICATE_REQUEST','usage',snapshot); end if;
  if not policy.enabled then return jsonb_build_object('allowed',false,'code','AI_DISABLED','usage',snapshot); end if;
  if (snapshot->>'remaining')::integer <= 0 then return jsonb_build_object('allowed',false,'code','QUOTA_EXCEEDED','usage',snapshot); end if;
  if (select count(*) from public.ai_requests where user_id=p_user and created_at > now()-interval '1 minute') >= policy.user_requests_per_minute then
    return jsonb_build_object('allowed',false,'code','RATE_LIMITED','usage',snapshot); end if;
  select used into global_used from public.ai_global_usage where period=month_utc;
  if coalesce(global_used,0) >= policy.global_monthly_requests then return jsonb_build_object('allowed',false,'code','BUDGET_EXCEEDED','usage',snapshot); end if;
  insert into public.ai_requests(user_id,request_id,feature,period) values(p_user,p_request,p_feature,month_utc);
  insert into public.ai_usage(user_id,period,used) values(p_user,month_utc,1) on conflict(user_id,period) do update set used=public.ai_usage.used+1;
  insert into public.ai_global_usage(period,used) values(month_utc,1) on conflict(period) do update set used=public.ai_global_usage.used+1;
  return jsonb_build_object('allowed',true,'usage',public.account_snapshot(p_user));
end;
$$;
revoke all on function public.reserve_ai_request(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,text) to service_role;
create function public.finish_ai_request(p_user uuid,p_request uuid,p_success boolean) returns void
language sql security definer set search_path='' as $$
  update public.ai_requests set state=case when p_success then 'succeeded' else 'failed' end
  where user_id=p_user and request_id=p_request and state='dispatched';
$$;
revoke all on function public.finish_ai_request(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_ai_request(uuid,uuid,boolean) to service_role;

create function public.export_account_data() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return jsonb_build_object('format','ambrosia-account-v1','exportedAt',now(),'userId',owner_id,
    'journal',coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.sync_records r where user_id=owner_id),'[]'::jsonb),
    'legacyJournal',coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.journal_entries r where user_id=owner_id),'[]'::jsonb),
    'legacyStatusUpdates',coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.entry_status_updates r where user_id=owner_id),'[]'::jsonb),
    'legacyProfile',(select to_jsonb(r) from public.profiles r where user_id=owner_id),
    'entitlement',(select to_jsonb(r) from public.entitlements r where user_id=owner_id),
    'usage',coalesce((select jsonb_agg(to_jsonb(r) order by period) from public.ai_usage r where user_id=owner_id),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(to_jsonb(r) order by created_at,request_id) from public.ai_requests r where user_id=owner_id),'[]'::jsonb));
end;
$$;
revoke all on function public.export_account_data() from public,anon;
grant execute on function public.export_account_data() to authenticated;
commit;
