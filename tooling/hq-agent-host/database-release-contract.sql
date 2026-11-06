-- SOURCE PROPOSAL ONLY. Not an active migration, not part of a worker package.
-- An authorized operator must generate/review a new forward HQ staging migration
-- containing this additive contract before bootstrap. Never run from the updater.
-- Existing 17 applied migration sources remain byte-for-byte unchanged.
-- Contract 2 promises old/new worker rollback compatibility; a breaking semantic
-- database change must revoke/bump this contract, never silently keep returning 2.
begin;

create function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_active bigint;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then
    raise exception 'HQ_WORKER_REQUIRED' using errcode='42501';
  end if;
  if pg_catalog.to_regprocedure('public.hq_worker_claim(uuid,integer,integer)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_finish_v3(uuid,uuid,uuid,text,text,jsonb,jsonb)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_finish_v2(uuid,uuid,uuid,text,text,jsonb)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_heartbeat(uuid,uuid,uuid,text)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_sync_roster(uuid,jsonb)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_pending_lessons(uuid)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_publish_lesson(uuid,uuid,text,text)') is null
    or pg_catalog.to_regprocedure('hq_private.workforce_agent_qualified(text)') is null
    or pg_catalog.to_regprocedure('hq_private.workforce_enrich_claim(jsonb)') is null
    or pg_catalog.to_regprocedure('hq_private.worker_native_web_authorized(text,text)') is null
    or pg_catalog.to_regclass('hq_private.department_staffing_needs') is null
    or pg_catalog.to_regclass('hq_private.workforce_qualifications_legacy') is null
    or pg_catalog.to_regclass('hq_private.workforce_trials') is null
    or pg_catalog.to_regclass('hq_private.workforce_qualification_receipts') is null
    or pg_catalog.to_regclass('hq_private.workforce_trial_host_execution_receipts') is null
    or pg_catalog.to_regclass('hq_private.workforce_model_execution_receipts') is null
  then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
  -- Count expired-but-unreconciled working leases too. A missing claim response
  -- is not evidence that no server-side job was acquired. No job data is exposed.
  select count(*) into v_active from public.hq_agent_jobs
    where worker_id=p_worker_id and status='working';
  return pg_catalog.jsonb_build_object('contract',2,'activeJobs',v_active);
end;
$$;
create function public.hq_worker_release_status(p_worker_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select hq_private.worker_release_status(p_worker_id);
$$;
revoke all on function hq_private.worker_release_status(uuid),public.hq_worker_release_status(uuid)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_release_status(uuid),public.hq_worker_release_status(uuid)
  to authenticated;

commit;
