-- Apply once after 004. Separate chat storage: no assistant write access to health records.
begin;
alter table public.ai_plan_limits add column chat_monthly_requests integer not null default 10 check(chat_monthly_requests between 0 and 10000);
update public.ai_plan_limits set chat_monthly_requests=120 where tier='premium';
alter table public.ai_requests drop constraint ai_requests_feature_check;
alter table public.ai_requests add constraint ai_requests_feature_check check(feature in ('analyze','correlations','report','recommend','doctor_visit','chat'));
create table public.ai_chat_usage(user_id uuid not null references auth.users(id) on delete cascade,period date not null,used integer not null default 0 check(used>=0),primary key(user_id,period));
create table public.chat_conversations(
 user_id uuid not null references auth.users(id) on delete cascade,id uuid not null,title text not null check(length(title) between 1 and 100),
 context_config jsonb not null default '{}' check(jsonb_typeof(context_config)='object' and octet_length(context_config::text)<=6000),linked_record jsonb,
 deleted boolean not null default false,next_sequence bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(user_id,id)
);
create table public.chat_messages(
 user_id uuid not null references auth.users(id) on delete cascade,conversation_id uuid not null,request_id uuid not null,
 role text not null check(role in ('user','assistant')),sequence bigint not null,content text not null check(length(content)<=16000),
 state text not null check(state in ('sending','failed','completed')),sources jsonb not null default '[]' check(jsonb_typeof(sources)='array'),
 context_meta jsonb not null default '{}' check(jsonb_typeof(context_meta)='object'),created_at timestamptz not null default now(),
 primary key(user_id,request_id,role),unique(user_id,conversation_id,sequence),
 foreign key(user_id,conversation_id) references public.chat_conversations(user_id,id) on delete cascade
);
create index chat_messages_conversation_order on public.chat_messages(user_id,conversation_id,sequence desc);
alter table public.ai_chat_usage enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
create policy chat_usage_owner on public.ai_chat_usage for select to authenticated using((select auth.uid())=user_id);
create policy conversation_owner on public.chat_conversations for select to authenticated using((select auth.uid())=user_id);
create policy message_owner on public.chat_messages for select to authenticated using((select auth.uid())=user_id);
revoke all on public.ai_chat_usage,public.chat_conversations,public.chat_messages from public,anon,authenticated;
grant select on public.ai_chat_usage,public.chat_conversations,public.chat_messages to authenticated;
grant all on public.ai_chat_usage,public.chat_conversations,public.chat_messages to service_role;

create function public.chat_snapshot(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('used',coalesce(u.used,0),'limit',l.chat_monthly_requests,'remaining',greatest(0,l.chat_monthly_requests-coalesce(u.used,0)),
 'renewsAt',((date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC'),
 'allowances',(select jsonb_object_agg(tier,chat_monthly_requests) from public.ai_plan_limits))
 from public.ai_plan_limits l left join public.ai_chat_usage u on u.user_id=p_user and u.period=date_trunc('month',now() at time zone 'UTC')::date
 where l.tier=public.entitlement_snapshot(p_user)->>'tier';
$$;
revoke all on function public.chat_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.chat_snapshot(uuid) to service_role;
alter function public.account_status() rename to account_status_v3;
revoke all on function public.account_status_v3() from public,anon,authenticated;
create function public.account_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 return public.account_snapshot(auth.uid())||jsonb_build_object('chat',public.chat_snapshot(auth.uid()));
end $$;
revoke all on function public.account_status() from public,anon;
grant execute on function public.account_status() to authenticated;

alter function public.reserve_ai_request(uuid,uuid,text) rename to reserve_ai_report_request;
create function public.reserve_ai_request(p_user uuid,p_request uuid,p_feature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare policy public.ai_policy;month_utc date:=date_trunc('month',now() at time zone 'UTC')::date;snapshot jsonb;global_used integer;
begin
 if p_feature is distinct from 'chat' then return public.reserve_ai_report_request(p_user,p_request,p_feature);end if;
 if p_user is null or p_request is null then raise exception 'Invalid request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(81337001);perform pg_advisory_xact_lock(hashtextextended('ai:'||p_user::text,0));
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Account required' using errcode='42501';end if;
 select * into policy from public.ai_policy where id=true;snapshot:=public.chat_snapshot(p_user);
 if exists(select 1 from public.ai_requests where user_id=p_user and request_id=p_request) then return jsonb_build_object('allowed',false,'code','DUPLICATE_REQUEST','usage',snapshot);end if;
 if not policy.enabled then return jsonb_build_object('allowed',false,'code','AI_DISABLED','usage',snapshot);end if;
 if (snapshot->>'remaining')::integer<=0 then return jsonb_build_object('allowed',false,'code','QUOTA_EXCEEDED','usage',snapshot);end if;
 if (select count(*) from public.ai_requests where user_id=p_user and created_at>now()-interval '1 minute')>=policy.user_requests_per_minute then return jsonb_build_object('allowed',false,'code','RATE_LIMITED','usage',snapshot);end if;
 select used into global_used from public.ai_global_usage where period=month_utc;
 if coalesce(global_used,0)>=policy.global_monthly_requests then return jsonb_build_object('allowed',false,'code','BUDGET_EXCEEDED','usage',snapshot);end if;
 insert into public.ai_requests(user_id,request_id,feature,period) values(p_user,p_request,'chat',month_utc);
 insert into public.ai_chat_usage(user_id,period,used) values(p_user,month_utc,1) on conflict(user_id,period) do update set used=public.ai_chat_usage.used+1;
 insert into public.ai_global_usage(period,used) values(month_utc,1) on conflict(period) do update set used=public.ai_global_usage.used+1;
 return jsonb_build_object('allowed',true,'usage',public.chat_snapshot(p_user));
end $$;
revoke all on function public.reserve_ai_request(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,uuid,text) to service_role;

create function public.chat_save_conversation(p_id uuid,p_title text,p_config jsonb,p_linked jsonb,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();r public.chat_conversations;
begin
 if uid is null or p_user is distinct from uid then raise exception 'Expected account required' using errcode='42501';end if;
 if p_id is null or p_title is null or length(trim(p_title)) not between 1 and 100 or p_config is null or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>6000 or p_linked is not null and (jsonb_typeof(p_linked)<>'object' or octet_length(p_linked::text)>200) then raise exception 'Invalid conversation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('chat-save:'||uid::text,0));
 select * into r from public.chat_conversations where user_id=uid and id=p_id for update;
 if found then
   if r.deleted then return to_jsonb(r);end if;
   update public.chat_conversations set title=trim(p_title),context_config=p_config,linked_record=p_linked,updated_at=now() where user_id=uid and id=p_id returning * into r;
 else
   if (select count(*) from public.chat_conversations where user_id=uid and not deleted)>=200 then raise exception 'Conversation limit reached' using errcode='54000';end if;
   insert into public.chat_conversations(user_id,id,title,context_config,linked_record) values(uid,p_id,trim(p_title),p_config,p_linked) returning * into r;
 end if;return to_jsonb(r);
end $$;
revoke all on function public.chat_save_conversation(uuid,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.chat_save_conversation(uuid,text,jsonb,jsonb,uuid) to authenticated;
create function public.chat_delete_conversation(p_id uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_user is distinct from auth.uid() then raise exception 'Authentication required' using errcode='42501';end if;
 update public.chat_conversations set deleted=true,title='Deleted',context_config='{}',linked_record=null,updated_at=now() where user_id=auth.uid() and id=p_id;
 delete from public.chat_messages where user_id=auth.uid() and conversation_id=p_id;
end $$;
revoke all on function public.chat_delete_conversation(uuid,uuid) from public,anon;
grant execute on function public.chat_delete_conversation(uuid,uuid) to authenticated;

create function public.chat_begin(p_user uuid,p_conversation uuid,p_request uuid,p_question text,p_context jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.chat_conversations;m public.chat_messages;a public.chat_messages;reservation jsonb;
begin
 if p_question is null or length(trim(p_question)) not between 1 and 2000 or p_context is null or jsonb_typeof(p_context)<>'object' or octet_length(p_context::text)>16000 then raise exception 'Invalid message' using errcode='22023';end if;
 select * into c from public.chat_conversations where user_id=p_user and id=p_conversation for update;
 if not found or c.deleted then return jsonb_build_object('allowed',false,'code','CHAT_DELETED');end if;
 select * into m from public.chat_messages where user_id=p_user and request_id=p_request and role='user';
 if found then
   select * into a from public.chat_messages where user_id=p_user and request_id=p_request and role='assistant';
   return jsonb_build_object('allowed',false,'code','DUPLICATE_REQUEST','message',to_jsonb(m),'answer',case when a.request_id is not null then to_jsonb(a) else null end);
 end if;
 update public.chat_messages set state='failed' where user_id=p_user and conversation_id=p_conversation and role='user' and state='sending' and created_at<now()-interval '2 minutes';
 if exists(select 1 from public.chat_messages where user_id=p_user and conversation_id=p_conversation and role='user' and state='sending') then return jsonb_build_object('allowed',false,'code','CHAT_BUSY');end if;
 reservation:=public.reserve_ai_request(p_user,p_request,'chat');if not (reservation->>'allowed')::boolean then return reservation;end if;
 insert into public.chat_messages(user_id,conversation_id,request_id,role,sequence,content,state,context_meta) values(p_user,p_conversation,p_request,'user',c.next_sequence,p_question,'sending',p_context) returning * into m;
 update public.chat_conversations set next_sequence=next_sequence+2,updated_at=now() where user_id=p_user and id=p_conversation;
 return reservation||jsonb_build_object('message',to_jsonb(m));
end $$;
revoke all on function public.chat_begin(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.chat_begin(uuid,uuid,uuid,text,jsonb) to service_role;
create function public.chat_finish(p_user uuid,p_conversation uuid,p_request uuid,p_text text,p_sources jsonb,p_success boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.chat_conversations;m public.chat_messages;a public.chat_messages;
begin
 select * into c from public.chat_conversations where user_id=p_user and id=p_conversation for update;
 if not found or c.deleted then return null;end if;
 select * into m from public.chat_messages where user_id=p_user and request_id=p_request and conversation_id=p_conversation and role='user' for update;
 if not found then return null;end if;
 if m.state='sending' then
   if p_success and (p_text is null or length(p_text) not between 1 and 16000 or p_sources is null or jsonb_typeof(p_sources)<>'array' or octet_length(p_sources::text)>12000) then raise exception 'Invalid answer' using errcode='22023';end if;
   update public.chat_messages set state=case when p_success then 'completed' else 'failed' end where user_id=p_user and request_id=p_request and role='user';
   if p_success then insert into public.chat_messages(user_id,conversation_id,request_id,role,sequence,content,state,sources) values(p_user,p_conversation,p_request,'assistant',m.sequence+1,p_text,'completed',p_sources) returning * into a;end if;
   perform public.finish_ai_request(p_user,p_request,p_success);
 else select * into a from public.chat_messages where user_id=p_user and request_id=p_request and role='assistant';end if;
 return to_jsonb(a);
end $$;
revoke all on function public.chat_finish(uuid,uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.chat_finish(uuid,uuid,uuid,text,jsonb,boolean) to service_role;

alter function public.export_account_data() rename to export_account_data_v3;
revoke all on function public.export_account_data_v3() from public,anon,authenticated;
create function public.export_account_data() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 return public.export_account_data_v3()||jsonb_build_object('conversations',coalesce((select jsonb_agg(to_jsonb(c) order by created_at,id) from public.chat_conversations c where user_id=uid),'[]'::jsonb),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by conversation_id,sequence) from public.chat_messages m where user_id=uid),'[]'::jsonb),'chatUsage',coalesce((select jsonb_agg(to_jsonb(u) order by period) from public.ai_chat_usage u where user_id=uid),'[]'::jsonb));
end $$;
revoke all on function public.export_account_data() from public,anon;
grant execute on function public.export_account_data() to authenticated;
commit;
