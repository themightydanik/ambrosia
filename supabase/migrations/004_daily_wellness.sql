-- Apply once after 003. Existing entries/profiles retain their validation and CAS behavior.
begin;
alter table public.sync_records drop constraint sync_records_kind_check;
alter table public.sync_records add constraint sync_records_kind_check check(kind in ('entry','profile','checkin','episode'));
alter function public.sync_write(uuid,text,jsonb,boolean,bigint,uuid,uuid) rename to sync_write_legacy;
revoke all on function public.sync_write_legacy(uuid,text,jsonb,boolean,bigint,uuid,uuid) from public,anon,authenticated;
create function public.checkin_id(p_day text) returns uuid language plpgsql immutable set search_path='' as $$
declare h text;
begin
 h:=encode(sha256(convert_to('ambrosia-checkin-v1:'||p_day,'UTF8')),'hex');
 h:=overlay(h placing '5' from 13 for 1);
 h:=overlay(h placing to_hex((('x'||substr(h,17,1))::bit(4)::integer & 3) | 8) from 17 for 1);
 return (substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid;
end $$;
revoke all on function public.checkin_id(text) from public,anon;
grant execute on function public.checkin_id(text) to authenticated;
create function public.sync_write(p_id uuid,p_kind text,p_payload jsonb,p_deleted boolean,p_base bigint,p_operation uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();current_row public.sync_records;k text;day_value date;
begin
 if owner_id is null or p_user is distinct from owner_id then raise exception 'Expected account required' using errcode='42501';end if;
 -- Keep record identity immutable even when an old entry/profile validator is used.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||p_id::text,0));
 if exists(select 1 from public.sync_records where user_id=owner_id and id=p_id and kind is distinct from p_kind) then raise exception 'Document kind is immutable' using errcode='22023';end if;
 if p_kind in ('entry','profile') then
   if p_kind='entry' then
     if p_payload ? 'symptomStart' then perform (p_payload->>'symptomStart')::date;end if;
     if p_payload ? 'symptomEnd' and p_payload->>'symptomEnd' is not null then
       if (p_payload->>'symptomEnd')::date < (p_payload->>'symptomStart')::date then raise exception 'Invalid symptom dates' using errcode='22023';end if;
     end if;
     if p_payload->>'episodeId' is not null then perform (p_payload->>'episodeId')::uuid;end if;
   end if;
   return public.sync_write_legacy(p_id,p_kind,p_payload,p_deleted,p_base,p_operation,p_user);
 end if;
 if p_kind is null or p_kind not in ('checkin','episode') or p_id is null or p_operation is null or p_deleted is null or p_base is null or p_base<0
   or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 or p_payload->>'id' is distinct from p_id::text then
   raise exception 'Invalid wellness document' using errcode='22023';end if;
 if p_kind='checkin' then
   if coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date' using errcode='22023';end if;
   day_value:=(p_payload->>'date')::date;
   if p_id<>public.checkin_id(p_payload->>'date') then raise exception 'Check-in identity must match local day' using errcode='22023';end if;
   foreach k in array array['feeling','mood','energy','sleep'] loop
     if jsonb_typeof(p_payload->k) is distinct from 'number' or (p_payload->>k)::numeric not between 1 and 5 or trunc((p_payload->>k)::numeric)<>(p_payload->>k)::numeric then raise exception 'Invalid check-in scale' using errcode='22023';end if;
   end loop;
   if jsonb_typeof(p_payload->'note') is distinct from 'string' or length(p_payload->>'note')>600 then raise exception 'Invalid note' using errcode='22023';end if;
 else
   if jsonb_typeof(p_payload->'title') is distinct from 'string' or length(trim(p_payload->>'title')) not between 1 and 100
      or coalesce(p_payload->>'status','') not in ('ongoing','recovering','recovered')
      or coalesce(p_payload->>'startDate','') !~ '^\d{4}-\d{2}-\d{2}$'
      or jsonb_typeof(p_payload->'notes') is distinct from 'string' or length(p_payload->>'notes')>600 then raise exception 'Invalid episode' using errcode='22023';end if;
   day_value:=(p_payload->>'startDate')::date;
   if p_payload->>'endDate' is not null and (p_payload->>'endDate')::date<day_value then raise exception 'Invalid end date' using errcode='22023';end if;
   if p_payload->>'status'='recovered' and p_payload->>'endDate' is null then raise exception 'Recovery date required' using errcode='22023';end if;
 end if;
 perform (p_payload->>'updatedAt')::timestamptz;
 if p_payload->>'updatedAt' is null then raise exception 'Timestamp required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||p_id::text,0));
 select * into current_row from public.sync_records where user_id=owner_id and id=p_id for update;
 if found then
   if current_row.kind<>p_kind then raise exception 'Document kind is immutable' using errcode='22023';end if;
   if current_row.operation_id=p_operation or current_row.version<>p_base then return to_jsonb(current_row);end if;
   update public.sync_records set payload=p_payload,deleted=p_deleted,version=version+1,operation_id=p_operation,updated_at=clock_timestamp() where user_id=owner_id and id=p_id returning * into current_row;
 else
   if p_base<>0 then raise exception 'Missing document; keep local data' using errcode='40001';end if;
   insert into public.sync_records(user_id,id,kind,payload,deleted,operation_id) values(owner_id,p_id,p_kind,p_payload,p_deleted,p_operation) returning * into current_row;
 end if;
 return to_jsonb(current_row);
end $$;
revoke all on function public.sync_write(uuid,text,jsonb,boolean,bigint,uuid,uuid) from public,anon;
grant execute on function public.sync_write(uuid,text,jsonb,boolean,bigint,uuid,uuid) to authenticated;
commit;
