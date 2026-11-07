-- SOURCE PREPARATION ONLY: keep its PR draft/unmerged until one-time activation
-- approval and fresh managed-worker health/reconciliation evidence are accepted.
-- SQL verifies database state only; it cannot establish host health or shutdown.
-- Deployment, once approved, is only via GitHub stg -> HQ staging integration.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
set local transaction_timeout='8s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
do $resume$
declare
  v_worker constant uuid:='3ead9a59-d84b-4e95-9871-abba0b129404';
  v_original_request constant uuid:='fe6d97b2-d55f-45c6-9306-581e942649c0';
  v_resume_request constant uuid:='9cb935ac-b05a-4d9e-b892-59dd31c88b08';
  v_pause hq_private.worker_admission_pauses;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'HQ_ACTIVATION_ISOLATION'; end if;
  if (select count(*) from hq_private.agent_workers)<>1
    or not exists(select 1 from hq_private.agent_workers where worker_id=v_worker and enabled) then
    raise exception 'HQ_ACTIVATION_WORKER_MISMATCH';
  end if;
  -- The same queue lock fences concurrent claims and pause mutations. Compare
  -- the exact observed hold; an old decision must never remove a newer pause.
  select * into v_pause from hq_private.worker_admission_pauses where worker_id=v_worker for update;
  if not found or v_pause.paused is distinct from true or v_pause.generation<>1
    or v_pause.request_id is distinct from v_original_request then
    raise exception 'HQ_ACTIVATION_PAUSE_MISMATCH';
  end if;
  if pg_catalog.to_regprocedure('public.hq_worker_release_status(uuid)') is null
    or pg_catalog.to_regprocedure('hq_private.worker_release_status(uuid)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_claim(uuid,integer,integer)') is null
    or pg_catalog.to_regprocedure('public.hq_worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)') is null
    or pg_catalog.to_regprocedure('hq_private.worker_release_status_contract2(uuid)') is null
    or pg_catalog.to_regprocedure('public.hq_workforce_trial_status()') is null
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
    or pg_catalog.to_regclass('hq_private.workforce_model_execution_receipts') is null then
    raise exception 'HQ_ACTIVATION_CONTRACT_REQUIRED';
  end if;
  -- Include expired or missing-expiry working leases. Do not manufacture a
  -- successful drain/finish from elapsed time or replace authoritative outcomes.
  if exists(select 1 from public.hq_agent_jobs where worker_id=v_worker and status='working') then
    raise exception 'HQ_ACTIVATION_WORK_UNSETTLED';
  end if;
  perform hq_private.set_worker_admission_pause(v_worker,false,1,v_resume_request,'approved managed-worker activation');
end $resume$;
commit;
