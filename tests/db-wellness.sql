-- Disposable fixture only; never run against a live project.
insert into auth.users(id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),('ffffffff-ffff-4fff-8fff-ffffffffffff');
set role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
do $$ declare id uuid:=public.checkin_id('2026-10-25');payload jsonb;r jsonb;begin
 if id<>'9d54bacd-b3c3-544d-92d2-9e21aab25672' then raise exception 'JS/SQL check-in ID mismatch';end if;
 payload:=jsonb_build_object('id',id,'date','2026-10-25','feeling',4,'mood',3,'energy',5,'sleep',2,'note','wellness note','updatedAt',now());
 r:=public.sync_write(id,'checkin',payload,false,0,gen_random_uuid(),auth.uid());
 if (r->>'version')::int<>1 then raise exception 'check-in write';end if;
 begin perform public.sync_write(id,'entry',jsonb_build_object('id',id,'date','2026-10-25','time','12:00','timestamp','2026-10-25T12:00Z','symptoms','[]'::jsonb,'intensity',3,'triggers','[]'::jsonb,'notes','','statusUpdates','[]'::jsonb),false,1,gen_random_uuid(),auth.uid());raise exception 'typed check-in replaced by legacy entry';exception when invalid_parameter_value then null;end;
 r:=public.sync_write(id,'checkin',payload||'{"mood":5}',false,0,gen_random_uuid(),auth.uid());
 if r->'payload'->>'mood'<>'3' then raise exception 'concurrent daily duplicate overwrote';end if;
 begin perform public.sync_write(gen_random_uuid(),'checkin',payload,false,0,gen_random_uuid(),auth.uid());raise exception 'random daily identity allowed';exception when invalid_parameter_value then null;end;
 begin perform public.sync_write(id,'checkin',payload||'{"sleep":6}',false,1,gen_random_uuid(),auth.uid());raise exception 'invalid scale accepted';exception when invalid_parameter_value then null;end;
 payload:=jsonb_build_object('id','eeee0000-0000-4000-8000-000000000001','title','Recovery','startDate','2026-10-20','endDate','2026-10-25','status','recovered','notes','','updatedAt',now());
 perform public.sync_write('eeee0000-0000-4000-8000-000000000001','episode',payload,false,0,gen_random_uuid(),auth.uid());
 payload:=jsonb_build_object('id','eeee0000-0000-4000-8000-000000000002','date','2026-10-25','time','12:00','timestamp','2026-10-25T12:00Z','symptoms',jsonb_build_array('fatigue'),'intensity',3,'triggers','[]'::jsonb,'notes','legacy-compatible','statusUpdates','[]'::jsonb,'symptomStart','2026-10-20','symptomEnd','2026-10-25','episodeId','eeee0000-0000-4000-8000-000000000001');
 perform public.sync_write('eeee0000-0000-4000-8000-000000000002','entry',payload,false,0,gen_random_uuid(),auth.uid());
 if jsonb_array_length(public.export_account_data()->'journal')<>3 then raise exception 'wellness export incomplete';end if;
end $$;
select public.chat_save_conversation('eeee0000-0000-4000-8000-000000000003','A conversation','{"period":"7"}',null,auth.uid());
do $$ begin
 begin insert into public.chat_messages(user_id,conversation_id,request_id,role,sequence,content,state)values(auth.uid(),'eeee0000-0000-4000-8000-000000000003',gen_random_uuid(),'assistant',1,'forged','completed');raise exception 'forged assistant accepted';exception when insufficient_privilege then null;end;
 begin perform public.chat_begin(auth.uid(),'eeee0000-0000-4000-8000-000000000003',gen_random_uuid(),'question','{}');raise exception 'browser bypassed chat quota';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',false);
do $$ begin
 if exists(select 1 from public.sync_records) or exists(select 1 from public.chat_conversations) or exists(select 1 from public.chat_messages) then raise exception 'cross-account read';end if;
 begin perform public.chat_save_conversation(gen_random_uuid(),'Wrong session','{}',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');raise exception 'account-switch metadata leak';exception when insufficient_privilege then null;end;
 begin perform public.chat_delete_conversation('eeee0000-0000-4000-8000-000000000003','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');raise exception 'account-switch deletion';exception when insufficient_privilege then null;end;
 perform public.chat_delete_conversation('eeee0000-0000-4000-8000-000000000003',auth.uid());
end $$;
reset role;
update public.ai_policy set global_monthly_requests=500,user_requests_per_minute=100;
update public.ai_plan_limits set chat_monthly_requests=2 where tier='free';
set role service_role;
do $$ declare uid uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';cid uuid:='eeee0000-0000-4000-8000-000000000003';rid uuid:='eeee0000-0000-4000-8000-000000000004';r jsonb;begin
 r:=public.chat_begin(uid,cid,rid,'First question','{}');if not (r->>'allowed')::boolean then raise exception 'valid chat blocked';end if;
 if public.chat_begin(uid,cid,rid,'First question','{}')->>'code'<>'DUPLICATE_REQUEST' then raise exception 'duplicate not retained';end if;
 if public.chat_begin(uid,cid,gen_random_uuid(),'Concurrent turn','{}')->>'code'<>'CHAT_BUSY' then raise exception 'concurrent thread turn allowed';end if;
 r:=public.chat_finish(uid,cid,rid,'An observation','[]',true);if r->>'role'<>'assistant' then raise exception 'assistant not saved';end if;
 rid:='eeee0000-0000-4000-8000-000000000005';perform public.chat_begin(uid,cid,rid,'Failed question','{}');perform public.chat_finish(uid,cid,rid,'','[]',false);
 if (select state from public.chat_messages where user_id=uid and request_id=rid and role='user')<>'failed' then raise exception 'failed question disappeared';end if;
 if public.chat_begin(uid,cid,gen_random_uuid(),'Over quota','{}')->>'code'<>'QUOTA_EXCEEDED' then raise exception 'chat quota bypass';end if;
 perform public.reserve_ai_request(uid,gen_random_uuid(),'report');
 if (select used from public.ai_usage where user_id=uid)<>1 or (select used from public.ai_chat_usage where user_id=uid)<>2 then raise exception 'chat/report quota mixed';end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',false);
do $$ declare x jsonb;begin
 x:=public.export_account_data();if jsonb_array_length(x->'messages')<>3 or jsonb_array_length(x->'conversations')<>1 or jsonb_array_length(x->'chatUsage')<>1 then raise exception 'chat export incomplete';end if;
 perform public.chat_delete_conversation('eeee0000-0000-4000-8000-000000000003',auth.uid());
 if exists(select 1 from public.chat_messages) then raise exception 'conversation messages not deleted';end if;
 x:=public.chat_save_conversation('eeee0000-0000-4000-8000-000000000003','Try to resurrect','{}',null,auth.uid());if not (x->>'deleted')::boolean then raise exception 'conversation resurrected';end if;
end $$;
reset role;
delete from auth.users where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $$ begin
 if exists(select 1 from public.sync_records where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') or exists(select 1 from public.chat_conversations where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') or exists(select 1 from public.ai_chat_usage where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'account deletion missed wellness/chat';end if;
end $$;
insert into auth.users(id)values('99999999-9999-4999-8999-999999999999'),('88888888-8888-4888-8888-888888888888');
insert into public.entitlements(user_id,state,valid_until)values('88888888-8888-4888-8888-888888888888','active',now()+interval '1 day');
update public.ai_policy set global_monthly_requests=6;
delete from public.ai_global_usage;
select 'PASS: daily identity/CAS, episode and legacy entry validation, chat RLS/ownership, durable messages, separate quotas, export/deletion' as result;
