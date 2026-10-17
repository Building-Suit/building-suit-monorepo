-- Failure-only metadata in an already-owned disposable database. The temporary
-- helper reads provider subscription claims privately and emits counts only.
create function pg_temp.doctor_realtime_visible_claims() returns integer
language plpgsql security invoker set search_path='' as $$
declare item record; target record; allowed integer:=0;
begin
  select practice_id,location_id into target from public.appointment_queue_revisions order by location_id limit 1;
  if target.location_id is null then return 0; end if;
  for item in select claims from realtime.subscription where entity='public.appointment_queue_revisions'::regclass loop
    perform set_config('request.jwt.claims',item.claims::text,true);
    if doctor_private.can_read_appointment_queue(target.practice_id,target.location_id) then allowed:=allowed+1; end if;
  end loop;
  return allowed;
end $$;
select jsonb_build_object(
 'published',exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename='appointment_queue_revisions'),
 'publishes_insert',coalesce((select pubinsert from pg_publication where pubname='supabase_realtime'),false),
 'publishes_update',coalesce((select pubupdate from pg_publication where pubname='supabase_realtime'),false),
 'primary_key',exists(select 1 from pg_constraint where conrelid='public.appointment_queue_revisions'::regclass and contype='p'),
 'replication_select',coalesce(has_table_privilege(to_regrole('supabase_realtime_admin')::oid,'public.appointment_queue_revisions','SELECT'),false),
 'authenticated_select',has_table_privilege('authenticated','public.appointment_queue_revisions','SELECT'),
 'service_select',has_table_privilege('service_role','public.appointment_queue_revisions','SELECT'),
 'service_insert',has_table_privilege('service_role','public.appointment_queue_revisions','INSERT'),
 'service_update',has_table_privilege('service_role','public.appointment_queue_revisions','UPDATE'),
 'wal_slot_active',exists(select 1 from pg_replication_slots where plugin='wal2json'and active),
 'revision_rows',(select count(*)from public.appointment_queue_revisions),
 'subscriptions',(select count(*)from realtime.subscription where entity='public.appointment_queue_revisions'::regclass),
 'sid_claims',(select count(*)from realtime.subscription where entity='public.appointment_queue_revisions'::regclass and jsonb_typeof(claims->'session_id')='string'),
 'authenticated_claims',(select count(*)from realtime.subscription where entity='public.appointment_queue_revisions'::regclass and claims->>'role'='authenticated'),
 'visible_claims',pg_temp.doctor_realtime_visible_claims(),
 'wal_slots',(select count(*)from pg_replication_slots where plugin='wal2json')
);
