-- Disposable test database only. Never run this fixture in a live project.
do $$ begin
  if (select public.account_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'tier') <> 'free' then raise exception 'default plan'; end if;
  if (select public.reserve_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),'analyze')->>'code') <> 'AI_DISABLED' then raise exception 'default kill switch'; end if;
end $$;
update public.ai_policy set enabled=true;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ begin
  begin
    insert into public.entitlements(user_id,state,valid_until) values(auth.uid(),'active',now()+interval '1 year');raise exception 'forged entitlement accepted';
  exception when insufficient_privilege then null;end;
  begin
    perform public.reserve_ai_request(auth.uid(),gen_random_uuid(),'analyze');raise exception 'browser reservation accepted';
  exception when insufficient_privilege then null;end;
  begin
    update public.ai_usage set used=0;raise exception 'browser quota reset accepted';
  exception when insufficient_privilege then null;end;
  begin
    select * from public.ai_policy;raise exception 'policy exposed';
  exception when insufficient_privilege then null;end;
end $$;
reset role;
set role service_role;
insert into public.entitlements(user_id,state,valid_until,source) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','trial',now()+interval '1 day','development');
do $$ declare u uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';r uuid := gen_random_uuid();result jsonb;begin
  if public.account_snapshot(u)->>'tier' <> 'premium' then raise exception 'trial not premium';end if;
  result:=public.reserve_ai_request(u,r,'analyze');
  if not (result->>'allowed')::boolean or (result->'usage'->>'used')::int<>1 then raise exception 'durable usage';end if;
  if public.reserve_ai_request(u,r,'analyze')->>'code' <> 'DUPLICATE_REQUEST' then raise exception 'duplicate dispatched';end if;
  perform public.finish_ai_request(u,r,false);
  if (select used from public.ai_usage where user_id=u)<>1 then raise exception 'failure incorrectly refunded';end if;
  perform public.reserve_ai_request(u,gen_random_uuid(),'report');perform public.reserve_ai_request(u,gen_random_uuid(),'recommend');
  if public.reserve_ai_request(u,gen_random_uuid(),'analyze')->>'code'<>'RATE_LIMITED' then raise exception 'burst limit bypass';end if;
  update public.entitlements set state='cancelled' where user_id=u;
  if public.account_snapshot(u)->>'tier'<>'premium' then raise exception 'cancelled prepaid access lost';end if;
  update public.entitlements set valid_until=now()-interval '1 second' where user_id=u;
  if public.account_snapshot(u)->>'tier'<>'free' or public.account_snapshot(u)->>'state'<>'expired' then raise exception 'expired trial retained';end if;
  if public.reserve_ai_request(u,gen_random_uuid(),'analyze')->>'code'<>'QUOTA_EXCEEDED' then raise exception 'free allowance bypassed';end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ declare data jsonb;begin
  if exists(select 1 from public.entitlements) or exists(select 1 from public.ai_usage) or exists(select 1 from public.ai_requests) then raise exception 'cross-account metadata exposed';end if;
  data:=public.export_account_data();
  if data->>'userId'<>'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' or jsonb_array_length(data->'requests')<>0 then raise exception 'cross-account export';end if;
  if jsonb_array_length(data->'journal')<>1 then raise exception 'own journal missing';end if;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ declare data jsonb;begin
  data:=public.export_account_data();
  if jsonb_array_length(data->'requests')<>3 or jsonb_array_length(data->'legacyJournal')<>1 or jsonb_array_length(data->'legacyStatusUpdates')<>1 then raise exception 'incomplete export';end if;
end $$;
reset role;
-- Simulates the FK effect of a successful Auth Admin hard-delete; only this temporary fixture deletes users.
delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ declare table_name text;n bigint;begin
  foreach table_name in array array['profiles','journal_entries','entry_status_updates','sync_records','entitlements','ai_usage','ai_requests'] loop
    execute format('select count(*) from public.%I where user_id=$1',table_name) into n using 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
    if n<>0 then raise exception 'account deletion left rows in %',table_name;end if;
  end loop;
  if not exists(select 1 from public.sync_records where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'other account deleted';end if;
  if (select used from public.ai_global_usage limit 1)<>3 then raise exception 'account deletion reset global budget';end if;
end $$;
-- Fresh synthetic accounts for actual concurrent PostgreSQL connections.
insert into auth.users values('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.entitlements(user_id,state,valid_until) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','active',now()+interval '1 day');
update public.ai_policy set global_monthly_requests=4,user_requests_per_minute=100;
delete from public.ai_global_usage;
select 'PASS: owner-only entitlements, trial/cancellation/expiry, persistent quotas, duplicate requests, bursts, export, deletion cascades and isolation' as result;
