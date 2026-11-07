-- Forward-only: settle actual failed zero-turn executions and require independently
-- reviewed proof for EVERY assigned skill. No assignment truncation or activation.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
create or replace function hq_private.record_trial_host_execution(p_trial_id uuid,p_worker_job_id uuid,p_artifact_id uuid,p_evidence jsonb,p_evidence_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_trial hq_private.workforce_trials; v_job public.hq_agent_jobs; v_artifact public.hq_task_artifacts;
  v_agent hq_private.agent_roster; v_worker hq_private.agent_workers; v_digest text; v_old hq_private.workforce_trial_host_execution_receipts;
  v_level text; v_outcome text; v_argv jsonb;
begin
  select * into v_trial from hq_private.workforce_trials where id=p_trial_id;
  select * into v_job from public.hq_agent_jobs where id=p_worker_job_id;
  if p_artifact_id is not null then select * into v_artifact from public.hq_task_artifacts where id=p_artifact_id; end if;
  select * into v_agent from hq_private.agent_roster where id=v_trial.agent_id and enabled;
  select * into v_worker from hq_private.agent_workers where worker_id=v_job.worker_id;
  v_level:=p_evidence->>'attestationLevel'; v_outcome:=p_evidence->>'outcome';
  v_argv:=case when v_level='host-cli-preflight' then p_evidence->'invocation'->'plannedArgv' else p_evidence->'invocation'->'argv' end;
  if jsonb_typeof(p_evidence) is distinct from 'object' or octet_length(p_evidence::text)>65536
    or v_trial.id is null or v_job.id is null or v_agent.id is null or v_worker.worker_id is null
    or v_trial.agent_id is distinct from v_agent.id or v_trial.task_id is distinct from v_job.task_id
    or v_trial.binding_digest is distinct from hq_private.workforce_trial_binding_digest(v_agent.id)
    or v_job.agent_id is distinct from v_agent.id or v_job.kind<>'task-work'
    or v_job.worker_id is distinct from nullif(p_evidence->>'workerId','')::uuid
    or p_evidence->>'schemaVersion' is distinct from '1'
    or v_level not in ('host-launch-settings','host-returned-resolution','host-cli-preflight')
    or p_evidence->>'providerServedModel' is distinct from 'unknown'
    or p_evidence->>'agentId' is distinct from v_agent.id
    or p_evidence->>'workerJobId' is distinct from v_job.id::text
    or p_evidence->>'trialId' is distinct from v_trial.id::text
    or p_evidence->>'taskId' is distinct from v_trial.task_id::text
    or p_evidence->>'configuredModel' is distinct from v_agent.model
    or p_evidence->>'configuredEffort' is distinct from v_agent.effort
    or jsonb_typeof(p_evidence->'observedErrors') is distinct from 'array'
    or jsonb_typeof(p_evidence->'observedReroutes') is distinct from 'array'
    or p_evidence->>'workerSourceDigest' !~ '^[0-9a-f]{64}$'
    or p_evidence->>'nodeVersion' !~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$'
    or p_evidence->>'cliVersionSource' is distinct from 'same-binary-version-probe'
    or p_evidence->>'observedEventCoverage' not in ('codex-app-server-jsonrpc-events-only','codex-app-server-preflight-only')
    or jsonb_typeof(p_evidence->'invocation') is distinct from 'object'
    or jsonb_typeof(p_evidence->'invocation'->'environment') is distinct from 'object'
    or jsonb_typeof(v_argv) is distinct from 'array'
    or jsonb_array_length(case when jsonb_typeof(v_argv)='array' then v_argv else '[]'::jsonb end)>120
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_argv)='array' then v_argv else '[]'::jsonb end) a(value)
      where jsonb_typeof(a.value)<>'string' or octet_length(a.value#>>'{}')>4096)
    or (select count(*) from jsonb_each(case when jsonb_typeof(p_evidence->'invocation'->'environment')='object' then p_evidence->'invocation'->'environment' else '{}'::jsonb end))>8
    or exists(select 1 from jsonb_each(case when jsonb_typeof(p_evidence->'invocation'->'environment')='object' then p_evidence->'invocation'->'environment' else '{}'::jsonb end) e(key,value)
      where e.key not in ('HOME','PATH','LANG','TERM','CODEX_HOME') or jsonb_typeof(e.value)<>'string' or octet_length(e.value#>>'{}')>2048)
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_evidence->'observedErrors')='array' then p_evidence->'observedErrors' else '[]'::jsonb end) e(value)
      where jsonb_typeof(e.value)<>'string' or e.value#>>'{}' !~ '^[a-z-]{1,80}$')
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_evidence->'observedReroutes')='array' then p_evidence->'observedReroutes' else '[]'::jsonb end) e(value)
      where jsonb_typeof(e.value)<>'object' or e.value->>'from' !~ '^gpt-[A-Za-z0-9.-]{1,70}$' or e.value->>'to' !~ '^gpt-[A-Za-z0-9.-]{1,70}$')
    or (select count(*) from jsonb_each(p_evidence->'invocation'))<>5
    or exists(select 1 from jsonb_each(p_evidence->'invocation') e(key,value)
      where e.key not in ('executable','argv','plannedArgv','environment','protocol','plannedProtocol','stdinSha256'))
    or p_evidence->'invocation'->>'stdinSha256' !~ '^[0-9a-f]{64}$'
    or p_evidence->'invocation'->>'executable' is distinct from p_evidence->>'cliExecutable'
    or not (v_argv @> jsonb_build_array('app-server')) or not (v_argv @> jsonb_build_array('--stdio'))
    or not (v_argv @> jsonb_build_array('--strict-config'))
    or not (v_argv @> jsonb_build_array('--disable','shell_tool'))
    or not (v_argv @> jsonb_build_array('-c','mcp_servers={}'))
    or not (v_argv @> jsonb_build_array('-c','web_search="disabled"'))
    or not (v_argv @> jsonb_build_array('-c','model_reasoning_effort="'||v_agent.effort||'"'))
    or p_evidence->>'laterModelOverrideCount' !~ '^[0-9]{1,2}$'
    or (p_evidence->>'laterModelOverrideCount')::integer>32
    or p_evidence_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,255}$' then
    raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
  end if;
  if v_level in ('host-launch-settings','host-returned-resolution') then
    if p_evidence->>'invocationStatus' is distinct from 'launched'
      or p_evidence->>'settingObservationSource' is distinct from 'explicit-codex-app-server-thread-start-and-locked-config'
      or p_evidence->>'launchModel' is distinct from v_agent.model
      or p_evidence->>'launchEffort' is distinct from v_agent.effort
      or p_evidence->>'cliBinaryDigest' !~ '^[0-9a-f]{64}$'
      or p_evidence->>'cliVersion' !~ '^codex-cli [A-Za-z0-9.+-]{1,80}$' then
      raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
    end if;
    if jsonb_typeof(p_evidence->'invocation'->'protocol') is distinct from 'object'
      or (select count(*) from jsonb_each(p_evidence->'invocation'->'protocol'))<>3
      or p_evidence->'invocation'->'protocol'->'initialize'->>'method' is distinct from 'initialize'
      or p_evidence->'invocation'->'protocol'->'threadStart'->>'method' is distinct from 'thread/start'
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->>'model' is distinct from v_agent.model
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->>'modelProvider' is distinct from 'openai'
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->>'approvalPolicy' is distinct from 'never'
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->>'sandbox' is distinct from 'read-only'
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->>'ephemeral' is distinct from 'true'
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->'config'->>'model_reasoning_effort' is distinct from v_agent.effort
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->'config'->>'web_search' is distinct from 'disabled'
      or p_evidence->'invocation'->'protocol'->'threadStart'->'params'->'config'->'mcp_servers' is distinct from '{}'::jsonb
      or not (
        coalesce((v_outcome='failed' and p_artifact_id is null and p_evidence->'artifactDigest'='null'::jsonb
          and p_evidence->>'turnsStarted'='0' and p_evidence->>'turnsCompleted'='0'
          and p_evidence->'invocation'->'protocol'->'turnStart'='null'::jsonb
          and jsonb_array_length(p_evidence->'observedErrors')>0),false)
        or not (
          p_evidence->'invocation'->'protocol'->'turnStart'->>'method' is distinct from 'turn/start'
      or p_evidence->'invocation'->'protocol'->'turnStart'->'params'->>'threadId' is distinct from p_evidence->>'threadId'
      or p_evidence->'invocation'->'protocol'->'turnStart'->'params'->>'inputSha256' is distinct from p_evidence->'invocation'->>'stdinSha256'
      or (select count(*) from jsonb_each(p_evidence->'invocation'->'protocol'->'turnStart'->'params'))<>2
        )
      )
      or p_evidence->>'observedEventCoverage' is distinct from 'codex-app-server-jsonrpc-events-only' then
      raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
    end if;
    if (v_level='host-launch-settings' and p_evidence->'hostResolution' is distinct from 'null'::jsonb)
      or (v_level='host-returned-resolution' and (
        jsonb_typeof(p_evidence->'hostResolution') is distinct from 'object'
        or p_evidence->'hostResolution'->>'source' is distinct from 'codex-app-server-thread-start'
        or p_evidence->'hostResolution'->>'model' is distinct from v_agent.model
        or p_evidence->'hostResolution'->>'modelProvider' is null
        or p_evidence->'hostResolution'->>'reasoningEffort' is distinct from v_agent.effort
        or p_evidence->'hostResolution'->>'threadId' is distinct from p_evidence->>'threadId'
        or p_evidence->'hostResolution'->>'laterModelOverrideCount' is distinct from '0'
        or (select count(*) from jsonb_each(p_evidence->'hostResolution'))<>6
        or exists(select 1 from jsonb_each(p_evidence->'hostResolution') e(key,value)
          where e.key not in ('source','model','modelProvider','reasoningEffort','threadId','laterModelOverrideCount')))) then
      raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
    end if;
    if v_outcome='completed' then
      if p_artifact_id is null or v_artifact.id is null or v_job.status<>'completed'
        or v_artifact.job_id is distinct from v_job.id or v_artifact.task_id is distinct from v_trial.task_id
        or v_artifact.agent_id is distinct from v_agent.id or v_artifact.digest is distinct from p_evidence->>'artifactDigest'
        or p_evidence->>'artifactDigest' is distinct from v_artifact.digest
        or p_evidence->>'threadId' !~ '^[0-9a-fA-F-]{36}$'
        or p_evidence->>'turnsStarted' is distinct from '1' or p_evidence->>'turnsCompleted' is distinct from '1'
        or jsonb_array_length(p_evidence->'observedErrors')<>0 or jsonb_array_length(p_evidence->'observedReroutes')<>0 then
        raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
      end if;
    elsif v_outcome='failed' then
      if p_artifact_id is not null or p_evidence->'artifactDigest'<>'null'::jsonb or v_job.status<>'blocked'
        or (jsonb_array_length(p_evidence->'observedErrors')=0 and jsonb_array_length(p_evidence->'observedReroutes')=0) then
        raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
      end if;
    else raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023'; end if;
  elsif v_level='host-cli-preflight' then
    if v_outcome<>'failed' or p_evidence->>'invocationStatus' is distinct from 'not-launched'
      or p_evidence->>'settingObservationSource' is distinct from 'not-resolved-cli-preflight-failed'
      or p_evidence->>'observedEventCoverage' is distinct from 'codex-app-server-preflight-only'
      or p_evidence->>'launchModel' is not null or p_evidence->>'launchEffort' is not null
      or p_artifact_id is not null or v_job.status<>'blocked'
      or p_evidence->'artifactDigest' is distinct from 'null'::jsonb
      or jsonb_array_length(p_evidence->'observedErrors')=0 then
      raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
    end if;
  end if;
  v_digest:=encode(extensions.digest(p_evidence::text,'sha256'),'hex');
  select * into v_old from hq_private.workforce_trial_host_execution_receipts where worker_job_id=v_job.id;
  if found then
    if v_old.evidence_digest<>v_digest or v_old.evidence_reference<>p_evidence_reference then
      raise exception 'HQ_TRIAL_HOST_EXECUTION_CONFLICT' using errcode='PT409';
    end if;
    return v_old.id;
  end if;
  insert into hq_private.workforce_trial_host_execution_receipts(
    trial_id,agent_id,worker_id,worker_job_id,artifact_id,artifact_digest,attestation_level,worker_source_digest,node_version,
    cli_version,cli_version_source,cli_executable,cli_binary_digest,configured_model,launch_model,
    configured_effort,launch_effort,host_returned_model,host_returned_provider,host_returned_effort,host_returned_thread_id,
    host_resolution_source,later_model_override_count,setting_observation_source,invocation_status,thread_id,turns_started,turns_completed,
    provider_served_model,invocation,observed_errors,observed_reroutes,observed_event_coverage,outcome,
    evidence_digest,evidence_reference,recorded_by)
  values(p_trial_id,v_agent.id,v_worker.worker_id,v_job.id,v_artifact.id,v_artifact.digest,p_evidence->>'attestationLevel',
    p_evidence->>'workerSourceDigest',p_evidence->>'nodeVersion',p_evidence->>'cliVersion',p_evidence->>'cliVersionSource',p_evidence->>'cliExecutable',
    p_evidence->>'cliBinaryDigest',p_evidence->>'configuredModel',p_evidence->>'launchModel',
    p_evidence->>'configuredEffort',p_evidence->>'launchEffort',
    case when v_level='host-returned-resolution' then p_evidence->'hostResolution'->>'model' end,
    case when v_level='host-returned-resolution' then p_evidence->'hostResolution'->>'modelProvider' end,
    case when v_level='host-returned-resolution' then p_evidence->'hostResolution'->>'reasoningEffort' end,
    case when v_level='host-returned-resolution' then p_evidence->'hostResolution'->>'threadId' end,
    case when v_level='host-returned-resolution' then p_evidence->'hostResolution'->>'source' end,
    (p_evidence->>'laterModelOverrideCount')::integer,
    p_evidence->>'settingObservationSource',p_evidence->>'invocationStatus',p_evidence->>'threadId',
    (p_evidence->>'turnsStarted')::integer,(p_evidence->>'turnsCompleted')::integer,p_evidence->>'providerServedModel',
    p_evidence->'invocation',p_evidence->'observedErrors',p_evidence->'observedReroutes',p_evidence->>'observedEventCoverage',
    p_evidence->>'outcome',v_digest,p_evidence_reference,session_user) returning id into v_id;
  return v_id;
end $$;

create or replace function hq_private.begin_supervised_worker_trial(p_agent_id text,p_skill_file_id text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_agent hq_private.agent_roster; v_manager hq_private.agent_roster;
  v_profile_version text; v_skill_version text; v_snapshot jsonb; v_task public.hq_business_tasks; v_trial hq_private.workforce_trials;
begin
  if v_uid is null or p_request_key is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  select * into v_agent from hq_private.agent_roster where id=p_agent_id and enabled;
  select * into v_manager from hq_private.agent_roster where id=v_agent.manager_id and enabled;
  select source_version into v_profile_version from hq_private.brain_files where file_id=v_agent.profile_file_id and in_scope and not trashed;
  select source_version into v_skill_version from hq_private.brain_files where file_id=p_skill_file_id and in_scope and not trashed and root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
  if v_agent.id is null or v_agent.model_tier<>'T1_WORKER' or v_agent.lifecycle !~* '(configured|trial|pending)'
    or v_manager.model_tier<>'T2_HEAD' or v_manager.department_key<>v_agent.department_key
    or jsonb_array_length(v_agent.skill_file_ids) not between 1 and 10
    or p_skill_file_id not in (select jsonb_array_elements_text(v_agent.skill_file_ids))
    or v_profile_version is null or v_skill_version is null or hq_private.workforce_agent_qualified(v_agent.id)
    then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
  update hq_private.workforce_trials set status='failed',completed_at=clock_timestamp()
    where agent_id=v_agent.id and status='active' and expires_at<=clock_timestamp();
  if exists(select 1 from hq_private.workforce_trials where agent_id=v_agent.id and status='active' and expires_at>clock_timestamp())
    then raise exception 'HQ_TRIAL_ALREADY_ACTIVE' using errcode='PT409'; end if;
  v_snapshot:=hq_private.create_business_task(
    'Supervised internal skill trial — '||v_agent.name,
    'Synthetic internal exercise for the assigned skill only. Prepare a small bounded draft or analysis using the provided role profile, assigned skill and this synthetic task. Use fictional details only. Do not use real customer or personal data; do not contact anyone, send messages, access external systems, browse, publish, deploy, change accounts or claim any external action. This trial is for evaluation and is not company work.',
    'Produce one useful internal-only artifact for the synthetic exercise. Follow the assigned skill, keep claims limited to supplied context, mark assumptions, and include a short self-check against the task. No customer communication, external action, publication or deployment.',
    v_manager.id,p_request_key);
  select * into v_task from public.hq_business_tasks where founder_user_id=v_uid and request_key=p_request_key;
  insert into hq_private.workforce_trials(task_id,request_key,agent_id,manager_id,skill_file_id,binding_digest,
    profile_source_version,skill_source_version,requested_by)
    values(v_task.id,p_request_key,v_agent.id,v_manager.id,p_skill_file_id,
      hq_private.workforce_trial_binding_digest(v_agent.id),v_profile_version,v_skill_version,v_uid)
    on conflict(request_key) do nothing;
  select * into v_trial from hq_private.workforce_trials where request_key=p_request_key;
  if v_trial.agent_id<>v_agent.id or v_trial.skill_file_id<>p_skill_file_id then raise exception 'HQ_TRIAL_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
  return jsonb_build_object('accepted',true,'trialId',v_trial.id,'taskId',v_trial.task_id,'status',v_trial.status,'headId',v_manager.id);
end $$;

-- Evidence readiness is separate from permission to execute; lifecycle stays
-- enforced by workforce_agent_qualified below. Never grant this helper to API roles.
create function hq_private.workforce_skill_evidence_valid(p_agent_id text,p_skill_file_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from hq_private.agent_roster r
    join hq_private.agent_roster m on m.id=r.manager_id
    join hq_private.workforce_qualification_receipts q on q.agent_id=r.id
    join hq_private.workforce_trials t on t.id=q.trial_id and t.status='passed'
    join public.hq_task_artifacts a on a.id=q.evidence_artifact_id and a.id=t.artifact_id and a.task_id=t.task_id
    join hq_private.workforce_trial_host_execution_receipts x on x.id=q.host_execution_id
      and x.trial_id=t.id and x.agent_id=r.id and x.artifact_id=a.id and x.artifact_digest=a.digest
      and x.worker_job_id=a.job_id and x.outcome='completed' and x.provider_served_model='unknown'
      and x.attestation_level='host-returned-resolution'
      and x.configured_model=r.model and x.launch_model=r.model
      and x.configured_effort=r.effort and x.launch_effort=r.effort
      and x.host_returned_model=r.model and x.host_returned_effort=r.effort and x.host_returned_thread_id=x.thread_id
    join public.hq_agent_jobs review on review.id=q.review_job_id and review.id=t.review_job_id
    join hq_private.brain_files e on e.file_id=r.profile_file_id and e.in_scope and not e.trashed
    where r.id=p_agent_id and t.skill_file_id=p_skill_file_id and r.enabled and r.model_tier='T1_WORKER' and m.model_tier='T2_HEAD'
      and r.department_key=m.department_key 
      and q.scope='bounded-drafting-v1' and q.reviewer_id='AG-HR-003' and review.agent_id='AG-HR-003'
      and review.kind='ceo-review' and review.status='completed' and review.result_text::jsonb->>'accepted'='true'
      and q.binding_digest=hq_private.workforce_agent_binding_digest(r.id)
      and q.profile_file_id=r.profile_file_id and q.skill_file_ids=r.skill_file_ids
      and q.model_tier=r.model_tier and q.manager_id=r.manager_id and q.department_key=r.department_key)
$$;
revoke all on function hq_private.workforce_skill_evidence_valid(text,text) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_agent_qualified(p_agent_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from hq_private.agent_roster r where r.id=p_agent_id
    and jsonb_array_length(r.skill_file_ids) between 1 and 10
    and r.lifecycle !~* '(configured|candidate|trial|pending|suspended|inactive|retired|terminated|archived|paused|testing-only)'
    and not exists(select 1 from jsonb_array_elements_text(r.skill_file_ids) skill(value)
      where not hq_private.workforce_skill_evidence_valid(r.id,skill.value)))
$$;

-- Claim responses expose context.mode, not a top-level job.kind. Restrict the
-- actual worker input to the selected trial skill without changing the roster.
create or replace function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job jsonb; v_context jsonb; v_agent hq_private.agent_roster; v_manager hq_private.agent_roster;
  v_assignee hq_private.agent_roster; v_roster jsonb; v_trial jsonb; v_model_evidence jsonb;
begin
  v_job:=v->'job'; if v_job is null or jsonb_typeof(v_job)<>'object' then return v; end if;
  select * into v_agent from hq_private.agent_roster where id=v_job->>'agent_id';
  select * into v_manager from hq_private.agent_roster where id=v_agent.manager_id;
  v_context:=v_job->'context';
  if v_context->'task'->>'id' is not null then
    v_trial:=hq_private.workforce_trial_context((v_context->'task'->>'id')::uuid,v_job->>'agent_id');
    if v_trial is null then
      select jsonb_build_object('id',t.id,'taskId',t.task_id,'agentId',t.agent_id,'managerId',t.manager_id,
        'skillFileId',t.skill_file_id,'bindingDigest',t.binding_digest,'scope','synthetic-internal-trial-v1',
        'status',t.status,'expiresAt',t.expires_at,'externalActionsAllowed',false,'publishingAllowed',false)
        into v_trial from hq_private.workforce_trials t where t.task_id=(v_context->'task'->>'id')::uuid;
    end if;
    if v_trial is not null then
      v_context:=jsonb_set(v_context,'{supervisedTrial}',v_trial,true);
      if v_trial->>'agentId'=v_job->>'agent_id' and v_context->>'mode' in ('task-start','task-work','task-report') then
        v_context:=jsonb_set(v_context,'{agent,skillFileIds}',jsonb_build_array(v_trial->>'skillFileId'),true);
        select coalesce(jsonb_agg(f order by f->>'id'),'[]'::jsonb) into v_roster
          from jsonb_array_elements(coalesce(v_context->'brain_files','[]'::jsonb)) f
          where f->>'id'=any(array['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz',
            '1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N',
            (select profile_file_id from hq_private.agent_roster where id=v_trial->>'agentId'),v_trial->>'skillFileId']);
        v_context:=jsonb_set(v_context,'{brain_files}',v_roster,true);
      end if;
      if v_context->>'mode'='task-start' then v_context:=jsonb_set(v_context,'{mode}','"trial-start"'::jsonb); end if;
      if v_context->>'mode'='task-work' then v_context:=jsonb_set(v_context,'{mode}','"worker-trial"'::jsonb); end if;
      if v_context->>'mode'='ceo-review' and v_job->>'agent_id'='AG-HR-003' then
        v_context:=jsonb_set(v_context,'{trialReview}','true'::jsonb,true);
      end if;
      if v_context->>'mode'='task-report' then v_context:=jsonb_set(v_context,'{trialReport}','true'::jsonb,true); end if;
    end if;
  end if;
  if v_context->'artifact'->>'id' ~ '^[0-9a-fA-F-]{36}$' then
    select e.evidence into v_model_evidence
      from hq_private.workforce_model_execution_receipts e
      join public.hq_task_artifacts a on a.job_id=e.job_id
      where a.id=(v_context->'artifact'->>'id')::uuid;
    if v_model_evidence is not null then
      v_context:=jsonb_set(v_context,'{artifact,modelExecutionEvidence}',v_model_evidence,true);
    end if;
  end if;
  v_context:=jsonb_set(v_context,'{agent}',coalesce(v_context->'agent','{}'::jsonb)||jsonb_build_object(
    'modelTier',v_agent.model_tier,'managerId',v_agent.manager_id,'managerModelTier',v_manager.model_tier,'departmentKey',v_agent.department_key,
    'qualification',hq_private.workforce_qualification_context(v_agent.id),
    'headAuthorization',hq_private.workforce_head_authorized((v_job->>'id')::uuid)));
  if v_context->'assignee'->>'id' is not null then
    select * into v_assignee from hq_private.agent_roster where id=v_context->'assignee'->>'id';
    v_context:=jsonb_set(v_context,'{assignee}',v_context->'assignee'||jsonb_build_object(
      'managerId',v_assignee.manager_id,'modelTier',v_assignee.model_tier),true);
  end if;
  if v_context->>'mode'='task-ack' then
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'role',r.role,'departmentKey',r.department_key,
      'lifecycle',r.lifecycle,'managerId',r.manager_id,'modelTier',r.model_tier,'profileFileId',r.profile_file_id,
      'skillFileIds',r.skill_file_ids,'qualification',hq_private.workforce_qualification_context(r.id),
      'supervisedTrial',case when v_trial->>'agentId'=r.id and v_trial->>'status'='active' then v_trial else null end) order by r.id),'[]'::jsonb)
      into v_roster from hq_private.agent_roster r
      where r.manager_id=v_agent.id and r.model_tier='T1_WORKER'
        and (hq_private.workforce_agent_qualified(r.id) or v_trial->>'agentId'=r.id and v_trial->>'status'='active');
    v_context:=jsonb_set(v_context,'{roster}',v_roster,true);
  end if;
  v_job:=jsonb_set(v_job,'{context}',v_context,true);
  return jsonb_set(v,'{job}',v_job,true);
end $$;

create or replace function hq_private.workforce_trial_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('agentId',a.id,'skillFileId',next_skill.id,
    'eligible',a.model_tier='T1_WORKER' and a.lifecycle ~* '(configured|trial|pending)' and next_skill.id is not null
      and not coalesce(t.status='active' and t.expires_at>clock_timestamp(),false),
    'qualified',hq_private.workforce_agent_qualified(a.id),'trialId',t.id,'status',t.status,
    'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),
    'reviewComplete',coalesce(t.status='passed' and exists(select 1 from public.hq_agent_jobs j
      where j.task_id=t.task_id and j.kind='task-report' and j.status='completed'),false)) order by a.id)
    from hq_private.agent_roster a left join lateral
      (select id,status,task_id,expires_at from hq_private.workforce_trials where agent_id=a.id
        and requested_by=hq_private.founder_uid() order by created_at desc,id desc limit 1) t on true
    left join lateral (select skill.value id from jsonb_array_elements_text(a.skill_file_ids) skill(value)
      where not hq_private.workforce_skill_evidence_valid(a.id,skill.value) order by skill.value limit 1) next_skill on true
    where a.enabled and a.model_tier='T1_WORKER'),'[]'::jsonb);
end $$;
-- Explicit semantic capabilities keep new candidates paused until this forward
-- prerequisite is installed; old contract-2 workers keep the additive response.
create or replace function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  return hq_private.worker_release_status_contract2(p_worker_id)||jsonb_build_object(
    'trialDelivery',1,'trialSkills',1,'trialFailureSettlement',1);
end $$;
commit;
