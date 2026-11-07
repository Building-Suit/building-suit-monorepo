-- The Research worker receives the host's single public, read-only native
-- web-search capability only after current bounded-drafting qualification.
-- Department heads, trial workers and other departments remain tool-free.
create function hq_private.worker_native_web_authorized(p_agent_id text,p_job_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_job_kind='task-work' and exists(
    select 1 from hq_private.agent_roster a
      join hq_private.agent_roster m on m.id=a.manager_id
    where a.id=p_agent_id and a.enabled and a.model_tier='T1_WORKER'
      and a.department_key='research-market-intelligence'
      and m.model_tier='T2_HEAD' and m.department_key=a.department_key
      and hq_private.workforce_agent_qualified(a.id))
$$;
revoke all on function hq_private.worker_native_web_authorized(text,text) from public,anon,authenticated,service_role;

-- Preserve the native receipt validator and artifact binding, changing only
-- which caller may supply web-search evidence. Missing legacy fixture functions
-- stay unchanged; normal worker execution still fails closed in those fixtures.
do $$
declare v_fn regprocedure:=to_regprocedure('hq_private.worker_finish_v2(uuid,uuid,uuid,text,text,jsonb)');
  v_definition text; v_old_no text:='j.agent_id not in (''AG-RES-001'',''AG-HR-002'')';
  v_old_yes text:='j.agent_id in (''AG-RES-001'',''AG-HR-002'')';
begin
  if v_fn is null then return; end if;
  v_definition:=pg_get_functiondef(v_fn);
  if position(v_old_no in v_definition)=0 or position(v_old_yes in v_definition)=0 then
    raise exception 'HQ_RESEARCH_TOOL_RECEIPT_VALIDATOR_SHAPE_CHANGED';
  end if;
  v_definition:=replace(v_definition,v_old_no,'not hq_private.worker_native_web_authorized(j.agent_id,j.kind)');
  v_definition:=replace(v_definition,v_old_yes,'hq_private.worker_native_web_authorized(j.agent_id,j.kind)');
  execute v_definition;
end $$;

-- Every worker's own department head reviews its task artifact. Keep the
-- legacy CEO-review branch for non-worker/system assignments, but do not route
-- eligible T1 work through HR's head by hard-coded identity.
do $$
declare v_fn regprocedure:=to_regprocedure('hq_private.worker_finish_before_meetings(uuid,uuid,uuid,text,text)');
  v_definition text; v_target hq_private.agent_roster; v_old text:= $old$
    v_next:=case when v_job.agent_id in ('AG-HR-002','AG-HR-003','AG-CEO-001') then 'head-review' else 'ceo-review' end;
    perform hq_private.workforce_enqueue(v_job,v_next,case when v_next='head-review' then 'AG-HR-001' else 'AG-CEO-001' end,v_artifact,null,v_job.attempt);
$old$;
  v_new text:= $new$
    select * into v_target from hq_private.agent_roster where id=v_job.agent_id;
    if v_target.model_tier='T1_WORKER' then
      if v_target.manager_id is null or not exists(select 1 from hq_private.agent_roster m where m.id=v_target.manager_id and m.model_tier='T2_HEAD' and m.department_key=v_target.department_key) then
        raise exception 'HQ_WORKER_MANAGER_UNAVAILABLE';
      end if;
      perform hq_private.workforce_enqueue(v_job,'head-review',v_target.manager_id,v_artifact,null,v_job.attempt);
    else
      v_next:=case when v_job.agent_id in ('AG-HR-002','AG-HR-003','AG-CEO-001') then 'head-review' else 'ceo-review' end;
      perform hq_private.workforce_enqueue(v_job,v_next,case when v_next='head-review' then 'AG-HR-001' else 'AG-CEO-001' end,v_artifact,null,v_job.attempt);
    end if;
$new$;
begin
  if v_fn is null then return; end if;
  v_definition:=pg_get_functiondef(v_fn);
  if position(v_old in v_definition)=0 then raise exception 'HQ_DEPARTMENT_HEAD_REVIEW_SHAPE_CHANGED'; end if;
  if position('v_target hq_private.agent_roster;' in v_definition)=0 then
    if position('v_summary text;' in v_definition)=0 then raise exception 'HQ_DEPARTMENT_REVIEW_DECLARATION_SHAPE_CHANGED'; end if;
    v_definition:=replace(v_definition,'v_summary text;','v_summary text; v_target hq_private.agent_roster;');
  end if;
  execute replace(v_definition,v_old,v_new);
end $$;

-- Office telemetry reflects the same effective qualified-worker capability;
-- model or department labels alone never make the tool appear bound.
do $$
declare v_fn regprocedure:=to_regprocedure('hq_private.office_observations()');
  v_definition text; v_old text:='a.id in (''AG-RES-001'',''AG-HR-002'')';
begin
  if v_fn is null then return; end if;
  v_definition:=pg_get_functiondef(v_fn);
  if position(v_old in v_definition)=0 then raise exception 'HQ_RESEARCH_TOOL_OBSERVATION_SHAPE_CHANGED'; end if;
  execute replace(v_definition,v_old,'hq_private.worker_native_web_authorized(a.id,''task-work'')');
end $$;
