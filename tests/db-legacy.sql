insert into public.journal_entries(id,user_id,intensity,notes,recorded_at) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5,'original note','2026-10-20T13:00:00Z');
insert into public.entry_status_updates(user_id,entry_id,status,notes) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','improved','legacy status preserved');
insert into public.profiles(user_id,display_name,language) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legacy profile','uk');
-- Supabase normally supplies these grants; explicitly simulate them before checking revocation.
grant all on public.profiles,public.journal_entries,public.entry_status_updates to authenticated,anon;
