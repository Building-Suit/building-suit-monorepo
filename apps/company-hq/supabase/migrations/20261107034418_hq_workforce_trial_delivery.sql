-- Forward-only functional completion of the reviewed trial contract. No admission
-- change, qualification seed, tool grant, model call or Brain write occurs here.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

-- The worker may attest only its own already-leased execution. Derive trial and
-- artifact from immutable server records; never trust a client-supplied artifact.
create function hq_private.worker_finish_v4(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb,p_trial_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; t hq_private.workforce_trials; a public.hq_task_artifacts; v jsonb; receipt uuid;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id for update;
  if j.id is null or j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token then
    raise exception 'HQ_LEASE_LOST' using errcode='42501'; end if;
  select * into t from hq_private.workforce_trials where task_id=j.task_id and agent_id=j.agent_id;
  if p_trial_evidence is not null and (t.id is null or j.kind<>'task-work') then
    raise exception 'HQ_TRIAL_HOST_EXECUTION_EVIDENCE_INVALID' using errcode='22023'; end if;
  -- A successful trial cannot commit its artifact without the actual host proof.
  if t.id is not null and j.kind='task-work' and p_error is null and p_trial_evidence is null then
    raise exception 'HQ_TRIAL_HOST_EXECUTION_REQUIRED' using errcode='22023'; end if;
  v:=hq_private.worker_finish_v3(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence);
  if p_trial_evidence is not null and not coalesce((v->>'discarded')::boolean,false) then
    select * into a from public.hq_task_artifacts where job_id=j.id;
    receipt:=hq_private.record_trial_host_execution(t.id,j.id,a.id,p_trial_evidence,'worker-job:'||j.id::text);
    v:=v||jsonb_build_object('trialReceiptAccepted',true,'trialReceiptId',receipt);
  end if;
  return v;
end $$;
create function public.hq_worker_finish_v4(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb,p_trial_evidence jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_finish_v4(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence) $$;
revoke all on function hq_private.worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb),public.hq_worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb),public.hq_worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) to authenticated;

-- A lost founder response reuses the exact request instead of queuing a second trial.
create or replace function public.hq_begin_supervised_worker_trial(p_agent_id text,p_skill_file_id text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t hq_private.workforce_trials;
begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  select * into t from hq_private.workforce_trials where request_key=p_request_key;
  if found then
    if t.requested_by<>uid or t.agent_id<>p_agent_id or t.skill_file_id<>p_skill_file_id then raise exception 'HQ_TRIAL_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return jsonb_build_object('accepted',true,'trialId',t.id,'taskId',t.task_id,'status',t.status,'headId',t.manager_id);
  end if;
  return hq_private.begin_supervised_worker_trial(p_agent_id,p_skill_file_id,p_request_key);
end $$;

-- A small founder-only projection supplies actions; no evidence payload or secret
-- reaches the browser. SQL remains the authority on every submitted command.
create function hq_private.workforce_trial_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('agentId',a.id,'skillFileId',
    case when jsonb_array_length(a.skill_file_ids)=1 then a.skill_file_ids->>0 end,
    'eligible',a.model_tier='T1_WORKER' and a.lifecycle ~* '(configured|trial|pending)' and jsonb_array_length(a.skill_file_ids)=1 and not coalesce(t.status='active' and t.expires_at>clock_timestamp(),false),
    'qualified',hq_private.workforce_agent_qualified(a.id),'trialId',t.id,'status',t.status,
    'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),
    'reviewComplete',coalesce(t.status='passed' and exists(select 1 from public.hq_agent_jobs j where j.task_id=t.task_id and j.kind='task-report' and j.status='completed'),false))
    order by a.id) from hq_private.agent_roster a left join lateral
      (select id,status,task_id,expires_at from hq_private.workforce_trials where agent_id=a.id and requested_by=hq_private.founder_uid() order by created_at desc,id desc limit 1) t on true
    where a.enabled and a.model_tier='T1_WORKER'),'[]'::jsonb);
end $$;
create function public.hq_workforce_trial_status() returns jsonb language sql stable security invoker set search_path='' as $$ select hq_private.workforce_trial_status() $$;
revoke all on function hq_private.workforce_trial_status(),public.hq_workforce_trial_status() from public,anon,authenticated,service_role;
grant execute on function hq_private.workforce_trial_status(),public.hq_workforce_trial_status() to authenticated;

-- Steve's ordinary-task rejection returns to the authorized T2 manager. Keep
-- workforce_head_authorized unchanged; a CEO review is not a manager handoff.
create function hq_private.route_qualified_correction_through_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare a hq_private.agent_roster; m hq_private.agent_roster;
begin
  if new.kind='task-start' and new.task_id is not null
    and not exists(select 1 from hq_private.workforce_trials where task_id=new.task_id)
    and exists(select 1 from public.hq_agent_jobs p where p.id=new.depends_on and p.task_id=new.task_id
      and p.kind='ceo-review' and p.agent_id='AG-CEO-001' and p.status='completed' and p.result_text::jsonb->'accepted'='false'::jsonb) then
    select * into a from hq_private.agent_roster where id=new.agent_id and enabled;
    select * into m from hq_private.agent_roster where id=a.manager_id and enabled;
    if a.model_tier='T1_WORKER' and m.model_tier='T2_HEAD' and m.department_key=a.department_key and hq_private.workforce_agent_qualified(a.id) then
      new.kind:='task-ack'; new.agent_id:=m.id;
    end if;
  end if;
  return new;
end $$;
revoke all on function hq_private.route_qualified_correction_through_head() from public,anon,authenticated,service_role;
create trigger hq_qualified_correction_through_head before insert on public.hq_agent_jobs
  for each row execute function hq_private.route_qualified_correction_through_head();

create function hq_private.direct_qualified_correction_to_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; a hq_private.agent_roster; m hq_private.agent_roster;
begin
  if to_jsonb(new)->>'kind'='recovery' and to_jsonb(new)->>'job_id' is not null then
    select * into j from public.hq_agent_jobs where id=new.job_id and kind='ceo-review' and agent_id='AG-CEO-001' and status='completed';
    select r.* into a from hq_private.agent_roster r join public.hq_business_tasks t on t.assignee_id=r.id where t.id=j.task_id;
    select * into m from hq_private.agent_roster where id=a.manager_id and enabled;
    if j.id is not null and a.model_tier='T1_WORKER' and m.model_tier='T2_HEAD' and m.department_key=a.department_key
      and hq_private.workforce_agent_qualified(a.id) and not exists(select 1 from hq_private.workforce_trials where task_id=j.task_id) then
      new.agent_id:=m.id; new.mention_ids:=array[m.id];
      new.text:='@'||m.name||' Steve rejected the artifact. Review the recorded findings and issue the bounded repair to the assigned worker.';
    end if;
  end if;
  return new;
end $$;
revoke all on function hq_private.direct_qualified_correction_to_head() from public,anon,authenticated,service_role;
create trigger hq_qualified_correction_message_to_head before insert on public.hq_agent_messages
  for each row execute function hq_private.direct_qualified_correction_to_head();

-- New workers fail closed before drain/activation if this additive path is absent.
alter function hq_private.worker_release_status(uuid) rename to worker_release_status_contract2;
revoke all on function hq_private.worker_release_status_contract2(uuid) from public,anon,authenticated,service_role;
create function hq_private.worker_release_status(p_worker_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin return hq_private.worker_release_status_contract2(p_worker_id)||jsonb_build_object('trialDelivery',1); end $$;
revoke all on function hq_private.worker_release_status(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_release_status(uuid) to authenticated;
create or replace function public.hq_worker_release_status(p_worker_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select hq_private.worker_release_status(p_worker_id) $$;
commit;
