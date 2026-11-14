-- Disposable fixture; no external billing credentials or production connection.
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set role service_role;
do $$ declare a uuid:='11111111-1111-4111-8111-111111111111';b uuid:='22222222-2222-4222-8222-222222222222';r jsonb;g bigint;stamp timestamptz:=now();h jsonb:='["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]';begin
 r:=public.billing_identity(a);if r->>'app_user_id' not like 'rc_%' then raise exception 'opaque identity';end if;
 if public.billing_identity(a)->>'app_user_id'<>r->>'app_user_id' then raise exception 'unstable identity';end if;
 r:=public.billing_start(a,true);g:=(r->'account'->>'generation')::bigint;
 if not (r->>'acquired')::boolean or (public.billing_start(a,true)->>'acquired')::boolean then raise exception 'billing lease bypass';end if;
 if not public.billing_apply(a,g,stamp,'active',now()+interval '30 days','fixture_month','SANDBOX',h) then raise exception 'purchase apply';end if;
 if public.account_snapshot(a)->>'tier'<>'premium' or (public.account_snapshot(a)->>'limit')::int<>60 then raise exception 'quota not updated';end if;
 -- Renew at a newer version; a delayed expiration snapshot cannot downgrade it.
 update public.billing_accounts set checked_at=null,attempted_at=null where user_id=a;
 r:=public.billing_start(a,true);g:=(r->'account'->>'generation')::bigint;
 if not public.billing_apply(a,g,stamp+interval '1 second','active',now()+interval '60 days','fixture_month','SANDBOX',h) then raise exception 'renewal';end if;
 update public.billing_accounts set checked_at=null,attempted_at=null where user_id=a;
 r:=public.billing_start(a,true);g:=(r->'account'->>'generation')::bigint;
 if public.billing_apply(a,g,stamp,'expired',now(),'fixture_month','SANDBOX','[]') then raise exception 'out of order expiry accepted';end if;
 if public.account_snapshot(a)->>'tier'<>'premium' then raise exception 'stale expiry downgraded';end if;
 if public.billing_apply(a,g-1,stamp+interval '2 seconds','expired',now(),'fixture_month','SANDBOX','[]') then raise exception 'stale generation applied';end if;
 -- Cancellation retains verified paid access. A verified revoked state removes it.
 update public.billing_accounts set checked_at=null,attempted_at=null where user_id=a;
 r:=public.billing_start(a,true);g:=(r->'account'->>'generation')::bigint;
 perform public.billing_apply(a,g,stamp+interval '2 seconds','cancelled',now()+interval '30 days','fixture_month','SANDBOX',h);
 if public.account_snapshot(a)->>'tier'<>'premium' then raise exception 'cancel removed paid access';end if;
 r:=public.billing_start(b,true);g:=(r->'account'->>'generation')::bigint;
 if public.billing_apply(b,g,stamp,'active',now()+interval '30 days','fixture_month','SANDBOX',h) then raise exception 'purchase stolen';end if;
 if public.account_snapshot(b)->>'tier'<>'free' then raise exception 'cross account grant';end if;
 update public.billing_accounts set checked_at=null,attempted_at=null where user_id=a;
 r:=public.billing_start(a,true);g:=(r->'account'->>'generation')::bigint;
 perform public.billing_apply(a,g,stamp+interval '3 seconds','expired',now()+interval '30 days','fixture_month','SANDBOX','[]');
 if public.account_snapshot(a)->>'tier'<>'free' or (public.account_snapshot(a)->>'limit')::int<>3 then raise exception 'refund quota';end if;
 r:=public.billing_event_receive('fixture-event','RENEWAL','SANDBOX',jsonb_build_array(public.billing_identity(a)->>'app_user_id'),now());
 update public.billing_events set completed_at=now() where event_id='fixture-event';
 if not (public.billing_event_receive('fixture-event','RENEWAL','SANDBOX',jsonb_build_array(public.billing_identity(a)->>'app_user_id'),now())->>'completed')::boolean then raise exception 'dedup';end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ begin
 begin perform public.billing_identity(auth.uid());raise exception 'browser billing RPC allowed';exception when insufficient_privilege then null;end;
 begin update public.entitlements set state='active',valid_until=now()+interval '1 year' where user_id=auth.uid();raise exception 'spoofed premium';exception when insufficient_privilege then null;end;
 begin perform * from public.billing_accounts;raise exception 'private billing table exposed';exception when insufficient_privilege then null;end;
 if public.export_account_data()->'billing'->>'user_id'<>auth.uid()::text or jsonb_array_length(public.export_account_data()->'billingEvents')<>1 then raise exception 'billing export';end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin if jsonb_array_length(public.export_account_data()->'billingEvents')<>0 then raise exception 'cross account export';end if;end $$;
reset role;
set role service_role;
do $$ declare uid uuid:='11111111-1111-4111-8111-111111111111';r jsonb;g bigint;begin
 update public.billing_accounts set attempted_at=null where user_id=uid;
 r:=public.billing_start(uid,true);g:=(r->'account'->>'generation')::bigint;
 perform public.billing_apply(uid,g,now()+interval '4 seconds','active',now()+interval '30 days','fixture_month','SANDBOX','["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]');
 perform public.billing_apply(uid,g,null,null,null,null,null,'[]','BILLING_IDENTITY_MISMATCH');
 if public.account_snapshot(uid)->>'tier'<>'free' then raise exception 'verified ownership mismatch retained access';end if;
end $$;
reset role;
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
do $$ begin
 if exists(select 1 from public.billing_accounts where user_id='11111111-1111-4111-8111-111111111111') or exists(select 1 from public.billing_events where event_id='fixture-event') then raise exception 'billing deletion incomplete';end if;
 if not exists(select 1 from public.billing_ownership where transaction_hash=repeat('a',64) and user_id is null) then raise exception 'ownership tombstone missing';end if;
end $$;
select 'PASS billing: leases, purchase/renewal/cancellation/refund, ordering, immutable ownership, quota changes, service-only RPCs, exports and deletion' as result;
