-- Run AFTER 001_initial_schema.sql, once, in Supabase Dashboard SQL Editor.
-- Transactional, additive migration: original data is retained as a read-only archive.
begin;
create table public.sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('entry','profile')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  deleted boolean not null default false,
  operation_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  constraint sync_profile_id check ((kind = 'profile') = (id = '00000000-0000-4000-8000-000000000001'::uuid)),
  constraint sync_profile_live check (kind <> 'profile' or not deleted),
  constraint sync_payload_size check (octet_length(payload::text) <= 262144)
);
alter table public.sync_records enable row level security;
create policy sync_owner_read on public.sync_records for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.sync_records from public, anon, authenticated;
grant select on public.sync_records to authenticated;
-- The primary key supports all owner-scoped keyset pages, including tombstones.

-- Preserve IDs used by imports #10 and restore #11, all historical notes and status events.
insert into public.sync_records (user_id,id,kind,payload)
select e.user_id,e.id,'entry',jsonb_build_object(
  'id',e.id,'timestamp',e.recorded_at,'date',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD'),
  'time',to_char(e.recorded_at at time zone 'UTC','HH24:MI'),'category',e.category,
  'symptoms',e.symptoms,'intensity',e.intensity,'triggers',e.triggers,'notes',e.notes,
  'criticalTracking',e.critical_tracking,'isUpdate',false,
  'statusUpdates',coalesce((select jsonb_agg(jsonb_build_object(
    'id',u.id,'status',u.status,'notes',u.notes,'timestamp',u.recorded_at,
    'date',to_char(u.recorded_at at time zone 'UTC','YYYY-MM-DD'),'time',to_char(u.recorded_at at time zone 'UTC','HH24:MI')
  ) order by u.recorded_at,u.id) from public.entry_status_updates u where u.entry_id=e.id and u.user_id=e.user_id),'[]'::jsonb)
) from public.journal_entries e;
insert into public.sync_records(user_id,id,kind,payload)
select user_id,'00000000-0000-4000-8000-000000000001','profile',jsonb_build_object(
  'name',display_name,'age',age,'occupation',occupation,'avatar',avatar,'language',language
) from public.profiles;

create function public.sync_write(p_id uuid,p_kind text,p_payload jsonb,p_deleted boolean,p_base bigint,p_operation uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_row public.sync_records;
begin
  if owner_id is null or p_user is distinct from owner_id then raise exception 'Authentication required for the expected account' using errcode='42501'; end if;
  if p_id is null or p_operation is null or p_deleted is null or p_base is null or p_base < 0
    or p_kind is null or p_kind not in ('entry','profile') or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 262144 then raise exception 'Invalid sync document' using errcode='22023'; end if;
  if (p_kind = 'profile') <> (p_id = '00000000-0000-4000-8000-000000000001'::uuid)
    or (p_kind = 'profile' and p_deleted) then raise exception 'Invalid document identity' using errcode='22023'; end if;
  if p_kind = 'profile' then
    if not (p_payload ?& array['name','avatar','occupation','age','language'])
      or jsonb_typeof(p_payload->'name') <> 'string' or jsonb_typeof(p_payload->'occupation') <> 'string'
      or jsonb_typeof(p_payload->'avatar') <> 'string' or coalesce(p_payload->>'language','') not in ('en','uk','ru')
      or (p_payload->'age' <> 'null'::jsonb and (jsonb_typeof(p_payload->'age') <> 'number' or (p_payload->>'age')::numeric not between 1 and 120))
      then raise exception 'Invalid profile' using errcode='22023'; end if;
  else
    if not (p_payload ?& array['id','timestamp','date','time','symptoms','intensity','triggers','notes','statusUpdates'])
      or (p_payload->>'id') is distinct from p_id::text
      or jsonb_typeof(p_payload->'timestamp') is distinct from 'string'
      or jsonb_typeof(p_payload->'notes') <> 'string'
      or jsonb_typeof(p_payload->'symptoms') <> 'array' or jsonb_typeof(p_payload->'triggers') <> 'array'
      or jsonb_typeof(p_payload->'statusUpdates') <> 'array'
      or jsonb_typeof(p_payload->'intensity') <> 'number' or (p_payload->>'intensity')::numeric not between 1 and 10
      then raise exception 'Invalid journal entry' using errcode='22023'; end if;
    if not isfinite((p_payload->>'timestamp')::timestamptz)
      or coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(p_payload->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
      or exists(select 1 from jsonb_array_elements(p_payload->'symptoms') v where jsonb_typeof(v) <> 'string')
      or exists(select 1 from jsonb_array_elements(p_payload->'triggers') v where jsonb_typeof(v) <> 'string')
      or exists(select 1 from jsonb_array_elements(p_payload->'statusUpdates') v where jsonb_typeof(v) <> 'object'
        or coalesce(v->>'status','') not in ('resolved','improved','same','worse')
        or jsonb_typeof(v->'notes') is distinct from 'string'
        or coalesce(v->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
        or coalesce(v->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$')
      then raise exception 'Invalid journal metadata' using errcode='22023'; end if;
    perform (p_payload->>'date')::date;
  end if;
  -- Serializes both inserts and updates for this owner/document; no client clock decides winners.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || p_id::text,0));
  select * into current_row from public.sync_records where user_id=owner_id and id=p_id for update;
  if found then
    if current_row.operation_id = p_operation or current_row.version <> p_base then return to_jsonb(current_row); end if;
    update public.sync_records set payload=p_payload,deleted=p_deleted,version=version+1,
      operation_id=p_operation,updated_at=clock_timestamp()
      where user_id=owner_id and id=p_id returning * into current_row;
  else
    if p_base <> 0 then raise exception 'Missing sync document; retain local data' using errcode='40001'; end if;
    insert into public.sync_records(user_id,id,kind,payload,deleted,operation_id)
      values(owner_id,p_id,p_kind,p_payload,p_deleted,p_operation) returning * into current_row;
  end if;
  return to_jsonb(current_row);
end;
$$;
revoke all on function public.sync_write(uuid,text,jsonb,boolean,bigint,uuid,uuid) from public,anon;
grant execute on function public.sync_write(uuid,text,jsonb,boolean,bigint,uuid,uuid) to authenticated;

-- Old clients must not write into a divergent journal after cutover. Reads remain protected by existing RLS.
revoke insert,update,delete on public.journal_entries,public.entry_status_updates,public.profiles from public,anon,authenticated;
comment on table public.sync_records is 'CAS-versioned account documents. Tombstones must be retained until a separate retention protocol exists.';
commit;
