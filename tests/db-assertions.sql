-- Actual PostgreSQL assertions. Every failure aborts the runner.
do $$ begin
  if (select count(*) from public.sync_records) <> 2 then raise exception 'legacy backfill count'; end if;
  if (select payload->'statusUpdates'->0->>'notes' from public.sync_records where kind='entry') <> 'legacy status preserved' then raise exception 'legacy history missing'; end if;
  if (select notes from public.journal_entries limit 1) <> 'original note' then raise exception 'legacy archive changed'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $$ declare r jsonb; v jsonb; begin
  select payload into v from public.sync_records where kind='entry';
  r := public.sync_write('11111111-1111-4111-8111-111111111111','entry',v || '{"notes":"first edit"}',false,1,'99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if (r->>'version')::int <> 2 then raise exception 'CAS write failed'; end if;
  r := public.sync_write('11111111-1111-4111-8111-111111111111','entry',v || '{"notes":"stale edit"}',false,1,'88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if r->'payload'->>'notes' <> 'first edit' then raise exception 'stale update overwrote data'; end if;
  r := public.sync_write('11111111-1111-4111-8111-111111111111','entry',v || '{"notes":"first edit"}',false,1,'99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if (r->>'version')::int <> 2 then raise exception 'retry not idempotent'; end if;
  r := public.sync_write('11111111-1111-4111-8111-111111111111','entry',r->'payload',true,2,'77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if not (r->>'deleted')::boolean or (r->>'version')::int <> 3 then raise exception 'tombstone missing'; end if;
  begin
    delete from public.sync_records; raise exception 'hard delete allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.sync_records set version=99; raise exception 'direct write allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.journal_entries set notes='old client'; raise exception 'old client writes allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ declare r jsonb; begin
  if exists(select 1 from public.sync_records) then raise exception 'cross-account SELECT exposed data'; end if;
  if exists(select 1 from public.journal_entries) then raise exception 'legacy RLS exposed data'; end if;
  r := public.sync_write('00000000-0000-4000-8000-000000000001','profile','{"name":"B","age":null,"avatar":"🌿","occupation":"","language":"en"}',false,0,'66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if r->>'user_id' <> 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' then raise exception 'RPC owner spoofed'; end if;
  begin
    perform public.sync_write('00000000-0000-4000-8000-000000000001','profile','{"name":"spoof","age":null,"avatar":"🌿","occupation":"","language":"en"}',false,0,'66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'account-switch write was allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sync_write('11111111-1111-4111-8111-111111111111','entry','{}',false,0,'66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'malformed document accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.sync_write('00000000-0000-4000-8000-000000000001','profile','{}',false,0,'66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.sync_records; raise exception 'anonymous SELECT allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: migration/backfill, CAS, retry, tombstones, direct-write protection, old-client cutover, RLS, owner-bound RPC, anonymous denial' as result;
