-- Apply once after 005. Service-only billing metadata; no health data or raw receipts.
begin;
create table public.billing_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 app_user_id text not null unique default ('rc_'||gen_random_uuid()::text),
 generation bigint not null default 0,
 lease_until timestamptz,
 checked_at timestamptz,
 attempted_at timestamptz,
 snapshot_at timestamptz,
 product_id text,
 environment text,
 status text not null default 'unverified',
 last_error text
);
create table public.billing_events (
 event_id text primary key check(length(event_id) between 1 and 200),
 event_type text not null,
 environment text not null,
 subjects jsonb not null,
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 completed_at timestamptz
);
-- An irreversible transaction fingerprint prevents reassignment even after account deletion.
-- Deletion unlinks the owner. No receipt, order ID, email or health data is retained here.
create table public.billing_ownership (
 transaction_hash text primary key check(transaction_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.billing_accounts enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_ownership enable row level security;
revoke all on public.billing_accounts,public.billing_events,public.billing_ownership from public,anon,authenticated;
grant all on public.billing_accounts,public.billing_events,public.billing_ownership to service_role;
create function public.billing_identity(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.billing_accounts;begin
 insert into public.billing_accounts(user_id) values(p_user) on conflict do nothing;
 select * into r from public.billing_accounts where user_id=p_user;
 return to_jsonb(r);
end $$;
create function public.billing_start(p_user uuid,p_force boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.billing_accounts;begin
 perform public.billing_identity(p_user);
 select * into r from public.billing_accounts where user_id=p_user for update;
 if r.lease_until>now() or r.attempted_at>now()-(case when p_force then interval '3 seconds' else interval '5 minutes' end) then
  return jsonb_build_object('acquired',false,'account',to_jsonb(r));end if;
 update public.billing_accounts set generation=generation+1,attempted_at=now(),lease_until=now()+interval '45 seconds' where user_id=p_user returning * into r;
 return jsonb_build_object('acquired',true,'account',to_jsonb(r));
end $$;
create function public.billing_apply(p_user uuid,p_generation bigint,p_snapshot_at timestamptz,p_state text,p_until timestamptz,p_product text,p_environment text,p_transactions jsonb,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.billing_accounts;h text;begin
 select * into r from public.billing_accounts where user_id=p_user for update;
 if not found or r.generation<>p_generation then return false;end if;
 if p_error is not null then
  if p_error='BILLING_IDENTITY_MISMATCH' then
   update public.entitlements set state='expired',valid_until=now(),updated_at=now() where user_id=p_user and source='google_play';
  end if;
  update public.billing_accounts set lease_until=null,last_error=p_error where user_id=p_user;return false;end if;
 if p_snapshot_at is null or p_snapshot_at>now()+interval '5 minutes' or p_snapshot_at<coalesce(r.snapshot_at,'epoch') then
  update public.billing_accounts set lease_until=null,last_error='STALE_SNAPSHOT' where user_id=p_user;return false;end if;
 if p_state not in ('active','trial','cancelled','expired','free') or p_environment not in ('PRODUCTION','SANDBOX') or jsonb_typeof(p_transactions)<>'array' then raise exception 'Invalid billing state';end if;
 -- Lock fingerprints consistently across accounts before checking immutable ownership.
 for h in select value from jsonb_array_elements_text(p_transactions) order by value loop
  if h !~ '^[0-9a-f]{64}$' then raise exception 'Invalid fingerprint';end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-owner:'||h,0));
  if exists(select 1 from public.billing_ownership where transaction_hash=h and user_id is distinct from p_user) then
   update public.entitlements set state='expired',valid_until=now(),updated_at=now() where user_id=p_user and source='google_play';
   update public.billing_accounts set lease_until=null,last_error='PURCHASE_OWNED_BY_ANOTHER_ACCOUNT' where user_id=p_user;return false;end if;
 end loop;
 if p_state in ('active','trial','cancelled') and (p_until is null or p_until<=now() or jsonb_array_length(p_transactions)=0) then raise exception 'Missing valid subscription';end if;
 for h in select value from jsonb_array_elements_text(p_transactions) loop
  insert into public.billing_ownership(transaction_hash,user_id) values(h,p_user) on conflict do nothing;
 end loop;
 -- Explicitly verified Play state may replace a previous manual grant. Never a client assertion.
 insert into public.entitlements(user_id,state,valid_until,source,provider_reference)
 values(p_user,p_state,p_until,'google_play',r.app_user_id)
 on conflict(user_id) do update set state=excluded.state,valid_until=excluded.valid_until,source=excluded.source,provider_reference=excluded.provider_reference,updated_at=now();
 update public.billing_accounts set snapshot_at=p_snapshot_at,checked_at=now(),lease_until=null,product_id=p_product,environment=p_environment,status=p_state,last_error=null where user_id=p_user;
 return true;
end $$;
create function public.billing_event_receive(p_id text,p_type text,p_environment text,p_subjects jsonb,p_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.billing_events;begin
 insert into public.billing_events(event_id,event_type,environment,subjects,occurred_at) values(p_id,p_type,p_environment,p_subjects,p_at) on conflict do nothing;
 select * into r from public.billing_events where event_id=p_id;
 if r.event_type<>p_type or r.environment<>p_environment or r.subjects<>p_subjects or r.occurred_at<>p_at then raise exception 'Event identity mismatch';end if;
 return jsonb_build_object('completed',r.completed_at is not null);
end $$;
-- No billing RPC is exposed to browser roles, including identity creation or claiming purchases.
revoke all on function public.billing_identity(uuid),public.billing_start(uuid,boolean),public.billing_apply(uuid,bigint,timestamptz,text,timestamptz,text,text,jsonb,text),public.billing_event_receive(text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.billing_identity(uuid),public.billing_start(uuid,boolean),public.billing_apply(uuid,bigint,timestamptz,text,timestamptz,text,text,jsonb,text),public.billing_event_receive(text,text,text,jsonb,timestamptz) to service_role;
alter function public.export_account_data() rename to export_before_billing;
revoke all on function public.export_before_billing() from public,anon,authenticated;
create function public.export_account_data() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 return public.export_before_billing()||jsonb_build_object('billing',(select to_jsonb(b)-'lease_until'-'generation' from public.billing_accounts b where user_id=uid),
 'billingEvents',coalesce((select jsonb_agg(to_jsonb(e)-'subjects') from public.billing_events e where e.subjects ? (select app_user_id from public.billing_accounts where user_id=uid)),'[]'::jsonb));
end $$;
revoke all on function public.export_account_data() from public,anon;
grant execute on function public.export_account_data() to authenticated;
-- Events have no FK because they may name multiple owners. Remove that owner's opaque identity at deletion.
create function public.billing_delete_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.billing_events set subjects=subjects-old.app_user_id where subjects ? old.app_user_id;
 delete from public.billing_events where subjects='[]'::jsonb;
 return old;
end $$;
revoke all on function public.billing_delete_identity() from public,anon,authenticated;
create trigger billing_delete_identity before delete on public.billing_accounts for each row execute function public.billing_delete_identity();
commit;
