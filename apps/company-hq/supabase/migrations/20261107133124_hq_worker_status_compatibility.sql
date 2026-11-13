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
    -- Fixed SECURITY INVOKER wrappers need their one private entry point too.
    -- This is not arbitrary call-graph discovery and grants no new authority.
    v_oid:=pg_catalog.to_regprocedure(pg_catalog.replace(v_required.signature,'public.hq_','hq_private.'));
    if v_oid is null or not pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE')
    then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
    -- PostgREST findProc matches JSON keys to required/optional input names,
    -- independent of SQL types. A valid intended OID alone is insufficient.
    -- Unnamed JSON fallbacks cannot compete with an existing named match.
    -- Its schema cache includes same-name functions regardless of EXECUTE ACL;
    -- only named candidates accepting this exact worker key set can conflict.
    if exists (
      select 1 from pg_catalog.pg_proc alternative
      cross join lateral (
        select coalesce(pg_catalog.array_agg(a.name order by a.input_idx),'{}'::text[]) names,
          coalesce(pg_catalog.array_agg(a.name order by a.input_idx)
            filter(where a.input_idx<=alternative.pronargs-alternative.pronargdefaults),'{}'::text[]) required_names
        from (
          -- Names/modes describe ALL arguments; proargtypes describes inputs.
          -- Align the full lists first, remove output-only slots, then number
          -- only inputs so OUT slots cannot shift the default boundary.
          select raw.name,pg_catalog.row_number() over(order by raw.idx) input_idx
          from rows from (pg_catalog.unnest(alternative.proargnames),
            pg_catalog.unnest(coalesce(alternative.proallargtypes,alternative.proargtypes::oid[])),
            pg_catalog.unnest(alternative.proargmodes)) with ordinality raw(name,type,mode,idx)
          where raw.type is not null and coalesce(raw.mode,'i') in ('i','b','v')
        ) a
      ) inputs
      where alternative.pronamespace='public'::pg_catalog.regnamespace
        and alternative.proname=v_required.name and alternative.oid<>v_proc.oid
        and alternative.prokind='f' and alternative.prorettype<>'pg_catalog.trigger'::pg_catalog.regtype
        and v_required.arguments <@ inputs.names
        and inputs.required_names <@ v_required.arguments
    ) then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
    v_rpcs:=v_rpcs||pg_catalog.jsonb_build_object(v_required.name,v_required.arguments);
  end loop;
  return v_status||pg_catalog.jsonb_build_object('trialDelivery',1,'trialSkills',1,'trialFailureSettlement',1,
    'api',pg_catalog.jsonb_build_object('version',1,'role','authenticated','schemaUsage',true,'execute',true,'rpcs',v_rpcs));
end $$;
-- No new endpoint, grant, auth authority, writes, pause/resume or migration from
-- the host. Existing public invoker and authenticated-only ACLs are retained.
commit;
