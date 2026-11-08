-- Finite public retail adapter qualification; no seed, canonical edit or activation.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
lock table public.hq_agent_jobs in share row exclusive mode;
lock table hq_private.agent_workers in share row exclusive mode;
alter table hq_private.workforce_trials drop constraint workforce_trials_purpose_check;
alter table hq_private.workforce_trials add constraint workforce_trials_purpose_check
 check(purpose in ('synthetic-internal-trial-v1','public-research-tool-trial-v1','evaluator-skill-trial-v1','public-retail-tool-trial-v1'));

create table hq_private.public_retail_tasks (
  task_id uuid primary key references public.hq_business_tasks(id),
  agent_id text not null references hq_private.agent_roster(id) check(agent_id='AG-RES-002'),
  binding_digest text not null check(binding_digest ~ '^[0-9a-f]{64}$'),
  trial_id uuid references hq_private.workforce_trials(id),
  category text not null check(category in ('clothing','footwear','homewares')),
  created_at timestamptz not null default clock_timestamp()
);

alter table hq_private.public_retail_tasks enable row level security;
revoke all on hq_private.public_retail_tasks from public,anon,authenticated,service_role;

create trigger hq_public_retail_tasks_immutable before update or delete on hq_private.public_retail_tasks for each row execute function hq_private.immutable_record();

create table hq_private.public_retail_receipts (
  job_id uuid primary key references public.hq_agent_jobs(id),
  task_id uuid not null references public.hq_business_tasks(id),
  artifact_id uuid unique references public.hq_task_artifacts(id),
  artifact_digest text check(artifact_digest ~ '^[0-9a-f]{64}$'),
  agent_id text not null references hq_private.agent_roster(id) check(agent_id='AG-RES-002'),
  binding_digest text not null check(binding_digest ~ '^[0-9a-f]{64}$'),
  evidence jsonb not null check(jsonb_typeof(evidence)='object' and octet_length(evidence::text)<=36000),
  outcome text not null check(outcome in ('completed','blocked')),
  recorded_at timestamptz not null default clock_timestamp()
);

alter table hq_private.public_retail_receipts enable row level security;
revoke all on hq_private.public_retail_receipts from public,anon,authenticated,service_role;

create trigger hq_public_retail_receipts_immutable before update or delete on hq_private.public_retail_receipts for each row execute function hq_private.immutable_record();

create table hq_private.public_retail_deliveries (
  job_id uuid primary key references public.hq_agent_jobs(id),
  input_digest text not null check(input_digest ~ '^[0-9a-f]{64}$'),
  job_result_digest text not null check(job_result_digest ~ '^[0-9a-f]{64}$'),
  result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=4096)
);

alter table hq_private.public_retail_deliveries enable row level security;
revoke all on hq_private.public_retail_deliveries from public,anon,authenticated,service_role;

create trigger hq_public_retail_deliveries_immutable before update or delete on hq_private.public_retail_deliveries for each row execute function hq_private.immutable_record();

create table hq_private.public_retail_finish_requests (
  job_id uuid primary key references public.hq_agent_jobs(id),
  worker_id uuid not null references hq_private.agent_workers(worker_id), transaction_id bigint not null
);

alter table hq_private.public_retail_finish_requests enable row level security;
revoke all on hq_private.public_retail_finish_requests from public,anon,authenticated,service_role;

-- A revision transition is necessary setup evidence, not semantic approval of
-- document contents. Founder Start binds the separately reviewed current source.
-- The earliest genuine salon receipt is stable across later salon requalification.
create function hq_private.public_retail_setup_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from hq_private.agent_roster a
  join hq_private.brain_files p on p.file_id=a.profile_file_id and p.in_scope and not p.trashed
   and p.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and p.source_version is not null
  join hq_private.agent_roster m on m.id=a.manager_id and m.enabled and m.model_tier='T2_HEAD'
   and m.department_key=a.department_key
  join lateral (select t.profile_source_version from hq_private.workforce_qualification_receipts q
   join hq_private.workforce_trials t on t.id=q.trial_id and t.agent_id=q.agent_id and t.status='passed'
    and t.purpose='public-research-tool-trial-v1' and t.profile_source_version is not null
   join hq_private.workforce_trial_host_execution_receipts x on x.id=q.host_execution_id and x.trial_id=t.id
    and x.agent_id=q.agent_id and x.outcome='completed' and x.attestation_level='host-returned-resolution'
   where q.agent_id=a.id and q.profile_file_id=a.profile_file_id order by q.qualified_at,q.receipt_id limit 1) baseline on true
  where a.id='AG-RES-002' and a.enabled and a.model_tier='T1_WORKER' and a.manager_id='AG-RES-001'
   and a.department_key='research-market-intelligence' and hq_private.workforce_agent_assignable(m.id)
   and jsonb_array_length(a.skill_file_ids) between 1 and 10
   and not exists(select 1 from jsonb_array_elements_text(a.skill_file_ids) skill(file_id)
    left join hq_private.brain_files f on f.file_id=skill.file_id and f.in_scope and not f.trashed
     and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.source_version is not null where f.file_id is null)
   and p.source_version is distinct from baseline.profile_source_version)
$$;
revoke all on function hq_private.public_retail_setup_ready() from public,anon,authenticated,service_role;

create function hq_private.public_retail_trial_source_valid(p_trial_id uuid,p_artifact_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  with recursive lineage as (
    select a.id,a.input_artifact_id,a.task_id,0 depth from public.hq_task_artifacts a
      join hq_private.workforce_trials t on t.id=p_trial_id and t.task_id=a.task_id where a.id=p_artifact_id
    union all
    select a.id,a.input_artifact_id,a.task_id,l.depth+1 from lineage l
      join public.hq_task_artifacts a on a.id=l.input_artifact_id and a.task_id=l.task_id where l.depth<16
  )
  select exists(select 1 from hq_private.workforce_trials t
    join hq_private.public_retail_receipts r on r.task_id=t.task_id and r.agent_id=t.agent_id and r.outcome='completed'
    join public.hq_task_artifacts a on a.id=r.artifact_id and a.job_id=r.job_id and a.digest=r.artifact_digest and a.task_id=t.task_id
    join public.hq_agent_jobs j on j.id=r.job_id and j.task_id=t.task_id and j.agent_id=t.agent_id
      and j.kind='task-work' and j.attempt=0 and j.status='completed'
    join hq_private.workforce_trial_host_execution_receipts x on x.trial_id=t.id and x.worker_job_id=j.id
      and x.artifact_id=a.id and x.artifact_digest=a.digest and x.agent_id=t.agent_id
      and x.outcome='completed' and x.attestation_level='host-returned-resolution'
    where t.id=p_trial_id and t.purpose='public-retail-tool-trial-v1' and t.agent_id='AG-RES-002'
      and t.binding_digest=hq_private.workforce_trial_binding_digest(t.agent_id) and r.binding_digest=t.binding_digest
      and exists(select 1 from lineage l where l.id=a.id))
$$;

revoke all on function hq_private.public_retail_trial_source_valid(uuid,uuid) from public,anon,authenticated,service_role;

create function hq_private.public_retail_qualified(p_agent_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_agent_id='AG-RES-002' and hq_private.public_retail_setup_ready() and hq_private.workforce_agent_qualified(p_agent_id) and exists(
    select 1 from hq_private.workforce_qualification_receipts q
    join hq_private.workforce_trials t on t.id=q.trial_id and t.purpose='public-retail-tool-trial-v1' and t.status='passed'
    join hq_private.public_retail_receipts x on x.task_id=t.task_id and x.outcome='completed'
    where q.agent_id=p_agent_id and q.binding_digest=hq_private.workforce_agent_binding_digest(p_agent_id)
      and x.binding_digest=q.binding_digest and hq_private.public_retail_trial_source_valid(t.id,q.evidence_artifact_id)
      and hq_private.workforce_skill_evidence_valid(p_agent_id,t.skill_file_id))
$$;

revoke all on function hq_private.public_retail_qualified(text) from public,anon,authenticated,service_role;

create or replace function hq_private.role_client_required(p_job public.hq_agent_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from hq_private.workforce_trials t where t.task_id=p_job.task_id
  and t.purpose in ('evaluator-skill-trial-v1','public-retail-tool-trial-v1'))
 or exists(select 1 from hq_private.public_retail_tasks r where r.task_id=p_job.task_id)
$$;

do $$ declare d text; c text; begin
d:=pg_get_functiondef('hq_private.workforce_enrich_claim(jsonb)'::regprocedure);
c:=replace(d,'FUNCTION hq_private.workforce_enrich_claim(', 'FUNCTION hq_private.workforce_enrich_claim_before_public_retail(');
if c=d then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if;
execute c;
end $$;

revoke all on function hq_private.workforce_enrich_claim_before_public_retail(jsonb) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:=hq_private.workforce_enrich_claim_before_public_retail(v); j public.hq_agent_jobs;
  policy hq_private.public_retail_tasks; t hq_private.workforce_trials; context jsonb; binding text; discovery_qualified boolean;
begin
  if result->'job' is null or result->'job'='null'::jsonb then return result; end if;
  select * into j from public.hq_agent_jobs where id=(result->'job'->>'id')::uuid;
  context:=result->'job'->'context';
  if jsonb_typeof(context->'task')='object' then context:=jsonb_set(context,'{task,attempt}',to_jsonb(j.attempt),true); end if;
  if j.kind='task-ack' and j.agent_id='AG-RES-001' and j.attempt=0
    and not exists(select 1 from hq_private.workforce_trials where task_id=j.task_id) then
    discovery_qualified:=hq_private.public_retail_qualified('AG-RES-002');
    context:=jsonb_set(context,'{roster}',coalesce((select jsonb_agg(case when entry->>'id'='AG-RES-002'
      then entry||jsonb_build_object('publicRetailQualified',discovery_qualified) else entry end order by ordinal)
      from jsonb_array_elements(coalesce(context->'roster','[]'::jsonb)) with ordinality r(entry,ordinal)),'[]'::jsonb));
  end if;
  result:=jsonb_set(result,'{job,context}',context);
  select * into policy from hq_private.public_retail_tasks where task_id=j.task_id;
  if policy.task_id is null then return result; end if;
  if policy.trial_id is not null then
    select * into t from hq_private.workforce_trials where id=policy.trial_id;
    context:=jsonb_set(context,'{supervisedTrial}',coalesce(context->'supervisedTrial','{}'::jsonb)||jsonb_build_object(
      'scope','public-retail-tool-trial-v1','toolPolicyId','exa-public-retail-discovery-v1','category',policy.category));
  end if;
  if j.agent_id='AG-RES-002' and j.kind in ('task-start','task-work') then
    binding:=hq_private.workforce_agent_binding_digest(j.agent_id);
    if binding is distinct from policy.binding_digest or (policy.trial_id is null and not hq_private.public_retail_qualified(j.agent_id))
      or (policy.trial_id is not null and (t.status<>'active' or t.expires_at<=clock_timestamp() or t.binding_digest is distinct from binding)) then
      return hq_private.workforce_block_claim(j,'public-discovery-binding-stale'); end if;
    if j.kind='task-work' then
      context:=context||jsonb_build_object('publicDiscoveryPermit',jsonb_build_object('version',1,
        'policyId','exa-public-retail-discovery-v1','jobId',j.id,'agentId',j.agent_id,'bindingDigest',binding,'category',policy.category));
    end if;
  end if;
  context:=jsonb_set(context,'{task,attempt}',to_jsonb(j.attempt),true);
  context:=context||jsonb_build_object('publicDiscoveryEvidence',coalesce((select jsonb_agg(jsonb_build_object(
    'jobId',r.job_id,'artifactId',r.artifact_id,'artifactDigest',r.artifact_digest,'evidence',r.evidence))
    from hq_private.public_retail_receipts r where r.task_id=j.task_id and r.outcome='completed'),'[]'::jsonb));
  if octet_length(context::text)>245760 then raise exception 'HQ_DISCOVERY_CONTEXT_CAPACITY' using errcode='22023'; end if;
  return jsonb_set(result,'{job,context}',context);
end $$;

do $$ declare d text; c text; begin
d:=pg_get_functiondef('hq_private.begin_public_research_trial_base(text,text,uuid)'::regprocedure);
c:=replace(d,'FUNCTION hq_private.begin_public_research_trial_base(', 'FUNCTION hq_private.begin_public_retail_trial_base(');
if c=d then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if;
if position($old$public-research-tool-trial-v1$old$ in c)=0 then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if; c:=replace(c,$old$public-research-tool-trial-v1$old$,$new$public-retail-tool-trial-v1$new$);
if position($old$hq_private.public_discovery_qualified$old$ in c)=0 then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if; c:=replace(c,$old$hq_private.public_discovery_qualified$old$,$new$hq_private.public_retail_qualified$new$);
if position($old$generic New Cairo business objective$old$ in c)=0 then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if; c:=replace(c,$old$generic New Cairo business objective$old$,$new$generic New Cairo retail category objective$new$);
execute c;
end $$;

revoke all on function hq_private.begin_public_retail_trial_base(text,text,uuid) from public,anon,authenticated,service_role;

create function hq_private.begin_public_retail_trial(p_skill_file_id text,p_category text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); a hq_private.agent_roster; t hq_private.workforce_trials; result jsonb;
begin
  if uid is null or p_request_key is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_category is null or p_category not in ('clothing','footwear','homewares') then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
  if p_skill_file_id is null or p_skill_file_id !~ '^[A-Za-z0-9_-]{8,200}$' then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if not hq_private.public_retail_setup_ready() then raise exception 'HQ_RETAIL_CANONICAL_SETUP_REQUIRED' using errcode='55000'; end if;
  if not hq_private.trial_evaluator_ready('AG-HR-003') then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
  select * into a from hq_private.agent_roster where id='AG-RES-002' and enabled and model_tier='T1_WORKER'
    and department_key='research-market-intelligence' and manager_id='AG-RES-001';
  if a.id is null or not exists(select 1 from hq_private.agent_roster m where m.id=a.manager_id and m.enabled
    and m.model_tier='T2_HEAD' and m.department_key=a.department_key) then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
  select * into t from hq_private.workforce_trials where request_key=p_request_key;
  if found then
    if t.requested_by is distinct from uid or t.agent_id is distinct from a.id or t.skill_file_id is distinct from p_skill_file_id or t.purpose is distinct from 'public-retail-tool-trial-v1' or not exists(select 1 from hq_private.public_retail_tasks r where r.trial_id=t.id and r.category=p_category) then
      raise exception 'HQ_TRIAL_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return jsonb_build_object('accepted',true,'trialId',t.id,'taskId',t.task_id,'status',t.status,'headId',t.manager_id);
  end if;
  result:=hq_private.begin_public_retail_trial_base(a.id,p_skill_file_id,p_request_key);
  select * into t from hq_private.workforce_trials where id=(result->>'trialId')::uuid;
  if t.purpose is distinct from 'public-retail-tool-trial-v1' or t.binding_digest is distinct from hq_private.workforce_trial_binding_digest(a.id)
    then raise exception 'HQ_DISCOVERY_TRIAL_BINDING_INVALID'; end if;
  insert into hq_private.public_retail_tasks(task_id,agent_id,binding_digest,trial_id,category)
    values(t.task_id,a.id,t.binding_digest,t.id,p_category);
  return result;
end $$;

revoke all on function hq_private.begin_public_retail_trial(text,text,uuid) from public,anon,authenticated,service_role;

create function public.hq_begin_public_retail_trial(p_skill_file_id text,p_category text,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.begin_public_retail_trial(p_skill_file_id,p_category,p_request_key) $$;
revoke all on function public.hq_begin_public_retail_trial(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.begin_public_retail_trial(text,text,uuid),public.hq_begin_public_retail_trial(text,text,uuid) to authenticated;

create function hq_private.validate_public_retail_evidence(p_job public.hq_agent_jobs,p_evidence jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare policy hq_private.public_retail_tasks; source jsonb; expected_keys text[]:=array['version','tool','server','name','eventId','jobId','agentId','bindingDigest','policyId','rawResultSha256','rawResultBytes','literalTextSha256','observedAt','queryId','sources','partial','wholePageVerified','truncated'];
begin
  select * into policy from hq_private.public_retail_tasks where task_id=p_job.task_id;
  -- Receipt authenticity stays bound to the immutable execution permit.
  -- Current-binding drift is settled BLOCKED by the atomic finish below.
  if policy.task_id is null or policy.agent_id is distinct from p_job.agent_id or p_job.kind<>'task-work' or p_job.attempt<>0
    or jsonb_typeof(p_evidence) is distinct from 'object' or octet_length(p_evidence::text)>36000
    or (select count(*) from jsonb_object_keys(p_evidence))<>cardinality(expected_keys)
    or exists(select 1 from jsonb_object_keys(p_evidence) k where k<>all(expected_keys))
    or p_evidence->'version' is distinct from '2'::jsonb or p_evidence->>'tool' is distinct from 'mcp'
    or p_evidence->>'server' is distinct from 'hq_public_discovery' or p_evidence->>'name' is distinct from 'public_business_discovery'
    or p_evidence->>'policyId' is distinct from 'exa-public-retail-discovery-v1'
    or p_evidence->>'queryId' is distinct from 'new-cairo-retail-'||policy.category||'-v1'
    or p_evidence->>'jobId' is distinct from p_job.id::text or p_evidence->>'agentId' is distinct from p_job.agent_id
    or p_evidence->>'bindingDigest' is distinct from policy.binding_digest
    or jsonb_typeof(p_evidence->'eventId') is distinct from 'string' or coalesce(p_evidence->>'eventId','') !~ '^[A-Za-z0-9_-]{1,200}$'
    or jsonb_typeof(p_evidence->'rawResultSha256') is distinct from 'string' or jsonb_typeof(p_evidence->'literalTextSha256') is distinct from 'string'
    or coalesce(p_evidence->>'rawResultSha256','') !~ '^[0-9a-f]{64}$'
    or coalesce(p_evidence->>'literalTextSha256','') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_evidence->'rawResultBytes') is distinct from 'number'
    or coalesce(p_evidence->>'rawResultBytes','') !~ '^[0-9]{1,5}$'
    or (p_evidence->>'rawResultBytes')::integer not between 1 and 32768
    or jsonb_typeof(p_evidence->'observedAt') is distinct from 'string' or coalesce(p_evidence->>'observedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
    or p_evidence->'partial' is distinct from 'true'::jsonb or p_evidence->'wholePageVerified' is distinct from 'false'::jsonb
    or jsonb_typeof(p_evidence->'truncated') is distinct from 'boolean'
    or jsonb_typeof(p_evidence->'sources') is distinct from 'array' or jsonb_array_length(p_evidence->'sources') not between 1 and 3
    or (select count(distinct value->>'url') from jsonb_array_elements(p_evidence->'sources'))<>jsonb_array_length(p_evidence->'sources') then
    raise exception 'HQ_DISCOVERY_EVIDENCE_INVALID' using errcode='22023'; end if;
  for source in select value from jsonb_array_elements(p_evidence->'sources') loop
  if jsonb_typeof(source) is distinct from 'object' or (select count(*) from jsonb_object_keys(source))<>4
    or exists(select 1 from jsonb_object_keys(source) k where k not in ('url','title','excerpt','excerptSha256'))
    or jsonb_typeof(source->'url') is distinct from 'string' or coalesce(source->>'url','') !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}(?::443)?(?:[/?][^[:cntrl:] @]*)?$'
    or source->>'url' ~* '^https://(?:localhost|[0-9.]+|[^/]*(?:\.local|\.localhost|\.internal))(?::443)?(?:/|\?|$)'
    or source->>'url' ~* '(?:[?&])(?:[^&=]*(?:token|secret|password|signature|credential|api.?key|authorization)|key|auth|code|sig|x-amz-[^=]*|x-goog-[^=]*)='
    or source->>'url' like '%#%' or octet_length(source->>'url')>500
    or jsonb_typeof(source->'title') is distinct from 'string' or octet_length(source->>'title')>240
    or jsonb_typeof(source->'excerpt') is distinct from 'string' or octet_length(source->>'excerpt') not between 1 and 4096
    or btrim(source->>'excerpt')='' or source->>'excerpt' ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]'
    or source->>'excerptSha256' is distinct from encode(extensions.digest(source->>'excerpt','sha256'),'hex') then
    raise exception 'HQ_DISCOVERY_EVIDENCE_INVALID' using errcode='22023'; end if;
  end loop;
end $$;

revoke all on function hq_private.validate_public_retail_evidence(public.hq_agent_jobs,jsonb) from public,anon,authenticated,service_role;

create function hq_private.public_retail_invocation_valid(p_evidence jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare protocol jsonb; params jsonb; config jsonb; server jsonb; policy jsonb:=p_evidence->'publicDiscoveryPolicy'; argv jsonb; cwd text; setting text;
begin
  protocol:=case when p_evidence->>'attestationLevel'='host-cli-preflight' then p_evidence->'invocation'->'plannedProtocol'
    else p_evidence->'invocation'->'protocol' end;
  argv:=case when p_evidence->>'attestationLevel'='host-cli-preflight' then p_evidence->'invocation'->'plannedArgv'
    else p_evidence->'invocation'->'argv' end;
  params:=case when p_evidence->>'attestationLevel'='host-cli-preflight' then protocol->'threadStart' else protocol->'threadStart'->'params' end;
  config:=params->'config'->'mcp_servers'; server:=config->'hq_public_discovery';
  cwd:=params->>'cwd';
  if jsonb_typeof(config) is distinct from 'object' or (select count(*) from jsonb_object_keys(config))<>1
    or jsonb_typeof(server) is distinct from 'object' or (select count(*) from jsonb_object_keys(server))<>7
    or exists(select 1 from jsonb_object_keys(server) k where k not in ('command','args','enabled','required','startup_timeout_sec','tool_timeout_sec','enabled_tools'))
    or coalesce(server->>'command','') !~ '^/[A-Za-z0-9_./-]+$'
    or coalesce(cwd,'') !~ '^/[A-Za-z0-9_./-]+$'
    or octet_length(server->>'command')>1024 or octet_length(cwd)>1024
    or server->'enabled' is distinct from 'true'::jsonb or server->'required' is distinct from 'true'::jsonb
    or server->'startup_timeout_sec' is distinct from '10'::jsonb or server->'tool_timeout_sec' is distinct from '25'::jsonb
    or server->'enabled_tools' is distinct from '["public_business_discovery"]'::jsonb
    or jsonb_typeof(server->'args') is distinct from 'array' or jsonb_array_length(server->'args')<>5
    or server->'args'->>0 is distinct from '--preserve-symlinks-main'
    or coalesce(server->'args'->>1,'') !~ '^/[A-Za-z0-9_./-]+/departmentWorkflow\.mjs$'
    or server->'args'->>2 is distinct from '--public-retail-discovery-mcp'
    or server->'args'->>3 is distinct from policy->>'category'
    or server->'args'->>4 is distinct from cwd||'/exa-discovery-budget'
    or jsonb_typeof(policy) is distinct from 'object' or (select count(*) from jsonb_object_keys(policy))<>7
    or exists(select 1 from jsonb_object_keys(policy) k where k not in ('policyId','server','tool','nodeExecutable','moduleSha256','budget','category'))
    or policy->>'policyId' is distinct from 'exa-public-retail-discovery-v1'
    or policy->>'server' is distinct from 'hq_public_discovery' or policy->>'tool' is distinct from 'public_business_discovery'
    or policy->>'nodeExecutable' is distinct from server->>'command'
    or coalesce(policy->>'moduleSha256','') !~ '^[0-9a-f]{64}$'
    or coalesce(policy->>'category','') not in ('clothing','footwear','homewares')
    or policy->>'budget' is distinct from 'single-wx-before-connect'
    or jsonb_typeof(argv) is distinct from 'array' then return false; end if;
  setting:='mcp_servers={hq_public_discovery={command='||(server->'command')::text||',args='||replace((server->'args')::text,', ',',')||',enabled=true,required=true,startup_timeout_sec=10,tool_timeout_sec=25,enabled_tools=["public_business_discovery"]}}';
  return (select count(*)=1 and bool_and(a.value#>>'{}'=setting) from jsonb_array_elements(argv) a(value)
    where a.value#>>'{}' like 'mcp_servers=%');
end $$;

revoke all on function hq_private.public_retail_invocation_valid(jsonb) from public,anon,authenticated,service_role;

create function hq_private.public_retail_policy_selected(p_reply text) returns boolean
language plpgsql immutable set search_path='' as $$ declare body jsonb; begin
 body:=p_reply::jsonb; return coalesce(jsonb_typeof(body)='object' and (body->>'publicDiscoveryPolicy'='exa-public-retail-discovery-v1' or body ? 'publicDiscoveryCategory'),false);
exception when others then return false; end $$;

revoke all on function hq_private.public_retail_policy_selected(text) from public,anon,authenticated,service_role;

do $$ declare d text:=pg_get_functiondef('hq_private.worker_finish_before_meetings(uuid,uuid,uuid,text,text)'::regprocedure); at integer;
begin
  at:=position('if v_job.result_digest is not null then' in d);
  if at=0 then raise exception 'HQ_DISCOVERY_LEGACY_FINISH_SOURCE_MISMATCH'; end if;
  d:=substring(d from 1 for at-1)||$guard$
  if (exists(select 1 from hq_private.public_retail_tasks p join public.hq_agent_jobs j on j.task_id=p.task_id
    where j.id=p_job_id and j.kind='task-work' and j.agent_id=p.agent_id)
    or exists(select 1 from public.hq_agent_jobs j where j.id=p_job_id and j.kind='task-ack'
      and hq_private.public_retail_policy_selected(p_reply)))
    and not exists(select 1 from hq_private.public_retail_finish_requests f
      where f.job_id=p_job_id and f.worker_id=p_worker_id and f.transaction_id=txid_current()) then
    raise exception 'HQ_DISCOVERY_ATOMIC_FINISH_REQUIRED' using errcode='55000'; end if;
  $guard$||substring(d from at);
  execute d;
end $$;

do $$ declare d text:=pg_get_functiondef('hq_private.worker_finish_v2(uuid,uuid,uuid,text,text,jsonb)'::regprocedure); c text;
begin
 c:=replace(d,'if not exists(select 1 from hq_private.public_discovery_tasks where task_id=j.task_id) and p_error',
  'if not exists(select 1 from hq_private.public_discovery_tasks where task_id=j.task_id) and not exists(select 1 from hq_private.public_retail_tasks where task_id=j.task_id) and p_error');
 if c=d then raise exception 'HQ_RETAIL_NATIVE_SOURCE_MISMATCH'; end if; execute c;
end $$;

create or replace function hq_private.worker_finish_public_retail(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb,p_trial_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; t hq_private.workforce_trials; policy hq_private.public_retail_tasks;
  a public.hq_task_artifacts; old_receipt hq_private.public_retail_receipts; prior_delivery hq_private.public_retail_deliveries;
  input_digest text; result jsonb; mcp jsonb; native jsonb; receipt uuid; ack_body jsonb;
  binding_stale boolean:=false; selecting boolean:=false; selection_binding text; finish_reply text:=p_reply; finish_error text:=p_error;
begin
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id for update;
  if j.id is null or j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token then raise exception 'HQ_LEASE_LOST' using errcode='42501'; end if;
  select * into policy from hq_private.public_retail_tasks where task_id=j.task_id;
  input_digest:=encode(extensions.digest(jsonb_build_array(p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence)::text,'sha256'),'hex');
  select * into prior_delivery from hq_private.public_retail_deliveries where job_id=j.id;
  if found then
    if prior_delivery.input_digest is distinct from input_digest or j.status not in ('completed','blocked')
      or j.result_digest is distinct from prior_delivery.job_result_digest then
      raise exception 'HQ_DISCOVERY_DELIVERY_CONFLICT' using errcode='PT409'; end if;
    return prior_delivery.result;
  end if;
  binding_stale:=policy.task_id is not null and j.kind='task-work' and j.agent_id=policy.agent_id
    and policy.binding_digest is distinct from hq_private.workforce_agent_binding_digest(j.agent_id);
  if binding_stale then
    -- Discard stale output without promoting old-bound model/host evidence as
    -- current. Preserve authentic task-bound tool observations as BLOCKED only.
    finish_reply:=''; finish_error:='public-discovery-binding-stale';
  end if;
  if p_error is null and j.kind in ('task-ack','task-start','task-route','conversation-intake') then
    begin ack_body:=p_reply::jsonb; exception when others then ack_body:=null; end;
    if jsonb_typeof(ack_body)='object' and (ack_body ? 'publicDiscoveryPolicy' or ack_body ? 'publicDiscoveryCategory') then
      if j.kind<>'task-ack' or j.agent_id<>'AG-RES-001' or j.attempt<>0
        or exists(select 1 from hq_private.workforce_trials where task_id=j.task_id)
        or policy.task_id is not null
        or ack_body->'publicDiscoveryPolicy' is distinct from '"exa-public-retail-discovery-v1"'::jsonb
        or ack_body->'delegateId' is distinct from '"AG-RES-002"'::jsonb
        or ack_body->>'publicDiscoveryCategory' not in ('clothing','footwear','homewares')
        or ack_body->'publicDiscoveryCategory' is null or jsonb_typeof(ack_body->'publicDiscoveryCategory')<>'string'
        or (select count(*) from jsonb_object_keys(ack_body))<>4
        or exists(select 1 from jsonb_object_keys(ack_body) k where k not in ('message','delegateId','publicDiscoveryPolicy','publicDiscoveryCategory'))
        or not exists(select 1 from public.hq_agent_jobs parent where parent.id=j.depends_on and parent.task_id=j.task_id
          and parent.founder_user_id=j.founder_user_id and parent.conversation_id=j.conversation_id
          and parent.founder_message_id=j.founder_message_id and parent.agent_id='AG-CEO-001'
          and parent.kind in ('task-route','conversation-intake') and parent.status='completed') then
        raise exception 'HQ_DISCOVERY_SELECTION_INVALID' using errcode='22023'; end if;
      selecting:=true;
      select hq_private.workforce_agent_binding_digest(candidate.id) into selection_binding
        from hq_private.agent_roster candidate join hq_private.agent_roster head on head.id=candidate.manager_id
        where candidate.id='AG-RES-002' and candidate.enabled and candidate.model_tier='T1_WORKER' and candidate.manager_id=j.agent_id
          and candidate.department_key='research-market-intelligence' and head.enabled and head.model_tier='T2_HEAD'
          and head.department_key=candidate.department_key and hq_private.workforce_agent_assignable(head.id)
          and hq_private.public_retail_qualified(candidate.id);
      if selection_binding is null then
        -- A once-valid scoped reply can settle as BLOCKED after source drift.
        -- Never downgrade it silently into an ordinary task or strand replay.
        finish_reply:=''; finish_error:='public-discovery-binding-stale';
      end if;
    end if;
  end if;
  if jsonb_typeof(p_evidence) is distinct from 'array' or octet_length(p_evidence::text)>40000 then raise exception 'HQ_DISCOVERY_EVIDENCE_INVALID' using errcode='22023'; end if;
  if (select count(*) from jsonb_array_elements(p_evidence) e where e->>'tool'='mcp')>1 then raise exception 'HQ_DISCOVERY_EVIDENCE_INVALID' using errcode='22023'; end if;
  select e into mcp from jsonb_array_elements(p_evidence) e where e->>'tool'='mcp';
  select coalesce(jsonb_agg(e),'[]'::jsonb) into native from jsonb_array_elements(p_evidence) e where e->>'tool' is distinct from 'mcp';
  if mcp is not null then perform hq_private.validate_public_retail_evidence(j,mcp); end if;
  if policy.task_id is not null and j.agent_id=policy.agent_id and j.kind='task-work' and j.attempt=0 and p_error is null and mcp is null then
    raise exception 'HQ_DISCOVERY_EVIDENCE_REQUIRED' using errcode='22023'; end if;
  if policy.task_id is not null and native<>'[]'::jsonb then raise exception 'HQ_DISCOVERY_NATIVE_EVIDENCE_FORBIDDEN' using errcode='22023'; end if;
  if selecting or (policy.task_id is not null and j.kind='task-work' and j.agent_id=policy.agent_id) then
    insert into hq_private.public_retail_finish_requests values(j.id,p_worker_id,txid_current());
    insert into hq_private.public_discovery_finish_requests values(j.id,p_worker_id,txid_current()); end if;
  if binding_stale then
    result:=hq_private.worker_finish_v3(p_job_id,p_lease_token,p_worker_id,finish_reply,finish_error,native,null)
      ||jsonb_build_object('discarded',true,'bindingStale',true);
  elsif policy.trial_id is not null and j.kind='task-work' and j.agent_id=policy.agent_id then
    select * into t from hq_private.workforce_trials where id=policy.trial_id;
    if p_error is null and p_trial_evidence is null then raise exception 'HQ_TRIAL_HOST_EXECUTION_REQUIRED' using errcode='22023'; end if;
    result:=hq_private.worker_finish_v3(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,native,p_model_evidence);
  else
    result:=hq_private.worker_finish_v4_before_public_discovery(p_job_id,p_lease_token,p_worker_id,finish_reply,finish_error,native,p_model_evidence,p_trial_evidence);
  end if;
  select * into j from public.hq_agent_jobs where id=p_job_id;
  if coalesce((result->>'discarded')::boolean,false) then
    delete from hq_private.public_retail_finish_requests where job_id=j.id and transaction_id=txid_current();
    delete from hq_private.public_discovery_finish_requests where job_id=j.id and transaction_id=txid_current();
    -- Retain actual tool observations as BLOCKED job evidence only; canceled
    -- work creates no artifact, successful host proof or qualification.
    if mcp is not null then
      insert into hq_private.public_retail_receipts(job_id,task_id,artifact_id,artifact_digest,agent_id,binding_digest,evidence,outcome)
        values(j.id,j.task_id,null,null,j.agent_id,policy.binding_digest,mcp,'blocked');
      result:=result||jsonb_build_object('publicDiscoveryReceiptAccepted',true);
    end if;
    if selecting or (policy.task_id is not null and j.kind='task-work' and j.agent_id=policy.agent_id) then
      insert into hq_private.public_retail_deliveries values(j.id,input_digest,j.result_digest,result); end if;
    return result; end if;
  if selecting and j.status='completed' then
    insert into hq_private.public_retail_tasks(task_id,agent_id,binding_digest,category)
      values(j.task_id,'AG-RES-002',selection_binding,ack_body->>'publicDiscoveryCategory');
    result:=result||jsonb_build_object('publicDiscoveryPolicyAccepted',true);
  elsif selecting then result:=result||jsonb_build_object('publicDiscoveryPolicyAccepted',false); end if;
  select * into a from public.hq_task_artifacts where job_id=j.id;
  if mcp is not null then
    select * into old_receipt from hq_private.public_retail_receipts where job_id=j.id;
    if found then
      if old_receipt.evidence is distinct from mcp or old_receipt.artifact_id is distinct from a.id
        or old_receipt.artifact_digest is distinct from a.digest or old_receipt.outcome is distinct from j.status then
        raise exception 'HQ_DISCOVERY_RECEIPT_CONFLICT' using errcode='PT409'; end if;
    else
      insert into hq_private.public_retail_receipts(job_id,task_id,artifact_id,artifact_digest,agent_id,binding_digest,evidence,outcome)
        values(j.id,j.task_id,a.id,a.digest,j.agent_id,policy.binding_digest,mcp,j.status);
    end if;
    result:=result||jsonb_build_object('publicDiscoveryReceiptAccepted',true);
  end if;
  if t.id is not null and p_trial_evidence is not null then
    receipt:=hq_private.record_trial_host_execution(t.id,j.id,a.id,p_trial_evidence,'worker-job:'||j.id::text);
    result:=result||jsonb_build_object('trialReceiptAccepted',true,'trialReceiptId',receipt);
  end if;
  delete from hq_private.public_retail_finish_requests where job_id=j.id and transaction_id=txid_current();
    delete from hq_private.public_discovery_finish_requests where job_id=j.id and transaction_id=txid_current();
  if selecting or (policy.task_id is not null and j.kind='task-work' and j.agent_id=policy.agent_id) then
    insert into hq_private.public_retail_deliveries values(j.id,input_digest,j.result_digest,result); end if;
  return result;
end $$;

revoke all on function hq_private.worker_finish_public_retail(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;

do $$ declare d text; c text; begin
d:=pg_get_functiondef('hq_private.worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)'::regprocedure);
c:=replace(d,'FUNCTION hq_private.worker_finish_v4(', 'FUNCTION hq_private.worker_finish_v4_before_public_retail(');
if c=d then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if;
execute c;
end $$;

revoke all on function hq_private.worker_finish_v4_before_public_retail(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function hq_private.worker_finish_v4(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb,p_trial_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if hq_private.public_retail_policy_selected(p_reply) or exists(select 1 from hq_private.public_retail_tasks p join public.hq_agent_jobs j on j.task_id=p.task_id where j.id=p_job_id) then
  return hq_private.worker_finish_public_retail(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence);
 end if;
 return hq_private.worker_finish_v4_before_public_retail(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence);
end $$;

create function hq_private.issue_public_retail_qualification(p_trial_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t hq_private.workforce_trials;
begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into t from hq_private.workforce_trials where id=p_trial_id;
  if t.id is null or t.purpose<>'public-retail-tool-trial-v1' or t.agent_id<>'AG-RES-002' or t.manager_id<>'AG-RES-001'
    or t.requested_by is distinct from uid or t.binding_digest is distinct from hq_private.workforce_trial_binding_digest(t.agent_id)
    or t.reviewer_binding_digest is distinct from hq_private.workforce_agent_binding_digest('AG-HR-003')
    or not hq_private.trial_evaluator_ready('AG-HR-003')
    or not hq_private.public_retail_trial_source_valid(t.id,t.artifact_id) then
    raise exception 'HQ_TRIAL_EVIDENCE_INCOMPLETE' using errcode='22023'; end if;
  return hq_private.issue_public_research_qualification_base(p_trial_id);
end $$;

revoke all on function hq_private.issue_public_retail_qualification(uuid) from public,anon,authenticated,service_role;

create function public.hq_issue_public_retail_qualification(p_trial_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.issue_public_retail_qualification(p_trial_id) $$;
revoke all on function public.hq_issue_public_retail_qualification(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.issue_public_retail_qualification(uuid),public.hq_issue_public_retail_qualification(uuid) to authenticated;

do $$ declare d text:=pg_get_functiondef('hq_private.record_trial_host_execution(uuid,uuid,uuid,jsonb,text)'::regprocedure); c text;
begin
 c:=replace(d,$old$v_trial.purpose='public-research-tool-trial-v1'$old$,$new$v_trial.purpose in ('public-research-tool-trial-v1','public-retail-tool-trial-v1')$new$);
 c:=replace(c,'not hq_private.public_discovery_invocation_valid(p_evidence)',
  'not case when v_trial.purpose=''public-retail-tool-trial-v1'' then hq_private.public_retail_invocation_valid(p_evidence) else hq_private.public_discovery_invocation_valid(p_evidence) end');
 c:=replace(c,'from hq_private.public_discovery_receipts r',
  'from (select * from hq_private.public_discovery_receipts union all select * from hq_private.public_retail_receipts) r');
 c:=replace(c,'not hq_private.public_discovery_trial_source_valid(v_trial.id,v_artifact.id)',
  'not case when v_trial.purpose=''public-retail-tool-trial-v1'' then hq_private.public_retail_trial_source_valid(v_trial.id,v_artifact.id) else hq_private.public_discovery_trial_source_valid(v_trial.id,v_artifact.id) end');
 if c=d then raise exception 'HQ_RETAIL_HOST_SOURCE_MISMATCH'; end if; execute c;
end $$;
-- Future host declarations only. The module hash is not provider attestation.
create table hq_private.trial_public_policy_receipts(
 host_execution_id uuid primary key references hq_private.workforce_trial_host_execution_receipts(id),
 trial_id uuid not null references hq_private.workforce_trials(id), job_id uuid unique not null references public.hq_agent_jobs(id),
 artifact_id uuid references public.hq_task_artifacts(id), artifact_digest text check(artifact_digest ~ '^[0-9a-f]{64}$'),
 evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
 policy_id text not null check(policy_id in ('exa-public-business-discovery-v1','exa-public-retail-discovery-v1')),
 module_sha256 text not null check(module_sha256 ~ '^[0-9a-f]{64}$'), policy_metadata jsonb not null,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table hq_private.trial_public_policy_receipts enable row level security;
revoke all on hq_private.trial_public_policy_receipts from public,anon,authenticated,service_role;
create trigger hq_trial_public_policy_receipt_immutable before update or delete on hq_private.trial_public_policy_receipts for each row execute function hq_private.immutable_record();

do $$ declare d text; c text; begin
d:=pg_get_functiondef('hq_private.record_trial_host_execution(uuid,uuid,uuid,jsonb,text)'::regprocedure);
c:=replace(d,'FUNCTION hq_private.record_trial_host_execution(', 'FUNCTION hq_private.record_trial_host_execution_before_public_policy(');
if c=d then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if;
execute c;
end $$;

revoke all on function hq_private.record_trial_host_execution_before_public_policy(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;

create or replace function hq_private.record_trial_host_execution(p_trial_id uuid,p_worker_job_id uuid,p_artifact_id uuid,p_evidence jsonb,p_evidence_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare receipt uuid; metadata jsonb:=p_evidence->'publicDiscoveryPolicy'; t hq_private.workforce_trials; r hq_private.trial_public_policy_receipts;
 expected_keys text[]:=array['policyId','server','tool','nodeExecutable','moduleSha256','budget']; category text; had_receipt boolean; prior_receipt uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
 select id into prior_receipt from hq_private.workforce_trial_host_execution_receipts where worker_job_id=p_worker_job_id for update;
 had_receipt:=found;
 select * into t from hq_private.workforce_trials where id=p_trial_id;
 if metadata is not null then
  if t.purpose='public-retail-tool-trial-v1' then
   expected_keys:=array_append(expected_keys,'category'); select p.category into category from hq_private.public_retail_tasks p where p.trial_id=t.id;
  end if;
  if t.purpose not in ('public-research-tool-trial-v1','public-retail-tool-trial-v1')
   or jsonb_typeof(metadata) is distinct from 'object' or (select count(*) from jsonb_object_keys(metadata))<>cardinality(expected_keys)
   or exists(select 1 from jsonb_object_keys(metadata) k where k<>all(expected_keys))
   or metadata->>'policyId' is distinct from (case when t.purpose='public-retail-tool-trial-v1' then 'exa-public-retail-discovery-v1' else 'exa-public-business-discovery-v1' end)
   or metadata->>'server' is distinct from 'hq_public_discovery' or metadata->>'tool' is distinct from 'public_business_discovery'
   or metadata->>'budget' is distinct from 'single-wx-before-connect'
   or jsonb_typeof(metadata->'moduleSha256') is distinct from 'string' or jsonb_typeof(metadata->'nodeExecutable') is distinct from 'string'
   or coalesce(metadata->>'moduleSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(metadata->>'nodeExecutable','') !~ '^/[A-Za-z0-9_./-]+$' or octet_length(metadata->>'nodeExecutable')>1024
   or (t.purpose='public-retail-tool-trial-v1' and (jsonb_typeof(metadata->'category') is distinct from 'string' or metadata->>'category' is distinct from category))
   then raise exception 'HQ_PUBLIC_POLICY_METADATA_INVALID' using errcode='22023'; end if;
 end if;
 receipt:=hq_private.record_trial_host_execution_before_public_policy(p_trial_id,p_worker_job_id,p_artifact_id,p_evidence,p_evidence_reference);
 if metadata is not null then
  select * into r from hq_private.trial_public_policy_receipts where host_execution_id=receipt;
  if found then
   if r.policy_metadata is distinct from metadata or r.evidence_digest is distinct from encode(extensions.digest(p_evidence::text,'sha256'),'hex') then
    raise exception 'HQ_PUBLIC_POLICY_RECEIPT_CONFLICT' using errcode='PT409'; end if;
  elsif not had_receipt then
   -- Historical replay never manufactures a missing policy/module declaration.
   insert into hq_private.trial_public_policy_receipts(host_execution_id,trial_id,job_id,artifact_id,artifact_digest,evidence_digest,policy_id,module_sha256,policy_metadata)
    values(receipt,t.id,p_worker_job_id,p_artifact_id,p_evidence->>'artifactDigest',encode(extensions.digest(p_evidence::text,'sha256'),'hex'),metadata->>'policyId',metadata->>'moduleSha256',metadata);
  end if;
 end if;
 return receipt;
end $$;

do $$ declare d text; c text; begin
d:=pg_get_functiondef('hq_private.worker_release_status(uuid)'::regprocedure);
c:=replace(d,'FUNCTION hq_private.worker_release_status(', 'FUNCTION hq_private.worker_release_status_before_public_retail(');
if c=d then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if;
execute c;
end $$;

revoke all on function hq_private.worker_release_status_before_public_retail(uuid) from public,anon,authenticated,service_role;

create or replace function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare old_status jsonb:=hq_private.worker_release_status_before_public_retail(p_worker_id);
begin
 if to_regprocedure('hq_private.validate_public_retail_evidence(public.hq_agent_jobs,jsonb)') is null
  or to_regprocedure('hq_private.public_retail_invocation_valid(jsonb)') is null then
  return old_status||jsonb_build_object('publicRetail',null); end if;
 return old_status||jsonb_build_object('publicRetail',jsonb_build_object('version',1,'policyId','exa-public-retail-discovery-v1',
  'trialPurpose','public-retail-tool-trial-v1','receiptVersion',2,'categories',jsonb_build_array('clothing','footwear','homewares')));
end $$;

do $$ declare d text; c text; begin
d:=pg_get_functiondef('hq_private.workforce_trial_status()'::regprocedure);
c:=replace(d,'FUNCTION hq_private.workforce_trial_status(', 'FUNCTION hq_private.workforce_trial_status_before_public_retail(');
if c=d then raise exception 'HQ_RETAIL_SOURCE_MISMATCH'; end if;
execute c;
end $$;

revoke all on function hq_private.workforce_trial_status_before_public_retail() from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_trial_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); result jsonb; a hq_private.agent_roster; m hq_private.agent_roster;
  t hq_private.workforce_trials; skill_id text; qualified boolean:=false; eligible boolean:=false;
  binding_current boolean:=false; review_complete boolean:=false; reviewer_ready boolean:=false; research jsonb;
begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  result:=hq_private.workforce_trial_status_before_public_retail();
  select * into a from hq_private.agent_roster where id='AG-RES-002' and enabled;
  if a.id is null then return result; end if;
  select * into m from hq_private.agent_roster where id=a.manager_id and enabled;
  select skill.value into skill_id from jsonb_array_elements_text(a.skill_file_ids) skill(value)
    join hq_private.brain_files f on f.file_id=skill.value and f.in_scope and not f.trashed
      and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.source_version is not null
    order by skill.value limit 1;
  qualified:=coalesce(hq_private.public_retail_qualified(a.id),false);
  reviewer_ready:=hq_private.trial_evaluator_ready('AG-HR-003') and exists(select 1 from hq_private.agent_roster iris
    join hq_private.brain_files profile on profile.file_id=iris.profile_file_id
    where iris.id='AG-HR-003' and iris.enabled and hq_private.workforce_agent_assignable(iris.id)
      and profile.in_scope and not profile.trashed and profile.source_version is not null
      and profile.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8');
  eligible:=hq_private.public_retail_setup_ready() and coalesce(a.model_tier='T1_WORKER' and a.department_key='research-market-intelligence'
    and a.manager_id='AG-RES-001' and m.model_tier='T2_HEAD' and m.department_key=a.department_key
    and hq_private.workforce_agent_assignable(m.id) and reviewer_ready
    and a.lifecycle ~* '(configured|trial|pending|active)'
    and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
    and jsonb_array_length(a.skill_file_ids) between 1 and 10 and skill_id is not null
    and exists(select 1 from hq_private.brain_files p where p.file_id=a.profile_file_id
      and p.in_scope and not p.trashed and p.source_version is not null)
    and not exists(select 1 from hq_private.workforce_trials active_trial where active_trial.agent_id=a.id
      and active_trial.status='active' and active_trial.expires_at>clock_timestamp()) and not qualified,false);
  select * into t from hq_private.workforce_trials where agent_id=a.id and requested_by=uid
    and purpose='public-retail-tool-trial-v1' order by created_at desc,id desc limit 1;
  binding_current:=coalesce(t.id is not null and t.binding_digest=hq_private.workforce_trial_binding_digest(a.id)
    and t.reviewer_binding_digest=hq_private.workforce_agent_binding_digest('AG-HR-003'),false);
  -- Mirror the existing issuance prerequisites conservatively. In particular,
  -- a passed label alone is neither an independent review nor host evidence.
  review_complete:=coalesce(binding_current and t.status='passed' and t.completed_at<=t.expires_at
    and a.model_tier='T1_WORKER' and a.manager_id='AG-RES-001' and m.id='AG-RES-001'
    and m.model_tier='T2_HEAD' and m.department_key=a.department_key
    and hq_private.workforce_agent_assignable(m.id)
    and a.lifecycle ~* '(configured|trial|pending|active)'
    and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
    and reviewer_ready
    and hq_private.public_retail_trial_source_valid(t.id,t.artifact_id)
    and exists(select 1 from public.hq_business_tasks task
      join public.hq_task_artifacts artifact on artifact.id=t.artifact_id and artifact.task_id=task.id and artifact.agent_id=a.id
      join public.hq_agent_jobs review on review.id=t.review_job_id and review.task_id=task.id
        and review.kind='ceo-review' and review.agent_id='AG-HR-003' and review.status='completed'
        and review.result_text::jsonb->'accepted'='true'::jsonb
      join public.hq_agent_jobs head_review on head_review.id=review.depends_on and head_review.task_id=task.id
        and head_review.kind='head-review' and head_review.agent_id='AG-RES-001' and head_review.status='completed'
        and head_review.result_text::jsonb->'accepted'='true'::jsonb
      join hq_private.workforce_trial_host_execution_receipts execution on execution.trial_id=t.id
        and execution.agent_id=a.id and execution.artifact_id=artifact.id and execution.artifact_digest=artifact.digest
        and execution.outcome='completed' and execution.provider_served_model='unknown'
        and execution.attestation_level='host-returned-resolution'
        and execution.configured_model=a.model and execution.launch_model=a.model
        and execution.configured_effort=a.effort and execution.launch_effort=a.effort
        and execution.host_returned_model=a.model and execution.host_returned_effort=a.effort
        and execution.host_returned_thread_id=execution.thread_id
      where task.id=t.task_id and task.founder_user_id=uid and task.status='completed'
        and exists(select 1 from public.hq_agent_jobs report where report.task_id=task.id and report.kind='task-report' and report.status='completed')
        and exists(select 1 from public.hq_agent_jobs learning where learning.task_id=task.id and learning.kind='lesson-extract'
          and learning.status='blocked' and learning.error='trial-learning-disabled')),false);
  research:=jsonb_build_object('skillFileId',skill_id,'eligible',eligible,'qualified',qualified,
    'trialId',t.id,'status',t.status,'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),
    'reviewComplete',review_complete,'bindingCurrent',binding_current,'taskId',t.task_id,'categories',jsonb_build_array('clothing','footwear','homewares'),'setupRequired',not hq_private.public_retail_setup_ready(),'lastCategory',(select r.category from hq_private.public_retail_tasks r where r.trial_id=t.id));
  return coalesce((select jsonb_agg(case when row->>'agentId'='AG-RES-002'
    then row||jsonb_build_object('publicRetail',research) else row end order by ordinal)
    from jsonb_array_elements(result) with ordinality entries(row,ordinal)),'[]'::jsonb);
end $$;

commit;
