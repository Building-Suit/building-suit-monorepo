-- Explicit, synthetic supervised trials. A trial tests one worker/skill pair
-- through the existing queue; it cannot qualify itself or publish externally.
create table hq_private.workforce_trials (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.hq_business_tasks(id),
  request_key uuid not null unique,
  agent_id text not null references hq_private.agent_roster(id),
  manager_id text not null references hq_private.agent_roster(id),
  skill_file_id text not null references hq_private.brain_files(file_id),
  binding_digest text not null check(binding_digest ~ '^[0-9a-f]{64}$'),
  profile_source_version text not null,
  skill_source_version text not null,
  requested_by uuid not null,
  status text not null default 'active' check(status in ('active','passed','failed','canceled')),
  review_job_id uuid references public.hq_agent_jobs(id),
  artifact_id uuid references public.hq_task_artifacts(id),
  expires_at timestamptz not null default (clock_timestamp()+interval '2 hours'),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check(expires_at>created_at and expires_at<=created_at+interval '2 hours')
);
create unique index workforce_trial_one_active_per_agent on hq_private.workforce_trials(agent_id) where status='active';
alter table hq_private.workforce_trials enable row level security;
revoke all on hq_private.workforce_trials from public,anon,authenticated,service_role;

-- Keep every qualification issuance, including later requalification, as a
-- distinct immutable receipt. The former one-row table is retained privately
-- for migration compatibility but is no longer an authority source.
alter table hq_private.workforce_qualifications rename to workforce_qualifications_legacy;
create table hq_private.workforce_qualification_receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  agent_id text not null references hq_private.agent_roster(id),
  trial_id uuid not null unique references hq_private.workforce_trials(id),
  scope text not null check(scope='bounded-drafting-v1'),
  evidence_artifact_id uuid not null references public.hq_task_artifacts(id),
  review_job_id uuid not null references public.hq_agent_jobs(id),
  reviewer_id text not null references hq_private.agent_roster(id) check(reviewer_id='AG-HR-003'),
  binding_digest text not null check(binding_digest ~ '^[0-9a-f]{64}$'),
  profile_file_id text not null references hq_private.brain_files(file_id),
  skill_file_ids jsonb not null check(jsonb_typeof(skill_file_ids)='array' and jsonb_array_length(skill_file_ids)>0),
  model_tier text not null check(model_tier='T1_WORKER'),
  manager_id text not null references hq_private.agent_roster(id),
  department_key text not null references public.hq_departments(department_key),
  host_execution_id uuid not null,
  authorized_by uuid not null,
  qualified_at timestamptz not null default clock_timestamp()
);
create index workforce_qualification_current_idx on hq_private.workforce_qualification_receipts(agent_id,qualified_at desc,receipt_id desc);
alter table hq_private.workforce_qualification_receipts enable row level security;
revoke all on hq_private.workforce_qualification_receipts from public,anon,authenticated,service_role;
create trigger workforce_qualification_receipt_immutable before update or delete on hq_private.workforce_qualification_receipts
  for each row execute function hq_private.immutable_record();

-- This immutable record captures exactly what the trusted worker host invoked
-- for a supervised trial. It attests to host-resolved command settings only;
-- Codex CLI JSONL does not report the provider-served model for an ordinary
-- completed turn, so that value is deliberately fixed to 'unknown'.
create table hq_private.workforce_trial_host_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references hq_private.workforce_trials(id),
  agent_id text not null references hq_private.agent_roster(id),
  worker_id uuid not null references hq_private.agent_workers(worker_id),
  worker_job_id uuid not null unique references public.hq_agent_jobs(id),
  artifact_id uuid references public.hq_task_artifacts(id),
  artifact_digest text check(artifact_digest ~ '^[0-9a-f]{64}$'),
  attestation_level text not null check(attestation_level in ('host-resolved-invocation','host-cli-preflight')),
  worker_source_digest text not null check(worker_source_digest ~ '^[0-9a-f]{64}$'),
  node_version text not null check(node_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$'),
  cli_version text check(cli_version ~ '^codex-cli [A-Za-z0-9.+-]{1,80}$'),
  cli_version_source text not null check(cli_version_source='same-binary-version-probe'),
  cli_executable text not null check(octet_length(cli_executable) between 1 and 1024),
  cli_binary_digest text check(cli_binary_digest ~ '^[0-9a-f]{64}$'),
  configured_model text not null check(configured_model ~ '^gpt-[A-Za-z0-9.-]{1,70}$'),
  resolved_model text check(resolved_model ~ '^gpt-[A-Za-z0-9.-]{1,70}$'),
  configured_effort text not null check(configured_effort in ('minimal','low','medium','high','xhigh')),
  resolved_effort text check(resolved_effort in ('minimal','low','medium','high','xhigh')),
  setting_resolution_source text not null check(setting_resolution_source in ('explicit-host-generated-codex-exec-argv-and-locked-config','not-resolved-cli-preflight-failed')),
  invocation_status text not null check(invocation_status in ('launched','not-launched')),
  thread_id text check(thread_id ~ '^[0-9a-fA-F-]{36}$'),
  turns_started integer not null check(turns_started between 0 and 1),
  turns_completed integer not null check(turns_completed between 0 and 1),
  provider_served_model text not null check(provider_served_model='unknown'),
  invocation jsonb not null check(jsonb_typeof(invocation)='object'),
  observed_errors jsonb not null check(jsonb_typeof(observed_errors)='array' and jsonb_array_length(observed_errors)<=32),
  observed_reroutes jsonb not null check(jsonb_typeof(observed_reroutes)='array' and jsonb_array_length(observed_reroutes)<=32),
  observed_event_coverage text not null check(observed_event_coverage='codex-exec-jsonl-events-only'),
  outcome text not null check(outcome in ('completed','failed')),
  evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
  evidence_reference text not null check(evidence_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,255}$'),
  recorded_by text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  check((attestation_level='host-resolved-invocation' and invocation_status='launched'
      and configured_model=resolved_model and configured_effort=resolved_effort
      and setting_resolution_source='explicit-host-generated-codex-exec-argv-and-locked-config')
    or (attestation_level='host-cli-preflight' and invocation_status='not-launched'
      and resolved_model is null and resolved_effort is null and setting_resolution_source='not-resolved-cli-preflight-failed')),
  check((outcome='completed' and artifact_id is not null and artifact_digest is not null
    and thread_id is not null and turns_started=1 and turns_completed=1
    and attestation_level='host-resolved-invocation' and observed_errors='[]'::jsonb and observed_reroutes='[]'::jsonb)
    or (outcome='failed' and artifact_id is null and artifact_digest is null
      and (jsonb_array_length(observed_errors)>0 or jsonb_array_length(observed_reroutes)>0))),
  unique(trial_id,worker_job_id)
);
alter table hq_private.workforce_trial_host_execution_receipts enable row level security;
revoke all on hq_private.workforce_trial_host_execution_receipts from public,anon,authenticated,service_role;
create trigger workforce_trial_host_execution_receipt_immutable before update or delete on hq_private.workforce_trial_host_execution_receipts
  for each row execute function hq_private.immutable_record();
alter table hq_private.workforce_qualification_receipts add constraint workforce_qualification_host_execution_fk
  foreign key(host_execution_id) references hq_private.workforce_trial_host_execution_receipts(id);

create function hq_private.record_trial_host_execution(p_trial_id uuid,p_worker_job_id uuid,p_artifact_id uuid,p_evidence jsonb,p_evidence_reference text) returns uuid
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
    or v_level not in ('host-resolved-invocation','host-cli-preflight')
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
    or p_evidence->>'observedEventCoverage' is distinct from 'codex-exec-jsonl-events-only'
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
    or (select count(*) from jsonb_each(p_evidence->'invocation'))<>4
    or exists(select 1 from jsonb_each(p_evidence->'invocation') e(key,value)
      where e.key not in ('executable','argv','plannedArgv','environment','stdinSha256'))
    or p_evidence->'invocation'->>'stdinSha256' !~ '^[0-9a-f]{64}$'
    or p_evidence->'invocation'->>'executable' is distinct from p_evidence->>'cliExecutable'
    or not (v_argv @> jsonb_build_array('--model',v_agent.model))
    or not (v_argv @> jsonb_build_array('-c','model_reasoning_effort="'||v_agent.effort||'"'))
    or not (v_argv @> jsonb_build_array('--sandbox','read-only'))
    or p_evidence_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,255}$' then
    raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023';
  end if;
  if v_level='host-resolved-invocation' then
    if p_evidence->>'invocationStatus' is distinct from 'launched'
      or p_evidence->>'settingResolutionSource' is distinct from 'explicit-host-generated-codex-exec-argv-and-locked-config'
      or p_evidence->>'resolvedModel' is distinct from v_agent.model
      or p_evidence->>'resolvedEffort' is distinct from v_agent.effort
      or p_evidence->>'cliBinaryDigest' !~ '^[0-9a-f]{64}$'
      or p_evidence->>'cliVersion' !~ '^codex-cli [A-Za-z0-9.+-]{1,80}$' then
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
      or p_evidence->>'settingResolutionSource' is distinct from 'not-resolved-cli-preflight-failed'
      or p_evidence->>'resolvedModel' is not null or p_evidence->>'resolvedEffort' is not null
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
    cli_version,cli_version_source,cli_executable,cli_binary_digest,configured_model,resolved_model,
    configured_effort,resolved_effort,setting_resolution_source,invocation_status,thread_id,turns_started,turns_completed,
    provider_served_model,invocation,observed_errors,observed_reroutes,observed_event_coverage,outcome,
    evidence_digest,evidence_reference,recorded_by)
  values(p_trial_id,v_agent.id,v_worker.worker_id,v_job.id,v_artifact.id,v_artifact.digest,p_evidence->>'attestationLevel',
    p_evidence->>'workerSourceDigest',p_evidence->>'nodeVersion',p_evidence->>'cliVersion',p_evidence->>'cliVersionSource',p_evidence->>'cliExecutable',
    p_evidence->>'cliBinaryDigest',p_evidence->>'configuredModel',p_evidence->>'resolvedModel',
    p_evidence->>'configuredEffort',p_evidence->>'resolvedEffort',p_evidence->>'settingResolutionSource',p_evidence->>'invocationStatus',p_evidence->>'threadId',
    (p_evidence->>'turnsStarted')::integer,(p_evidence->>'turnsCompleted')::integer,p_evidence->>'providerServedModel',
    p_evidence->'invocation',p_evidence->'observedErrors',p_evidence->'observedReroutes',p_evidence->>'observedEventCoverage',
    p_evidence->>'outcome',v_digest,p_evidence_reference,session_user) returning id into v_id;
  return v_id;
end $$;
revoke all on function hq_private.record_trial_host_execution(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;

-- A supervised-trial binding intentionally excludes lifecycle and the whole
-- registry-row digest: HR may advance pending staff to active after the trial.
-- It still binds the exact profile/skill revisions, model target and manager.
create function hq_private.workforce_trial_binding_digest(p_agent_id text) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(jsonb_build_array(r.id,r.department_key,r.profile_file_id,
    (select f.source_version from hq_private.brain_files f where f.file_id=r.profile_file_id),r.skill_file_ids,
    (select coalesce(jsonb_agg(jsonb_build_array(f.file_id,f.source_version) order by f.file_id),'[]'::jsonb)
      from hq_private.brain_files f where f.file_id in (select jsonb_array_elements_text(r.skill_file_ids))),
    r.model_tier,r.manager_id,r.model,r.effort)::text,'sha256'),'hex')
  from hq_private.agent_roster r where r.id=p_agent_id
$$;
revoke all on function hq_private.workforce_trial_binding_digest(text) from public,anon,authenticated,service_role;

-- Qualification evidence survives only a controlled lifecycle transition. The
-- active-state predicate below still prevents execution until HR activates the
-- worker after the receipt is issued.
create or replace function hq_private.workforce_agent_binding_digest(p_agent_id text) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(jsonb_build_array(r.id,r.department_key,r.profile_file_id,
    (select f.source_version from hq_private.brain_files f where f.file_id=r.profile_file_id),r.skill_file_ids,
    (select coalesce(jsonb_agg(jsonb_build_array(f.file_id,f.source_version) order by f.file_id),'[]'::jsonb)
      from hq_private.brain_files f where f.file_id in (select jsonb_array_elements_text(r.skill_file_ids))),
    r.model_tier,r.manager_id,r.model,r.effort)::text,'sha256'),'hex')
  from hq_private.agent_roster r where r.id=p_agent_id
$$;
revoke all on function hq_private.workforce_agent_binding_digest(text) from public,anon,authenticated,service_role;

create function hq_private.workforce_trial_context(p_task_id uuid,p_agent_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when t.status='active' and t.expires_at>clock_timestamp()
    and t.binding_digest=hq_private.workforce_trial_binding_digest(t.agent_id)
    and t.agent_id=p_agent_id and t.skill_file_id in (select jsonb_array_elements_text(r.skill_file_ids))
    and f.source_version=t.profile_source_version and s.source_version=t.skill_source_version
    then jsonb_build_object('id',t.id,'taskId',t.task_id,'agentId',t.agent_id,'managerId',t.manager_id,
      'skillFileId',t.skill_file_id,'bindingDigest',t.binding_digest,'scope','synthetic-internal-trial-v1',
      'status',t.status,'expiresAt',t.expires_at,'externalActionsAllowed',false,'publishingAllowed',false)
    else null end
  from hq_private.workforce_trials t join hq_private.agent_roster r on r.id=t.agent_id
  join hq_private.brain_files f on f.file_id=r.profile_file_id
  join hq_private.brain_files s on s.file_id=t.skill_file_id
  where t.task_id=p_task_id
$$;
revoke all on function hq_private.workforce_trial_context(uuid,text) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_agent_qualified(p_agent_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from hq_private.agent_roster r
    join hq_private.agent_roster m on m.id=r.manager_id
    join hq_private.workforce_qualification_receipts q on q.agent_id=r.id
    join hq_private.workforce_trials t on t.id=q.trial_id and t.status='passed'
    join public.hq_task_artifacts a on a.id=q.evidence_artifact_id and a.id=t.artifact_id and a.task_id=t.task_id
    join hq_private.workforce_trial_host_execution_receipts x on x.id=q.host_execution_id
      and x.trial_id=t.id and x.agent_id=r.id and x.artifact_id=a.id and x.artifact_digest=a.digest
      and x.worker_job_id=a.job_id and x.outcome='completed' and x.provider_served_model='unknown'
      and x.configured_model=r.model and x.resolved_model=r.model
      and x.configured_effort=r.effort and x.resolved_effort=r.effort
    join public.hq_agent_jobs review on review.id=q.review_job_id and review.id=t.review_job_id
    join hq_private.brain_files e on e.file_id=r.profile_file_id and e.in_scope and not e.trashed
    where r.id=p_agent_id and r.enabled and r.model_tier='T1_WORKER' and m.model_tier='T2_HEAD'
      and r.department_key=m.department_key and r.lifecycle !~* '(configured|candidate|trial|pending|suspended|inactive|retired|terminated|archived|paused|testing-only)'
      and q.scope='bounded-drafting-v1' and q.reviewer_id='AG-HR-003' and review.agent_id='AG-HR-003'
      and review.kind='ceo-review' and review.status='completed' and review.result_text::jsonb->>'accepted'='true'
      and q.binding_digest=hq_private.workforce_agent_binding_digest(r.id)
      and q.profile_file_id=r.profile_file_id and q.skill_file_ids=r.skill_file_ids
      and q.model_tier=r.model_tier and q.manager_id=r.manager_id and q.department_key=r.department_key)
$$;
revoke all on function hq_private.workforce_agent_qualified(text) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_qualification_context(p_agent_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when hq_private.workforce_agent_qualified(r.id) then jsonb_build_object(
    'status','qualified','receiptId',q.receipt_id,'evidenceId',q.evidence_artifact_id::text,
    'profileFileId',q.profile_file_id,'skillFileIds',q.skill_file_ids,'bindingDigest',q.binding_digest,
    'scope',q.scope,'modelTier',q.model_tier,'managerId',q.manager_id,'departmentKey',q.department_key,
    'reviewerId',q.reviewer_id,'reviewJobId',q.review_job_id,'trialId',q.trial_id,
    'hostExecutionId',q.host_execution_id,'providerServedModel','unknown')
    else null end
  from hq_private.agent_roster r left join lateral (
    select * from hq_private.workforce_qualification_receipts x where x.agent_id=r.id order by x.qualified_at desc,x.receipt_id desc limit 1
  ) q on true where r.id=p_agent_id
$$;
revoke all on function hq_private.workforce_qualification_context(text) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_head_authorized(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.hq_agent_jobs j
      join hq_private.agent_roster a on a.id=j.agent_id
      join hq_private.agent_roster m on m.id=a.manager_id
    where j.id=p_job_id and j.kind in ('task-start','task-work')
      and a.model_tier='T1_WORKER' and m.model_tier='T2_HEAD'
      and m.department_key=a.department_key
      and (hq_private.workforce_agent_qualified(a.id) or hq_private.workforce_trial_context(j.task_id,a.id) is not null)
      and (exists(select 1 from public.hq_agent_jobs ack where ack.task_id=j.task_id
        and ack.kind='task-ack' and ack.status='completed' and ack.agent_id=m.id
        and ack.result_text::jsonb->>'delegateId'=a.id)
        and ((j.kind='task-start' and exists(select 1 from public.hq_agent_jobs parent
          where parent.id=j.depends_on and parent.task_id=j.task_id and parent.kind in ('task-ack','head-review')
            and parent.status='completed' and parent.agent_id=m.id))
          or (j.kind='task-work' and exists(select 1 from public.hq_agent_jobs start_job
            where start_job.id=j.depends_on and start_job.task_id=j.task_id and start_job.kind='task-start'
              and start_job.status='completed' and start_job.agent_id=a.id)))
  )
  )
$$;
revoke all on function hq_private.workforce_head_authorized(uuid) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job jsonb; v_context jsonb; v_agent hq_private.agent_roster; v_manager hq_private.agent_roster;
  v_assignee hq_private.agent_roster; v_roster jsonb; v_trial jsonb; v_trial_id uuid;
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

-- The ordinary task-ack validator permits only qualified workers. Expand that
-- single check to the exact active trial worker for this exact task and head;
-- never make a pending employee generally assignable.
do $$
declare v_definition text; v_fn regprocedure:=to_regprocedure('hq_private.worker_finish_before_meetings(uuid,uuid,uuid,text,text)');
  v_old text:='hq_private.workforce_agent_assignable(id)';
  v_new text:='(hq_private.workforce_agent_assignable(id) or exists(select 1 from hq_private.workforce_trials t where t.task_id=v_job.task_id and t.agent_id=v_body->>''delegateId'' and t.manager_id=v_job.agent_id and t.status=''active'' and t.expires_at>clock_timestamp()))';
begin
  if v_fn is null then return; end if;
  v_definition:=pg_get_functiondef(v_fn);
  -- Older disposable fixtures do not install the structured-output validator.
  -- Leave them unchanged: their ordinary assignability gate keeps T1 trial
  -- delegation unavailable and therefore fails closed.
  if position(v_old in v_definition)=0 then return; end if;
  execute replace(v_definition,v_old,v_new);
end $$;

-- Keep manager review first, then reserve Steve's independent-review slot for Iris
-- only on trials. Ordinary task review routing is unchanged.
create function hq_private.route_trial_review_to_iris() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='ceo-review' and new.task_id is not null and exists(
    select 1 from hq_private.workforce_trials t where t.task_id=new.task_id and t.status='active' and t.expires_at>clock_timestamp())
      and exists(select 1 from public.hq_agent_jobs p where p.id=new.depends_on and p.kind='head-review' and p.status='completed') then
    new.agent_id:='AG-HR-003';
  end if;
  return new;
end $$;
revoke all on function hq_private.route_trial_review_to_iris() from public,anon,authenticated,service_role;
create trigger hq_trial_review_to_iris before insert on public.hq_agent_jobs
  for each row execute function hq_private.route_trial_review_to_iris();

create function hq_private.route_trial_correction_through_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_trial hq_private.workforce_trials;
begin
  if new.kind='task-start' and new.task_id is not null then
    select * into v_trial from hq_private.workforce_trials where task_id=new.task_id and status='active' and expires_at>clock_timestamp();
    if v_trial.id is not null then
      if new.agent_id=v_trial.agent_id and exists(select 1 from public.hq_agent_jobs p
        where p.id=new.depends_on and p.kind='ceo-review' and p.agent_id='AG-HR-003' and p.status='completed') then
        -- Iris's rejection goes back to the T2 head, who scopes the bounded repair.
        new.kind:='task-ack'; new.agent_id:=v_trial.manager_id;
      elsif new.agent_id<>v_trial.agent_id or not exists(select 1 from public.hq_agent_jobs p
        where p.id=new.depends_on and p.task_id=new.task_id and p.kind in ('task-ack','head-review')
          and p.agent_id=v_trial.manager_id and p.status='completed') then
        new.status:='blocked'; new.error:='trial-assignment-mismatch'; new.completed_at:=clock_timestamp();
        update public.hq_business_tasks set status='blocked',error='trial-assignment-mismatch',completed_at=clock_timestamp(),updated_at=clock_timestamp()
          where id=new.task_id and status not in ('blocked','canceled','completed');
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function hq_private.route_trial_correction_through_head() from public,anon,authenticated,service_role;
create trigger hq_trial_corrections_through_head before insert on public.hq_agent_jobs
  for each row execute function hq_private.route_trial_correction_through_head();

create function hq_private.direct_trial_correction_to_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_trial hq_private.workforce_trials; v_job public.hq_agent_jobs; v_head hq_private.agent_roster;
begin
  if to_jsonb(new)->>'kind'='recovery' and to_jsonb(new)->>'job_id' is not null then
    select * into v_job from public.hq_agent_jobs where id=new.job_id and kind='ceo-review' and agent_id='AG-HR-003' and status='completed';
    if v_job.id is not null then
      select * into v_trial from hq_private.workforce_trials where task_id=v_job.task_id and status='active';
      select * into v_head from hq_private.agent_roster where id=v_trial.manager_id;
      if v_trial.id is not null then
        new.agent_id:=v_head.id; new.mention_ids:=array[v_head.id];
        new.text:='@'||v_head.name||' Iris rejected the supervised trial artifact. Review the recorded findings and issue the exact bounded repair to the trial worker.';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function hq_private.direct_trial_correction_to_head() from public,anon,authenticated,service_role;
create trigger hq_trial_correction_message_to_head before insert on public.hq_agent_messages
  for each row execute function hq_private.direct_trial_correction_to_head();

create function hq_private.record_trial_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_task uuid; v_result jsonb;
begin
  if new.kind<>'ceo-review' or new.agent_id<>'AG-HR-003' or new.status<>'completed' or new.task_id is null then return new; end if;
  v_result:=new.result_text::jsonb;
  if v_result->'accepted'='true'::jsonb and exists(select 1 from public.hq_task_artifacts a
    where a.id=new.artifact_id and a.task_id=new.task_id and a.digest=v_result->>'artifactDigest') then
    update hq_private.workforce_trials set status='passed',review_job_id=new.id,
      artifact_id=(select j.artifact_id from public.hq_agent_jobs j where j.id=new.depends_on),completed_at=clock_timestamp()
      where task_id=new.task_id and status='active' and expires_at>clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function hq_private.record_trial_review() from public,anon,authenticated,service_role;
create trigger hq_record_trial_review after update of status on public.hq_agent_jobs
  for each row when(new.status='completed' and new.kind='ceo-review' and new.agent_id='AG-HR-003')
  execute function hq_private.record_trial_review();

create function hq_private.suppress_trial_learning() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='lesson-extract' and new.task_id is not null and exists(
    select 1 from hq_private.workforce_trials t where t.task_id=new.task_id) then
    new.status:='blocked'; new.error:='trial-learning-disabled'; new.completed_at:=clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function hq_private.suppress_trial_learning() from public,anon,authenticated,service_role;
create trigger hq_trial_learning_disabled before insert on public.hq_agent_jobs
  for each row execute function hq_private.suppress_trial_learning();

create function hq_private.close_trial_with_task() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('blocked','canceled') and old.status is distinct from new.status then
    update hq_private.workforce_trials set status=case when new.status='canceled' then 'canceled' else 'failed' end,
      completed_at=clock_timestamp() where task_id=new.id and status='active';
  end if;
  return new;
end $$;
revoke all on function hq_private.close_trial_with_task() from public,anon,authenticated,service_role;
create trigger hq_close_trial_with_task after update of status on public.hq_business_tasks
  for each row execute function hq_private.close_trial_with_task();

create function hq_private.begin_supervised_worker_trial(p_agent_id text,p_skill_file_id text,p_request_key uuid) returns jsonb
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
    or jsonb_array_length(v_agent.skill_file_ids)<>1
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
revoke all on function hq_private.begin_supervised_worker_trial(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.begin_supervised_worker_trial(text,text,uuid) to authenticated;

create function hq_private.issue_workforce_qualification(p_trial_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_trial hq_private.workforce_trials; v_agent hq_private.agent_roster;
  v_task public.hq_business_tasks; v_review public.hq_agent_jobs; v_artifact public.hq_task_artifacts;
  v_execution hq_private.workforce_trial_host_execution_receipts; v_receipt hq_private.workforce_qualification_receipts; v_inserted boolean;
begin
  if v_uid is null or p_trial_id is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  select * into v_trial from hq_private.workforce_trials where id=p_trial_id;
  select * into v_agent from hq_private.agent_roster where id=v_trial.agent_id and enabled;
  select * into v_task from public.hq_business_tasks where id=v_trial.task_id and founder_user_id=v_uid;
  select * into v_review from public.hq_agent_jobs where id=v_trial.review_job_id and task_id=v_trial.task_id;
  select * into v_artifact from public.hq_task_artifacts where id=v_trial.artifact_id and task_id=v_trial.task_id;
  select * into v_execution from hq_private.workforce_trial_host_execution_receipts x
    where x.trial_id=v_trial.id and x.agent_id=v_agent.id and x.artifact_id=v_artifact.id
      and x.artifact_digest=v_artifact.digest and x.outcome='completed' and x.provider_served_model='unknown'
      and x.configured_model=v_agent.model and x.resolved_model=v_agent.model
      and x.configured_effort=v_agent.effort and x.resolved_effort=v_agent.effort;
  if v_trial.id is null or v_trial.status<>'passed' or v_trial.completed_at>v_trial.expires_at
    or v_task.status<>'completed' or not exists(select 1 from public.hq_agent_jobs r where r.task_id=v_task.id and r.kind='task-report' and r.status='completed')
    or not exists(select 1 from public.hq_agent_jobs l where l.task_id=v_task.id and l.kind='lesson-extract' and l.status='blocked' and l.error='trial-learning-disabled')
    or v_review.kind<>'ceo-review' or v_review.agent_id<>'AG-HR-003'
    or v_review.status<>'completed' or v_review.result_text::jsonb->'accepted'<>'true'::jsonb
    or v_artifact.id is null or v_artifact.agent_id<>v_agent.id
    or v_trial.binding_digest<>hq_private.workforce_trial_binding_digest(v_agent.id)
    or v_agent.lifecycle !~* '(configured|trial|pending)'
    or v_agent.model_tier<>'T1_WORKER' or v_execution.id is null then
    raise exception 'HQ_TRIAL_EVIDENCE_INCOMPLETE' using errcode='22023'; end if;
  insert into hq_private.workforce_qualification_receipts(agent_id,trial_id,scope,evidence_artifact_id,review_job_id,
    reviewer_id,binding_digest,profile_file_id,skill_file_ids,model_tier,manager_id,department_key,host_execution_id,authorized_by)
  values(v_agent.id,v_trial.id,'bounded-drafting-v1',v_artifact.id,v_review.id,'AG-HR-003',hq_private.workforce_agent_binding_digest(v_agent.id),
    v_agent.profile_file_id,v_agent.skill_file_ids,v_agent.model_tier,v_agent.manager_id,v_agent.department_key,v_execution.id,v_uid)
  on conflict(trial_id) do nothing returning * into v_receipt;
  v_inserted:=found;
  if not v_inserted then
    select * into v_receipt from hq_private.workforce_qualification_receipts where trial_id=v_trial.id;
    if v_receipt.binding_digest=hq_private.workforce_agent_binding_digest(v_receipt.agent_id)
      and v_receipt.profile_file_id=v_agent.profile_file_id and v_receipt.skill_file_ids=v_agent.skill_file_ids
      and v_receipt.model_tier=v_agent.model_tier and v_receipt.manager_id=v_agent.manager_id
      and v_receipt.host_execution_id=v_execution.id
      and v_receipt.department_key=v_agent.department_key then
      return jsonb_build_object('accepted',true,'receiptId',v_receipt.receipt_id,'agentId',v_receipt.agent_id,'reviewerId',v_receipt.reviewer_id);
    end if;
    raise exception 'HQ_QUALIFICATION_RECEIPT_STALE' using errcode='22023';
  end if;
  return jsonb_build_object('accepted',true,'receiptId',v_receipt.receipt_id,'agentId',v_agent.id,'reviewerId','AG-HR-003');
end $$;
revoke all on function hq_private.issue_workforce_qualification(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.issue_workforce_qualification(uuid) to authenticated;

create function public.hq_begin_supervised_worker_trial(p_agent_id text,p_skill_file_id text,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select hq_private.begin_supervised_worker_trial(p_agent_id,p_skill_file_id,p_request_key)
$$;
create function public.hq_issue_workforce_qualification(p_trial_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select hq_private.issue_workforce_qualification(p_trial_id)
$$;
revoke all on function public.hq_begin_supervised_worker_trial(text,text,uuid),public.hq_issue_workforce_qualification(uuid) from public,anon,service_role;
grant execute on function public.hq_begin_supervised_worker_trial(text,text,uuid),public.hq_issue_workforce_qualification(uuid) to authenticated;
