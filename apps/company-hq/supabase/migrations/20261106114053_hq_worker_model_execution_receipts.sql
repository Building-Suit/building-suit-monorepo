-- Durable, truthful model-attempt history. It records what the host launched
-- and observed from CLI JSONL; it never claims provider-served model identity.
create table hq_private.workforce_model_execution_receipts (
  job_id uuid primary key references public.hq_agent_jobs(id),
  artifact_id uuid references public.hq_task_artifacts(id),
  worker_id uuid not null references hq_private.agent_workers(worker_id),
  agent_id text not null references hq_private.agent_roster(id),
  configured_model text not null check(configured_model ~ '^gpt-[A-Za-z0-9.-]{1,70}$'),
  selected_model text check(selected_model ~ '^gpt-[A-Za-z0-9.-]{1,70}$'),
  provider_served_model text not null check(provider_served_model='unknown'),
  fallback_used boolean not null,
  outcome text not null check(outcome in ('completed','failed')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object' and octet_length(evidence::text)<=16000),
  evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  check((outcome='completed' and artifact_id is not null and selected_model is not null)
    or (outcome='failed' and artifact_id is null and selected_model is null))
);
alter table hq_private.workforce_model_execution_receipts enable row level security;
revoke all on hq_private.workforce_model_execution_receipts from public,anon,authenticated,service_role;
create trigger workforce_model_execution_receipt_immutable before update or delete on hq_private.workforce_model_execution_receipts
  for each row execute function hq_private.immutable_record();

create function hq_private.record_workforce_model_execution(p_job_id uuid,p_worker_id uuid,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; a public.hq_task_artifacts; r hq_private.agent_roster; old hq_private.workforce_model_execution_receipts;
  v_attempts jsonb; v_count integer; v_fallback boolean; v_outcome text; v_digest text; v_model text; v_error text;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id and worker_id=p_worker_id;
  select * into r from hq_private.agent_roster where id=j.agent_id and enabled;
  if j.id is null or j.kind<>'task-work' or r.id is null or r.model_tier<>'T1_WORKER'
    or p_evidence is null or jsonb_typeof(p_evidence) is distinct from 'object'
    or octet_length(p_evidence::text)>16000 or p_evidence->>'schemaVersion' is distinct from '1'
    or p_evidence->>'workerJobId' is distinct from j.id::text or p_evidence->>'workerId' is distinct from p_worker_id::text
    or p_evidence->>'agentId' is distinct from j.agent_id or p_evidence->>'configuredModel' is distinct from r.model
    or p_evidence->>'providerServedModel' is distinct from 'unknown'
    or p_evidence->>'policy' not in ('terra-primary-luna-fallback-v1','canonical-model-only-v1')
    or jsonb_typeof(p_evidence->'attempts') is distinct from 'array'
    or jsonb_array_length(p_evidence->'attempts') not between 1 and 2
    or p_evidence->>'fallbackUsed' is distinct from (jsonb_array_length(p_evidence->'attempts')=2)::text
    or p_evidence->>'outcome' not in ('completed','failed') then
    raise exception 'HQ_MODEL_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
  end if;
  v_attempts:=p_evidence->'attempts'; v_count:=jsonb_array_length(v_attempts); v_fallback:=v_count=2; v_outcome:=p_evidence->>'outcome';
  if (r.model_tier='T1_WORKER' and r.model='gpt-6.1-terra') is distinct from (p_evidence->>'policy'='terra-primary-luna-fallback-v1')
    or (v_fallback and (r.model_tier<>'T1_WORKER' or r.model<>'gpt-6.1-terra'
      or p_evidence->>'policy'<>'terra-primary-luna-fallback-v1')) then
    raise exception 'HQ_MODEL_EXECUTION_POLICY_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(v_attempts) x(value)
    where jsonb_typeof(x.value)<>'object'
      or (select count(*) from jsonb_each(x.value))<>7
      or exists(select 1 from jsonb_each(x.value) e(key,value) where e.key not in ('model','outcome','errorCode','toolEventCount','rerouteCount','turnsStarted','turnsCompleted'))
      or x.value->>'model' is null or x.value->>'model' !~ '^gpt-[A-Za-z0-9.-]{1,70}$'
      or x.value->>'outcome' is null or x.value->>'outcome' not in ('completed','failed')
      or (x.value->>'errorCode' is not null and x.value->>'errorCode' !~ '^[a-z-]{1,80}$')
      or x.value->>'toolEventCount' is null or x.value->>'toolEventCount' !~ '^[0-9]{1,3}$' or (x.value->>'toolEventCount')::integer>256
      or x.value->>'rerouteCount' is null or x.value->>'rerouteCount' !~ '^[0-9]{1,2}$' or (x.value->>'rerouteCount')::integer>32
      or x.value->>'turnsStarted' is null or x.value->>'turnsStarted' !~ '^[0-9]{1,2}$' or (x.value->>'turnsStarted')::integer>32
      or x.value->>'turnsCompleted' is null or x.value->>'turnsCompleted' !~ '^[0-9]{1,2}$' or (x.value->>'turnsCompleted')::integer>32
      or (x.value->>'outcome'='completed' and x.value->>'errorCode' is not null)
      or (x.value->>'outcome'='failed' and x.value->>'errorCode' is null)) then
    raise exception 'HQ_MODEL_EXECUTION_ATTEMPT_INVALID' using errcode='22023';
  end if;
  if v_fallback then
    if v_attempts->0->>'model' is distinct from 'gpt-6.1-terra' or v_attempts->0->>'outcome' is distinct from 'failed'
      or v_attempts->0->>'errorCode' not in ('provider-model-unavailable','provider-capacity','provider-error')
      or (v_attempts->0->>'toolEventCount')::integer<>0 or (v_attempts->0->>'rerouteCount')::integer<>0
      or v_attempts->1->>'model' is distinct from 'gpt-6-luna'
      or p_evidence->>'policy' is distinct from 'terra-primary-luna-fallback-v1' then
      raise exception 'HQ_MODEL_EXECUTION_FALLBACK_INVALID' using errcode='22023';
    end if;
  elsif v_attempts->0->>'model' is distinct from r.model then
    raise exception 'HQ_MODEL_EXECUTION_PRIMARY_INVALID' using errcode='22023';
  end if;
  v_model:=case when v_outcome='completed' then v_attempts->(v_count-1)->>'model' end;
  if p_evidence->>'selectedModel' is distinct from v_model
    or (v_outcome='completed' and v_attempts->(v_count-1)->>'outcome' is distinct from 'completed')
    or (v_outcome='failed' and v_attempts->(v_count-1)->>'outcome' is distinct from 'failed') then
    raise exception 'HQ_MODEL_EXECUTION_OUTCOME_INVALID' using errcode='22023';
  end if;
  if v_outcome='completed' then
    select * into a from public.hq_task_artifacts where job_id=j.id and agent_id=j.agent_id;
    if j.status<>'completed' or a.id is null then raise exception 'HQ_MODEL_EXECUTION_ARTIFACT_REQUIRED' using errcode='22023'; end if;
  elsif j.status<>'blocked' then raise exception 'HQ_MODEL_EXECUTION_FAILURE_STATE_INVALID' using errcode='22023'; end if;
  v_digest:=encode(extensions.digest(p_evidence::text,'sha256'),'hex');
  select * into old from hq_private.workforce_model_execution_receipts where job_id=j.id;
  if found then
    if old.evidence_digest<>v_digest then raise exception 'HQ_MODEL_EXECUTION_CONFLICT' using errcode='PT409'; end if;
    return jsonb_build_object('accepted',true,'replayed',true);
  end if;
  insert into hq_private.workforce_model_execution_receipts(job_id,artifact_id,worker_id,agent_id,configured_model,selected_model,
    provider_served_model,fallback_used,outcome,evidence,evidence_digest)
    values(j.id,a.id,p_worker_id,j.agent_id,r.model,v_model,'unknown',v_fallback,v_outcome,p_evidence,v_digest);
  return jsonb_build_object('accepted',true,'replayed',false);
end $$;
revoke all on function hq_private.record_workforce_model_execution(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function hq_private.worker_finish_v3(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  v_result:=hq_private.worker_finish_v2(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence);
  if p_model_evidence is not null and not coalesce((v_result->>'discarded')::boolean,false) then
    perform hq_private.record_workforce_model_execution(p_job_id,p_worker_id,p_model_evidence);
  end if;
  return v_result;
end $$;
create function public.hq_worker_finish_v3(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_finish_v3(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence); $$;
revoke all on function hq_private.worker_finish_v3(uuid,uuid,uuid,text,text,jsonb,jsonb),public.hq_worker_finish_v3(uuid,uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_finish_v3(uuid,uuid,uuid,text,text,jsonb,jsonb),
  public.hq_worker_finish_v3(uuid,uuid,uuid,text,text,jsonb,jsonb) to authenticated;

-- Attach the worker's immutable model-attempt receipt to the exact artifact
-- that heads review. This is host-observed launch/CLI evidence, not provider
-- attestation. The reviewer sees Luna explicitly when fallback was used.
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
      if v_trial->>'agentId'=v_job->>'agent_id' and v_job->>'kind' in ('task-start','task-work','task-report') then
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
revoke all on function hq_private.workforce_enrich_claim(jsonb) from public,anon,authenticated,service_role;
