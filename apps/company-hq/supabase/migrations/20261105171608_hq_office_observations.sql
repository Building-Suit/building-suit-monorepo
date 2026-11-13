-- Founder-visible office observations. No grants, prompts or private worker IDs
-- are exposed. Skill loads measure supplied context, never claimed application.
create table hq_private.office_tracking (
  singleton boolean primary key default true check(singleton),
  started_at timestamptz not null default clock_timestamp()
);
insert into hq_private.office_tracking(singleton) values(true);
create table hq_private.skill_context_receipts (
  job_id uuid primary key references public.hq_agent_jobs(id),
  founder_user_id uuid not null,
  agent_id text not null references hq_private.agent_roster(id),
  skill_ids jsonb not null check(jsonb_typeof(skill_ids)='array' and jsonb_array_length(skill_ids)<=10),
  loaded_at timestamptz not null default clock_timestamp()
);
create index hq_skill_context_agent_idx on hq_private.skill_context_receipts(founder_user_id,agent_id,loaded_at);
create index hq_office_task_agent_idx on public.hq_business_tasks(founder_user_id,assignee_id,created_at);
alter table hq_private.office_tracking enable row level security;
alter table hq_private.skill_context_receipts enable row level security;
revoke all on hq_private.office_tracking,hq_private.skill_context_receipts from public,anon,authenticated,service_role;
create trigger hq_skill_context_immutable before update or delete on hq_private.skill_context_receipts
  for each row execute function hq_private.immutable_record();

create function hq_private.worker_skill_context(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_skill_ids jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; expected jsonb; existing jsonb; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_skill_ids) is distinct from 'array' or jsonb_array_length(p_skill_ids)>10 then raise exception 'HQ_INVALID_SKILLS' using errcode='22023'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id for update;
  if not found or j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token
    or j.status<>'working' or j.lease_expires_at<=clock_timestamp()
    or (j.task_id is not null and exists(select 1 from public.hq_business_tasks t where t.id=j.task_id and t.status='canceled')) then
    raise exception 'HQ_LEASE_LOST' using errcode='42501'; end if;
  select skill_file_ids into expected from hq_private.agent_roster where id=j.agent_id;
  if not (p_skill_ids @> expected and expected @> p_skill_ids) or jsonb_array_length(p_skill_ids)<>jsonb_array_length(expected) then
    raise exception 'HQ_INVALID_SKILLS' using errcode='22023'; end if;
  select skill_ids into existing from hq_private.skill_context_receipts where job_id=j.id;
  if found and not (existing @> p_skill_ids and p_skill_ids @> existing) then raise exception 'HQ_CONTEXT_ALREADY_RECORDED' using errcode='PT409'; end if;
  insert into hq_private.skill_context_receipts(job_id,founder_user_id,agent_id,skill_ids)
    values(j.id,j.founder_user_id,j.agent_id,p_skill_ids) on conflict(job_id) do nothing;
  perform hq_private.live_emit('agents');
  return jsonb_build_object('accepted',true);
end $$;
create function public.hq_worker_skill_context(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_skill_ids jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_skill_context(p_job_id,p_lease_token,p_worker_id,p_skill_ids); $$;

create function hq_private.office_observations() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); since_at timestamptz; result jsonb; begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select started_at into since_at from hq_private.office_tracking;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,
    'metrics',jsonb_build_object(
      'today',(select count(*) from public.hq_business_tasks t where t.founder_user_id=uid and t.assignee_id=a.id and (t.created_at at time zone 'Africa/Cairo')::date=(clock_timestamp() at time zone 'Africa/Cairo')::date),
      'running',(select count(*) from public.hq_business_tasks t where t.founder_user_id=uid and t.assignee_id=a.id and t.status in ('working','review')),
      'turnaroundSeconds',(select round(avg(extract(epoch from t.completed_at-t.created_at))) from public.hq_business_tasks t where t.founder_user_id=uid and t.assignee_id=a.id and t.status='completed' and t.completed_at>=clock_timestamp()-interval '7 days'),
      'completed',(select count(*) from public.hq_business_tasks t where t.founder_user_id=uid and t.assignee_id=a.id and t.status='completed' and t.completed_at>=clock_timestamp()-interval '7 days'),
      'daily',(select jsonb_agg((select count(*) from public.hq_business_tasks t where t.founder_user_id=uid and t.assignee_id=a.id and (t.created_at at time zone 'Africa/Cairo')::date=(clock_timestamp() at time zone 'Africa/Cairo')::date-n) order by n desc) from generate_series(0,6) n)),
    'tools',jsonb_build_array(
      jsonb_build_object('id','google-drive','name','Google Drive','kind','api','icon','drive','available',a.profile_file_id is not null),
      jsonb_build_object('id','web-search','name','Web search','kind','native','icon','web','available',a.id in ('AG-RES-001','AG-HR-002'))),
    'skills',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,
      'name',case when lower(f.name)='skill.md' then coalesce(parent.name,f.name) else coalesce(regexp_replace(f.name,'[.]md$','','i'),s.id) end,
      'loads',case when exists(select 1 from public.hq_agent_jobs j where j.founder_user_id=uid and j.agent_id=a.id and j.started_at>=since_at and j.status in ('completed','blocked')
        and not exists(select 1 from hq_private.skill_context_receipts c where c.job_id=j.id)) then null else
        (select count(*) from hq_private.skill_context_receipts c where c.founder_user_id=uid and c.agent_id=a.id and c.skill_ids ? s.id) end,
      'running',exists(select 1 from hq_private.skill_context_receipts c join public.hq_agent_jobs j on j.id=c.job_id where c.founder_user_id=uid and c.agent_id=a.id and c.skill_ids ? s.id and j.status='working' and j.lease_expires_at>clock_timestamp())) order by s.id)
      from jsonb_array_elements_text(a.skill_file_ids) s(id)
      left join hq_private.brain_files f on f.file_id=s.id and f.in_scope and not f.trashed
      left join hq_private.brain_files parent on parent.file_id=f.parent_ids[1] and parent.in_scope and not parent.trashed),'[]'::jsonb)
    ) order by a.id),'[]'::jsonb) into result from hq_private.agent_roster a where a.enabled;
  return jsonb_build_object('since',since_at,'observedAt',clock_timestamp(),'agents',result,
    'recentTasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'assigneeId',t.assignee_id,'status',t.status,
      'createdAt',t.created_at,'brief',left(t.brief,2000),'acceptance',left(t.acceptance,1000)) order by t.created_at desc,t.id)
      from(select * from(select t.*,row_number() over(partition by assignee_id order by created_at desc,id) as recent_rank
        from public.hq_business_tasks t where founder_user_id=uid and created_at>=clock_timestamp()-interval '7 days') ranked
        where recent_rank<=8 order by created_at desc,id limit 128) t),'[]'::jsonb),
    'runningTasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'assigneeId',t.assignee_id,'status',t.status,
      'createdAt',t.created_at,'brief',left(t.brief,2000),'acceptance',left(t.acceptance,1000)) order by t.created_at,t.id)
      from(select * from public.hq_business_tasks where founder_user_id=uid and status in ('working','review') order by created_at,id limit 32) t),'[]'::jsonb),
    'tasksPartial',(select count(*)>32 from public.hq_business_tasks where founder_user_id=uid and status in ('working','review')));
end $$;
create function public.hq_office_observations() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.office_observations(); $$;
revoke all on function hq_private.worker_skill_context(uuid,uuid,uuid,jsonb),public.hq_worker_skill_context(uuid,uuid,uuid,jsonb),
  hq_private.office_observations(),public.hq_office_observations() from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_skill_context(uuid,uuid,uuid,jsonb),public.hq_worker_skill_context(uuid,uuid,uuid,jsonb),
  hq_private.office_observations(),public.hq_office_observations() to authenticated;
