-- Trial-only context continuity. No task/result/qualification history is edited.
begin;
set local lock_timeout='10s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

-- Keep the existing role, qualification, model and selected-skill enrichment.
-- Copy the old implementation, then replace the existing entrypoint in place.
-- Its OID must stay stable for already prepared/cached claim callers.
do $$
declare v_definition text:=pg_get_functiondef('hq_private.workforce_enrich_claim(jsonb)'::regprocedure); v_copy text;
begin
  v_copy:=replace(v_definition,'FUNCTION hq_private.workforce_enrich_claim(v jsonb)',
    'FUNCTION hq_private.workforce_enrich_claim_before_trial_packet(v jsonb)');
  if v_copy=v_definition or to_regprocedure('hq_private.workforce_enrich_claim_before_trial_packet(jsonb)') is not null
    then raise exception 'HQ_TRIAL_CONTEXT_SOURCE_MISMATCH'; end if;
  execute v_copy;
end $$;
revoke all on function hq_private.workforce_enrich_claim_before_trial_packet(jsonb) from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_result jsonb:=hq_private.workforce_enrich_claim_before_trial_packet(v);
  v_job jsonb; v_context jsonb; v_trial hq_private.workforce_trials;
  v_agent hq_private.agent_roster; v_profile hq_private.brain_files; v_skill hq_private.brain_files;
  v_files jsonb; v_packet jsonb; v_assignments jsonb; v_corrections jsonb;
begin
  v_job:=v_result->'job';
  if v_job is null or jsonb_typeof(v_job)<>'object' then return v_result; end if;
  v_context:=v_job->'context';
  if v_context->'supervisedTrial'->>'id' is null then return v_result; end if;
  select * into v_trial from hq_private.workforce_trials
    where task_id=(v_context->'task'->>'id')::uuid and id=(v_context->'supervisedTrial'->>'id')::uuid;
  select * into v_agent from hq_private.agent_roster where id=v_trial.agent_id and enabled;
  select * into v_profile from hq_private.brain_files where file_id=v_agent.profile_file_id;
  select * into v_skill from hq_private.brain_files where file_id=v_trial.skill_file_id;
  if v_trial.id is null or v_trial.status not in ('active','passed')
    or (v_trial.status='active' and v_trial.expires_at<=clock_timestamp())
    or v_agent.id is null or v_trial.binding_digest is distinct from hq_private.workforce_trial_binding_digest(v_agent.id)
    or v_profile.source_version is distinct from v_trial.profile_source_version
    or v_skill.source_version is distinct from v_trial.skill_source_version
    or v_profile.root_id is distinct from '1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
    or v_skill.root_id is distinct from v_profile.root_id
    or not coalesce(v_profile.in_scope and not v_profile.trashed and v_skill.in_scope and not v_skill.trashed,false)
    or v_job->>'agent_id' not in ('AG-CEO-001','AG-HR-003',v_trial.agent_id,v_trial.manager_id)
    or v_context->>'mode' not in ('task-route','task-ack','trial-start','worker-trial','head-review','ceo-review','task-report')
    then raise exception 'HQ_TRIAL_CONTEXT_INVALID' using errcode='22023'; end if;

  -- Give the scoping head and all later stages the same exact hire profile and
  -- selected skill, in addition to their existing authorized role documents.
  select jsonb_agg(jsonb_build_object('id',id) order by id) into v_files from (
    select distinct f->>'id' id from jsonb_array_elements(v_context->'brain_files') f
      where f->>'id' not in (select jsonb_array_elements_text(v_agent.skill_file_ids))
        or f->>'id'=v_trial.skill_file_id
        or exists(select 1 from hq_private.agent_roster actor where actor.id=v_job->>'agent_id'
          and actor.skill_file_ids ? (f->>'id'))
    union select v_agent.profile_file_id union select v_trial.skill_file_id
  ) files;
  if jsonb_array_length(v_files)>18 then raise exception 'HQ_TRIAL_CONTEXT_CAPACITY' using errcode='22023'; end if;

  -- These are full validated result fields, not the truncated immediate
  -- predecessor or an acknowledgment's paraphrase. Keep rejected findings as
  -- rejected findings; no result, attempt, task or trial status is changed.
  select coalesce(jsonb_agg(jsonb_build_object('jobId',j.id,'attempt',j.attempt,
    'message',j.result_text::jsonb->>'message') order by j.created_at,j.id),'[]'::jsonb)
    into v_assignments from public.hq_agent_jobs j
    where j.task_id=v_trial.task_id and j.founder_user_id=v_trial.requested_by
      and j.agent_id=v_trial.manager_id and j.kind='task-ack' and j.status='completed'
      and j.result_text::jsonb->>'delegateId'=v_trial.agent_id;
  select coalesce(jsonb_agg(jsonb_build_object('jobId',j.id,'agentId',j.agent_id,'kind',j.kind,
    'attempt',j.attempt,'accepted',false,'summary',j.result_text::jsonb->>'summary',
    'artifactDigest',j.result_text::jsonb->>'artifactDigest') order by j.created_at,j.id),'[]'::jsonb)
    into v_corrections from public.hq_agent_jobs j
    where j.task_id=v_trial.task_id and j.founder_user_id=v_trial.requested_by
      and ((j.kind='head-review' and j.agent_id=v_trial.manager_id) or (j.kind='ceo-review' and j.agent_id='AG-HR-003'))
      and j.status='completed' and j.result_text::jsonb->>'accepted'='false';
  if jsonb_array_length(v_assignments)>3 or jsonb_array_length(v_corrections)>3
    then raise exception 'HQ_TRIAL_CONTEXT_CAPACITY' using errcode='22023'; end if;
  v_packet:=jsonb_build_object('version',1,'trialId',v_trial.id,'taskId',v_trial.task_id,
    'agentId',v_trial.agent_id,'managerId',v_trial.manager_id,'skillFileId',v_trial.skill_file_id,
    'bindingDigest',v_trial.binding_digest,
    'profile',jsonb_build_object('fileId',v_agent.profile_file_id,'sourceVersion',v_trial.profile_source_version),
    'skill',jsonb_build_object('fileId',v_trial.skill_file_id,'sourceVersion',v_trial.skill_source_version),
    'task',jsonb_build_object('title',v_context->'task'->'title','brief',v_context->'task'->'brief',
      'acceptance',v_context->'task'->'acceptance'),
    'headAssignments',v_assignments,'rejectedReviews',v_corrections);
  if octet_length(v_packet::text)>98304 then raise exception 'HQ_TRIAL_CONTEXT_CAPACITY' using errcode='22023'; end if;
  v_context:=jsonb_set(v_context,'{brain_files}',v_files);
  if v_context->'assignee'->>'id'=v_trial.agent_id then
    v_context:=jsonb_set(v_context,'{assignee,skillFileIds}',jsonb_build_array(v_trial.skill_file_id));
  end if;
  v_context:=jsonb_set(v_context,'{trialAssignment}',v_packet,true);
  if octet_length(v_context::text)>245760 then raise exception 'HQ_TRIAL_CONTEXT_CAPACITY' using errcode='22023'; end if;
  return jsonb_set(v_result,'{job,context}',v_context);
end $$;
revoke all on function hq_private.workforce_enrich_claim(jsonb) from public,anon,authenticated,service_role;
commit;
