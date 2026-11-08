-- Fixed evaluator qualification: Iris executes; Amaya supervises; Steve independently reviews.
-- No arbitrary reviewer selection, canonical publication or lifecycle activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
lock table public.hq_agent_jobs in share row exclusive mode;
lock table hq_private.agent_workers in share row exclusive mode;

alter table hq_private.workforce_trials drop constraint workforce_trials_purpose_check;
alter table hq_private.workforce_trials add constraint workforce_trials_purpose_check
 check(purpose in ('synthetic-internal-trial-v1','public-research-tool-trial-v1','evaluator-skill-trial-v1'));
alter table hq_private.workforce_qualification_receipts drop constraint workforce_qualification_receipts_reviewer_id_check;
alter table hq_private.workforce_qualification_receipts add constraint workforce_qualification_receipts_reviewer_id_check
 check(reviewer_id in ('AG-HR-003','AG-CEO-001'));

create function hq_private.trial_evaluator(p_task_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from hq_private.workforce_trials t where t.task_id=p_task_id
  and t.purpose='evaluator-skill-trial-v1' and t.agent_id='AG-HR-003' and t.manager_id='AG-HR-001')
 then 'AG-CEO-001' else 'AG-HR-003' end
$$;
revoke all on function hq_private.trial_evaluator(uuid) from public,anon,authenticated,service_role;
create function hq_private.trial_evaluator_ready(p_reviewer text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_reviewer in ('AG-HR-003','AG-CEO-001') and exists(select 1 from hq_private.agent_roster r
 join hq_private.brain_files f on f.file_id=r.profile_file_id and f.in_scope and not f.trashed
  and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.source_version is not null
 where r.id=p_reviewer and r.enabled and hq_private.workforce_agent_assignable(r.id)
  and (p_reviewer<>'AG-CEO-001' or r.model_tier='T3_EXEC')
  and not exists(select 1 from jsonb_array_elements_text(r.skill_file_ids) s(id)
   where not exists(select 1 from hq_private.brain_files skill where skill.file_id=s.id and skill.in_scope
    and not skill.trashed and skill.source_version is not null and skill.root_id=f.root_id)))
$$;
revoke all on function hq_private.trial_evaluator_ready(text) from public,anon,authenticated,service_role;

create or replace function hq_private.bind_staffing_trial_reviewer() returns trigger
language plpgsql security definer set search_path='' as $$
declare reviewer text;
begin
 if tg_op='UPDATE' then
  if new.reviewer_binding_digest is distinct from old.reviewer_binding_digest then raise exception 'HQ_TRIAL_REVIEWER_IMMUTABLE'; end if;
  return new;
 end if;
 reviewer:=case when new.purpose='evaluator-skill-trial-v1' then 'AG-CEO-001' else 'AG-HR-003' end;
 if new.purpose='evaluator-skill-trial-v1' and (new.agent_id<>'AG-HR-003' or new.manager_id<>'AG-HR-001')
  or new.agent_id=reviewer or new.manager_id=reviewer or not hq_private.trial_evaluator_ready(reviewer) then
  raise exception 'HQ_TRIAL_REVIEWER_UNAVAILABLE'; end if;
 new.reviewer_binding_digest:=hq_private.workforce_agent_binding_digest(reviewer);
 return new;
end $$;

-- Clone only the constructor body. The original still fails the self-review guard.
do $$ declare d text:=pg_get_functiondef('hq_private.begin_supervised_worker_trial(text,text,uuid)'::regprocedure); c text;
begin
 c:=replace(d,'FUNCTION hq_private.begin_supervised_worker_trial(p_agent_id text, p_skill_file_id text, p_request_key uuid)',
  'FUNCTION hq_private.begin_evaluator_trial_base(p_agent_id text, p_skill_file_id text, p_request_key uuid)');
 if c=d or position('profile_source_version,skill_source_version,requested_by)' in c)=0 then raise exception 'HQ_EVALUATOR_CONSTRUCTOR_SOURCE_MISMATCH'; end if;
 c:=replace(c,'profile_source_version,skill_source_version,requested_by)','profile_source_version,skill_source_version,requested_by,purpose)');
 c:=replace(c,'v_profile_version,v_skill_version,v_uid)','v_profile_version,v_skill_version,v_uid,''evaluator-skill-trial-v1'')');
 c:=replace(c,'v_agent.lifecycle !~* ''(configured|trial|pending)''',
  '(v_agent.lifecycle !~* ''(configured|trial|pending|active)'' or v_agent.lifecycle ~* ''(suspended|inactive|retired|terminated|archived|paused|testing-only)'')');
 execute c;
end $$;
revoke all on function hq_private.begin_evaluator_trial_base(text,text,uuid) from public,anon,authenticated,service_role;
create function hq_private.begin_evaluator_trial(p_skill_file_id text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t hq_private.workforce_trials;
begin
 if uid is null or p_request_key is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 if p_skill_file_id is null or p_skill_file_id !~ '^[A-Za-z0-9_-]{8,200}$' then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
 if hq_private.founder_uid() is distinct from uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 select * into t from hq_private.workforce_trials where request_key=p_request_key;
 if found then
  if t.requested_by is distinct from uid or t.agent_id is distinct from 'AG-HR-003' or t.manager_id is distinct from 'AG-HR-001'
   or t.skill_file_id is distinct from p_skill_file_id or t.purpose is distinct from 'evaluator-skill-trial-v1' then
   raise exception 'HQ_TRIAL_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
  return jsonb_build_object('accepted',true,'trialId',t.id,'taskId',t.task_id,'status',t.status,'headId',t.manager_id);
 end if;
 if not exists(select 1 from hq_private.agent_roster a join hq_private.agent_roster m on m.id=a.manager_id
  where a.id='AG-HR-003' and a.enabled and a.model_tier='T1_WORKER' and a.manager_id='AG-HR-001'
  and a.department_key='hr-agent-development' and m.enabled and m.model_tier='T2_HEAD'
  and m.department_key=a.department_key and hq_private.workforce_agent_assignable(m.id))
  or not hq_private.trial_evaluator_ready('AG-CEO-001') then raise exception 'HQ_TRIAL_NOT_ELIGIBLE' using errcode='22023'; end if;
 return hq_private.begin_evaluator_trial_base('AG-HR-003',p_skill_file_id,p_request_key);
end $$;
create function public.hq_begin_evaluator_trial(p_skill_file_id text,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$select hq_private.begin_evaluator_trial(p_skill_file_id,p_request_key)$$;
revoke all on function hq_private.begin_evaluator_trial(text,uuid),public.hq_begin_evaluator_trial(text,uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.begin_evaluator_trial(text,uuid),public.hq_begin_evaluator_trial(text,uuid) to authenticated;

-- Each changed branch selects Steve only for the fixed Iris purpose; all other trials retain Iris.
do $$ declare d text; c text;
begin
 d:=pg_get_functiondef('hq_private.route_trial_review_to_iris()'::regprocedure);
 c:=replace(d,'new.agent_id:=''AG-HR-003'';','new.agent_id:=hq_private.trial_evaluator(new.task_id);');
 if c=d then raise exception 'HQ_EVALUATOR_ROUTE_SOURCE_MISMATCH'; end if; execute c;
 d:=pg_get_functiondef('hq_private.route_trial_correction_through_head()'::regprocedure);
 c:=replace(d,'p.agent_id=''AG-HR-003''','p.agent_id=hq_private.trial_evaluator(new.task_id)');
 if c=d then raise exception 'HQ_EVALUATOR_CORRECTION_SOURCE_MISMATCH'; end if; execute c;
 d:=pg_get_functiondef('hq_private.direct_trial_correction_to_head()'::regprocedure);
 c:=replace(d,'agent_id=''AG-HR-003''','agent_id=hq_private.trial_evaluator(task_id)');
 c:=replace(c,' Iris rejected the supervised trial artifact.',' The independent evaluator rejected the supervised trial artifact.');
 if c=d then raise exception 'HQ_EVALUATOR_MESSAGE_SOURCE_MISMATCH'; end if; execute c;
 d:=pg_get_functiondef('hq_private.record_trial_review()'::regprocedure);
 c:=replace(d,'new.agent_id<>''AG-HR-003''','new.agent_id<>hq_private.trial_evaluator(new.task_id)');
 if c=d then raise exception 'HQ_EVALUATOR_REVIEW_SOURCE_MISMATCH'; end if; execute c;
 d:=pg_get_functiondef('hq_private.workforce_enrich_claim_before_public_discovery(jsonb)'::regprocedure);
 c:=replace(d,'t.agent_id=''AG-HR-003'' or t.manager_id=''AG-HR-003''',
  't.agent_id=hq_private.trial_evaluator(t.task_id) or t.manager_id=hq_private.trial_evaluator(t.task_id)');
 c:=replace(c,'hq_private.workforce_agent_binding_digest(''AG-HR-003'')','hq_private.workforce_agent_binding_digest(hq_private.trial_evaluator(t.task_id))');
 c:=replace(c,'not exists(select 1 from hq_private.agent_roster where id=''AG-HR-003'' and enabled)',
  'not hq_private.trial_evaluator_ready(hq_private.trial_evaluator(t.task_id))');
 if c=d then raise exception 'HQ_EVALUATOR_CLAIM_SOURCE_MISMATCH'; end if; execute c;
end $$;
drop trigger hq_record_trial_review on public.hq_agent_jobs;
create trigger hq_record_trial_review after update of status on public.hq_agent_jobs
 for each row when(new.status='completed' and new.kind='ceo-review' and new.agent_id in ('AG-HR-003','AG-CEO-001'))
 execute function hq_private.record_trial_review();

-- Frozen independent-review and same-artifact chain, reused for read readiness and Iris issuance.
create function hq_private.trial_review_ready(p_trial_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from hq_private.workforce_trials t
 join hq_private.agent_roster a on a.id=t.agent_id and a.enabled and a.model_tier='T1_WORKER'
 join hq_private.agent_roster m on m.id=t.manager_id and m.id=a.manager_id and m.enabled and m.model_tier='T2_HEAD'
 join public.hq_business_tasks task on task.id=t.task_id and task.founder_user_id=t.requested_by and task.status='completed'
 join public.hq_task_artifacts artifact on artifact.id=t.artifact_id and artifact.task_id=task.id and artifact.agent_id=a.id
 join public.hq_agent_jobs review on review.id=t.review_job_id and review.task_id=task.id and review.artifact_id=artifact.id
  and review.kind='ceo-review' and review.agent_id=hq_private.trial_evaluator(task.id) and review.status='completed'
  and review.result_text::jsonb->>'accepted'='true' and review.result_text::jsonb->>'artifactDigest'=artifact.digest
 join public.hq_agent_jobs head on head.id=review.depends_on and head.task_id=task.id and head.artifact_id=artifact.id
  and head.kind='head-review' and head.agent_id=m.id and head.status='completed'
  and head.result_text::jsonb->>'accepted'='true' and head.result_text::jsonb->>'artifactDigest'=artifact.digest
 join hq_private.workforce_trial_host_execution_receipts x on x.trial_id=t.id and x.agent_id=a.id
  and x.artifact_id=artifact.id and x.artifact_digest=artifact.digest and x.worker_job_id=artifact.job_id
  and x.outcome='completed' and x.provider_served_model='unknown' and x.attestation_level='host-returned-resolution'
  and x.configured_model=a.model and x.launch_model=a.model and x.configured_effort=a.effort and x.launch_effort=a.effort
  and x.host_returned_model=a.model and x.host_returned_effort=a.effort and x.host_returned_thread_id=x.thread_id
 where t.id=p_trial_id and t.status='passed' and t.completed_at<=t.expires_at
  and a.lifecycle ~* case when t.purpose='evaluator-skill-trial-v1' then '(configured|trial|pending|active)' else '(configured|trial|pending)' end
  and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
  and m.department_key=a.department_key and hq_private.workforce_agent_assignable(m.id)
  and t.binding_digest=hq_private.workforce_trial_binding_digest(a.id)
  and t.reviewer_binding_digest=hq_private.workforce_agent_binding_digest(hq_private.trial_evaluator(task.id))
  and hq_private.trial_evaluator_ready(hq_private.trial_evaluator(task.id))
  and a.id<>review.agent_id and m.id<>review.agent_id
  and exists(select 1 from public.hq_agent_jobs r where r.task_id=task.id and r.kind='task-report' and r.status='completed')
  and exists(select 1 from public.hq_agent_jobs l where l.task_id=task.id and l.kind='lesson-extract' and l.status='blocked' and l.error='trial-learning-disabled'))
$$;
revoke all on function hq_private.trial_review_ready(uuid) from public,anon,authenticated,service_role;

-- Widen storage solely for the independently validated fixed evaluator purpose.
create function hq_private.guard_evaluator_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
declare t hq_private.workforce_trials;
begin
 select * into t from hq_private.workforce_trials where id=new.trial_id;
 if new.reviewer_id is distinct from hq_private.trial_evaluator(t.task_id) or new.agent_id=new.reviewer_id or new.manager_id=new.reviewer_id
  or (new.reviewer_id='AG-CEO-001' and (t.purpose is distinct from 'evaluator-skill-trial-v1'
   or new.agent_id<>'AG-HR-003' or new.manager_id<>'AG-HR-001' or not hq_private.trial_review_ready(t.id))) then
  raise exception 'HQ_EVALUATOR_RECEIPT_INVALID' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function hq_private.guard_evaluator_receipt() from public,anon,authenticated,service_role;
create trigger hq_evaluator_receipt_guard before insert on hq_private.workforce_qualification_receipts
 for each row execute function hq_private.guard_evaluator_receipt();

do $$ declare d text; c text;
begin
 d:=pg_get_functiondef('hq_private.issue_workforce_qualification_before_staffing_reviewer(uuid)'::regprocedure);
 c:=replace(d,'FUNCTION hq_private.issue_workforce_qualification_before_staffing_reviewer(p_trial_id uuid)',
  'FUNCTION hq_private.issue_evaluator_qualification_base(p_trial_id uuid)');
 if c=d then raise exception 'HQ_EVALUATOR_ISSUE_SOURCE_MISMATCH'; end if;
 c:=replace(c,'AG-HR-003','AG-CEO-001');
 c:=replace(c,'v_agent.lifecycle !~* ''(configured|trial|pending)''',
  '(v_agent.lifecycle !~* ''(configured|trial|pending|active)'' or v_agent.lifecycle ~* ''(suspended|inactive|retired|terminated|archived|paused|testing-only)'')');
 execute c;
 d:=pg_get_functiondef('hq_private.issue_workforce_qualification(uuid)'::regprocedure);
 c:=replace(d,'FUNCTION hq_private.issue_workforce_qualification(p_trial_id uuid)',
  'FUNCTION hq_private.issue_workforce_qualification_before_evaluator(p_trial_id uuid)');
 if c=d then raise exception 'HQ_EVALUATOR_ISSUE_SOURCE_MISMATCH'; end if; execute c;
 d:=pg_get_functiondef('hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure);
 c:=replace(d,'and q.reviewer_id=''AG-HR-003'' and review.agent_id=''AG-HR-003''',
  $new$and q.agent_id<>q.reviewer_id and q.manager_id<>q.reviewer_id and (
   (q.reviewer_id='AG-HR-003' and review.agent_id='AG-HR-003' and t.purpose<>'evaluator-skill-trial-v1')
   or (q.reviewer_id='AG-CEO-001' and review.agent_id='AG-CEO-001' and r.id='AG-HR-003' and r.manager_id='AG-HR-001'
    and t.purpose='evaluator-skill-trial-v1' and hq_private.trial_review_ready(t.id)))$new$);
 if c=d then raise exception 'HQ_EVALUATOR_EVIDENCE_SOURCE_MISMATCH'; end if; execute c;
end $$;
revoke all on function hq_private.issue_evaluator_qualification_base(uuid),hq_private.issue_workforce_qualification_before_evaluator(uuid) from public,anon,authenticated,service_role;
create or replace function hq_private.issue_workforce_qualification(p_trial_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t hq_private.workforce_trials;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
 if hq_private.founder_uid() is distinct from uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 select * into t from hq_private.workforce_trials where id=p_trial_id;
 if t.purpose='evaluator-skill-trial-v1' then
  if t.requested_by is distinct from uid or t.agent_id<>'AG-HR-003' or t.manager_id<>'AG-HR-001'
   or not hq_private.trial_review_ready(t.id) then raise exception 'HQ_TRIAL_EVIDENCE_INCOMPLETE' using errcode='22023'; end if;
  return hq_private.issue_evaluator_qualification_base(t.id);
 end if;
 return hq_private.issue_workforce_qualification_before_evaluator(p_trial_id);
end $$;

-- The evaluator's synthetic exercise retains the exact no-tools protocol and
-- cannot finish through a legacy endpoint before host evidence is recorded.
do $$ declare d text; c text;
begin
 d:=pg_get_functiondef('hq_private.record_trial_host_execution(uuid,uuid,uuid,jsonb,text)'::regprocedure);
 c:=replace(d,'v_trial.purpose=''synthetic-internal-trial-v1'' or v_job.attempt>0',
  'v_trial.purpose in (''synthetic-internal-trial-v1'',''evaluator-skill-trial-v1'') or v_job.attempt>0');
 if c=d then raise exception 'HQ_EVALUATOR_HOST_SOURCE_MISMATCH'; end if; execute c;
 d:=pg_get_functiondef('hq_private.worker_finish_before_meetings(uuid,uuid,uuid,text,text)'::regprocedure);
 c:=replace(d,'if (exists(select 1 from hq_private.public_discovery_tasks',
  'if (exists(select 1 from hq_private.workforce_trials et join public.hq_agent_jobs ej on ej.task_id=et.task_id where ej.id=p_job_id and ej.kind=''task-work'' and ej.agent_id=''AG-HR-003'' and et.agent_id=ej.agent_id and et.manager_id=''AG-HR-001'' and et.purpose=''evaluator-skill-trial-v1'') or exists(select 1 from hq_private.public_discovery_tasks');
 if c=d then raise exception 'HQ_EVALUATOR_ATOMIC_SOURCE_MISMATCH'; end if; execute c;
end $$;

-- Reuse immutable full-input delivery fingerprints for the new evaluator purpose.
-- An exact committed journal replay never reauthorizes work after source drift.
do $$ declare d text:=pg_get_functiondef('hq_private.worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)'::regprocedure); c text;
begin
 c:=replace(d,'if selecting or (policy.task_id is not null and j.kind=''task-work'' and j.agent_id=policy.agent_id) then',
  'if selecting or (policy.task_id is not null and j.kind=''task-work'' and j.agent_id=policy.agent_id) or (j.kind=''task-work'' and j.agent_id=''AG-HR-003'' and exists(select 1 from hq_private.workforce_trials et where et.task_id=j.task_id and et.agent_id=j.agent_id and et.manager_id=''AG-HR-001'' and et.purpose=''evaluator-skill-trial-v1'')) then');
 if c=d then raise exception 'HQ_EVALUATOR_DELIVERY_SOURCE_MISMATCH'; end if; execute c;
end $$;

-- Purpose context never changes the worker's no-tools host protocol.
do $$ declare d text:=pg_get_functiondef('hq_private.workforce_enrich_claim(jsonb)'::regprocedure); c text;
begin
 c:=replace(d,'FUNCTION hq_private.workforce_enrich_claim(v jsonb)','FUNCTION hq_private.workforce_enrich_claim_before_evaluator(v jsonb)');
 if c=d then raise exception 'HQ_EVALUATOR_CONTEXT_SOURCE_MISMATCH'; end if; execute c;
end $$;
revoke all on function hq_private.workforce_enrich_claim_before_evaluator(jsonb) from public,anon,authenticated,service_role;
create or replace function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:=hq_private.workforce_enrich_claim_before_evaluator(v); t hq_private.workforce_trials; c jsonb;
begin
 if jsonb_typeof(result->'job') is distinct from 'object' then return result; end if;
 select * into t from hq_private.workforce_trials where task_id=(result->'job'->'context'->'task'->>'id')::uuid;
 if t.purpose='evaluator-skill-trial-v1' then
  c:=result->'job'->'context';
  c:=jsonb_set(c,'{supervisedTrial}',coalesce(c->'supervisedTrial','{}'::jsonb)||jsonb_build_object('scope',t.purpose,
   'reviewerId','AG-CEO-001','reviewerBindingDigest',t.reviewer_binding_digest));
  if c->>'mode'='ceo-review' and result->'job'->>'agent_id'='AG-CEO-001' then c:=c||jsonb_build_object('trialReview',true); end if;
  return jsonb_set(result,'{job,context}',c);
 end if;
 return result;
end $$;

-- Ordinary, per-skill controls remain read-only and preserve all previous rows/fields.
do $$ declare d text:=pg_get_functiondef('hq_private.workforce_trial_status()'::regprocedure); c text;
begin
 c:=replace(d,'FUNCTION hq_private.workforce_trial_status()','FUNCTION hq_private.workforce_trial_status_before_evaluator()');
 if c=d then raise exception 'HQ_EVALUATOR_STATUS_SOURCE_MISMATCH'; end if; execute c;
end $$;
revoke all on function hq_private.workforce_trial_status_before_evaluator() from public,anon,authenticated,service_role;
create or replace function hq_private.workforce_trial_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); result jsonb; row jsonb; a hq_private.agent_roster; m hq_private.agent_roster;
 t hq_private.workforce_trials; skill_id text; skill_name text; reviewer text; ready boolean; eligible boolean; qualified boolean; current_binding boolean; ordinary jsonb;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 result:=hq_private.workforce_trial_status_before_evaluator();
 for row in select value from jsonb_array_elements(result) loop
  select * into a from hq_private.agent_roster where id=row->>'agentId' and enabled and model_tier='T1_WORKER';
  if a.id is null then continue; end if;
  select * into m from hq_private.agent_roster where id=a.manager_id and enabled;
  reviewer:=case when a.id='AG-HR-003' then 'AG-CEO-001' else 'AG-HR-003' end;
  ready:=coalesce(hq_private.trial_evaluator_ready(reviewer),false);
  qualified:=coalesce(hq_private.workforce_agent_qualified(a.id),false);
  select skill.value,left(f.name,160) into skill_id,skill_name from jsonb_array_elements_text(a.skill_file_ids) skill(value)
   join hq_private.brain_files f on f.file_id=skill.value and f.in_scope and not f.trashed and f.source_version is not null
    and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
   where not hq_private.workforce_skill_evidence_valid(a.id,skill.value) order by skill.value limit 1;
  select * into t from hq_private.workforce_trials where agent_id=a.id and requested_by=uid
   and purpose in ('synthetic-internal-trial-v1','evaluator-skill-trial-v1') order by created_at desc,id desc limit 1;
  current_binding:=coalesce(t.id is not null and t.binding_digest=hq_private.workforce_trial_binding_digest(a.id)
   and t.reviewer_binding_digest=hq_private.workforce_agent_binding_digest(reviewer),false);
  eligible:=coalesce(ready and not qualified and skill_id is not null and jsonb_array_length(a.skill_file_ids) between 1 and 10
   and a.lifecycle ~* case when a.id='AG-HR-003' then '(configured|trial|pending|active)' else '(configured|trial|pending)' end
   and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
   and m.model_tier='T2_HEAD' and m.department_key=a.department_key and hq_private.workforce_agent_assignable(m.id)
   and a.id<>reviewer and a.manager_id<>reviewer
   and (a.id<>'AG-HR-003' or a.manager_id='AG-HR-001' and a.department_key='hr-agent-development')
   and exists(select 1 from hq_private.brain_files f where f.file_id=a.profile_file_id and f.in_scope and not f.trashed and f.source_version is not null)
   and not exists(select 1 from hq_private.workforce_trials active_trial where active_trial.agent_id=a.id
    and active_trial.status='active' and active_trial.expires_at>clock_timestamp()),false);
  ordinary:=jsonb_build_object('skillFileId',skill_id,'skillName',skill_name,'eligible',eligible,'qualified',qualified,
   'reviewerId',reviewer,'reviewerReady',ready,'trialId',t.id,'status',t.status,'bindingCurrent',current_binding,
   'reviewComplete',coalesce(hq_private.trial_review_ready(t.id),false),
   'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),'taskId',t.task_id);
  result:=jsonb_set(result,array[(select (ordinal-1)::text from jsonb_array_elements(result) with ordinality e(value,ordinal) where value->>'agentId'=a.id)],row||jsonb_build_object('ordinary',ordinary));
 end loop;
 return result;
end $$;

-- A request-scoped rollout fence protects old ordinary AND Research binaries.
create table hq_private.role_claim_requests(transaction_id bigint primary key,worker_id uuid not null references hq_private.agent_workers(worker_id));
alter table hq_private.role_claim_requests enable row level security;
revoke all on hq_private.role_claim_requests from public,anon,authenticated,service_role;
create function hq_private.role_client_required(p_job public.hq_agent_jobs) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from hq_private.workforce_trials t where t.task_id=p_job.task_id
  and t.purpose in ('evaluator-skill-trial-v1','public-retail-tool-trial-v1'))
$$;
revoke all on function hq_private.role_client_required(public.hq_agent_jobs) from public,anon,authenticated,service_role;
do $$ declare d text:=pg_get_functiondef('hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure); c text;
begin
 c:=replace(d,'x where x.status=''queued''','x where x.status=''queued'' and (not hq_private.role_client_required(x) or exists(select 1 from hq_private.role_claim_requests rc where rc.transaction_id=txid_current() and rc.worker_id=p_worker_id))');
 if c=d then raise exception 'HQ_ROLE_CLAIM_SOURCE_MISMATCH'; end if; execute c;
end $$;
create function hq_private.guard_role_claim() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'working' or not hq_private.role_client_required(new) then return new; end if;
 if tg_op='UPDATE' and old.status='working' and old.worker_id is not null and old.lease_token is not null
  and (new.worker_id,new.lease_token) is not distinct from (old.worker_id,old.lease_token) then return new; end if;
 if not exists(select 1 from hq_private.role_claim_requests rc where rc.transaction_id=txid_current() and rc.worker_id=new.worker_id) then
  raise exception 'HQ_ROLE_CLIENT_REQUIRED' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function hq_private.guard_role_claim() from public,anon,authenticated,service_role;
create trigger hq_role_claim_fence before insert or update of status,worker_id,lease_token on public.hq_agent_jobs
 for each row execute function hq_private.guard_role_claim();
create function hq_private.worker_role_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
 if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 insert into hq_private.role_claim_requests values(txid_current(),p_worker_id);
 result:=hq_private.worker_research_claim(p_worker_id,p_lease_seconds,p_meeting_protocol);
 delete from hq_private.role_claim_requests where transaction_id=txid_current();
 return result;
end $$;
create function public.hq_worker_role_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_role_claim(p_worker_id,p_lease_seconds,p_meeting_protocol) $$;
revoke all on function hq_private.worker_role_claim(uuid,integer,integer),public.hq_worker_role_claim(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_role_claim(uuid,integer,integer),public.hq_worker_role_claim(uuid,integer,integer) to authenticated;
do $$ declare d text; c text;
begin
 d:=pg_get_functiondef('hq_private.research_api_proof(uuid)'::regprocedure);
 c:=replace(d,'FUNCTION hq_private.research_api_proof(p_worker_id uuid)','FUNCTION hq_private.role_api_proof(p_worker_id uuid)');
 if c=d then raise exception 'HQ_ROLE_API_SOURCE_MISMATCH'; end if;
 c:=replace(c,'worker_research_claim','worker_role_claim'); execute c;
 d:=pg_get_functiondef('hq_private.worker_release_status(uuid)'::regprocedure);
 c:=replace(d,'FUNCTION hq_private.worker_release_status(p_worker_id uuid)','FUNCTION hq_private.worker_release_status_before_role(p_worker_id uuid)');
 if c=d then raise exception 'HQ_ROLE_STATUS_SOURCE_MISMATCH'; end if; execute c;
end $$;
revoke all on function hq_private.role_api_proof(uuid),hq_private.worker_release_status_before_role(uuid) from public,anon,authenticated,service_role;
create or replace function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb:=hq_private.worker_release_status_before_role(p_worker_id);
begin
 begin return result||jsonb_build_object('roleApi',hq_private.role_api_proof(p_worker_id)->'api');
 exception when sqlstate '55000' then return result||jsonb_build_object('roleApi',null); end;
end $$;
commit;
