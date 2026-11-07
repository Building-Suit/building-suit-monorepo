-- Read-only catalog proof for publishable-key workers; no admission/state change.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
set local transaction_timeout='8s';
create or replace function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_status jsonb; v_required record; v_proc pg_catalog.pg_proc%rowtype;
  v_oid oid; v_rpcs jsonb:='{}'::jsonb;
begin
  -- Preserve the existing enabled-worker, non-founder, live-session check and
  -- additive semantic prerequisites before returning any catalog information.
  v_status:=hq_private.worker_release_status_contract2(p_worker_id);
  if not pg_catalog.has_schema_privilege('authenticated','public','USAGE')
    or not pg_catalog.has_schema_privilege('authenticated','hq_private','USAGE')
    or pg_catalog.to_regprocedure('hq_private.workforce_skill_evidence_valid(text,text)') is null
  then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
  for v_required in select * from (values
    ('hq_worker_release_status','public.hq_worker_release_status(uuid)',array['p_worker_id']::text[]),
    ('hq_worker_claim','public.hq_worker_claim(uuid,integer,integer)',array['p_worker_id','p_lease_seconds','p_meeting_protocol']::text[]),
    ('hq_worker_finish_v4','public.hq_worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)',array['p_job_id','p_lease_token','p_worker_id','p_reply','p_error','p_evidence','p_model_evidence','p_trial_evidence']::text[]),
    ('hq_worker_finish_v3','public.hq_worker_finish_v3(uuid,uuid,uuid,text,text,jsonb,jsonb)',array['p_job_id','p_lease_token','p_worker_id','p_reply','p_error','p_evidence','p_model_evidence']::text[]),
    ('hq_worker_heartbeat','public.hq_worker_heartbeat(uuid,uuid,uuid,text)',array['p_job_id','p_lease_token','p_worker_id','p_status']::text[]),
    ('hq_worker_presence','public.hq_worker_presence(uuid)',array['p_worker_id']::text[]),
    ('hq_worker_skill_context','public.hq_worker_skill_context(uuid,uuid,uuid,jsonb)',array['p_job_id','p_lease_token','p_worker_id','p_skill_ids']::text[]),
    ('hq_worker_roster_sources','public.hq_worker_roster_sources(uuid)',array['p_worker_id']::text[]),
    ('hq_worker_sync_roster','public.hq_worker_sync_roster(uuid,jsonb)',array['p_worker_id','p_agents']::text[]),
    ('hq_worker_pending_lessons','public.hq_worker_pending_lessons(uuid)',array['p_worker_id']::text[]),
    ('hq_worker_publish_lesson','public.hq_worker_publish_lesson(uuid,uuid,text,text)',array['p_worker_id','p_lesson_id','p_reference','p_digest']::text[])
  ) required(name,signature,arguments) loop
    v_oid:=pg_catalog.to_regprocedure(v_required.signature);
    if v_oid is null then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
    select * into v_proc from pg_catalog.pg_proc where oid=v_oid;
    if v_proc.prokind<>'f' or v_proc.proretset
      or v_proc.prorettype<>'pg_catalog.jsonb'::pg_catalog.regtype
      or v_proc.proargnames is distinct from v_required.arguments
      or v_proc.pronargs<>pg_catalog.cardinality(v_required.arguments)
      or v_proc.proargmodes is not null
      or not pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
    then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
    v_rpcs:=v_rpcs||pg_catalog.jsonb_build_object(v_required.name,v_required.arguments);
  end loop;
  return v_status||pg_catalog.jsonb_build_object('trialDelivery',1,'trialSkills',1,'trialFailureSettlement',1,
    'api',pg_catalog.jsonb_build_object('version',1,'role','authenticated','schemaUsage',true,'execute',true,'rpcs',v_rpcs));
end $$;
-- No new endpoint, grant, auth authority, writes, pause/resume or migration from
-- the host. Existing public invoker and authenticated-only ACLs are retained.
commit;
