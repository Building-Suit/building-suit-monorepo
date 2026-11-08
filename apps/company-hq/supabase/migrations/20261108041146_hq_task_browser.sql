-- Founder-only, bounded task summaries and on-demand details. No task writes,
-- worker grants, public table access or changes to accepted history.
create index hq_tasks_browser_status_idx on public.hq_business_tasks(founder_user_id,status,created_at desc,id desc);

create function hq_private.task_browser(p_group text,p_office_id text,p_offset integer,p_limit integer,p_task_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=hq_private.founder_uid(); result jsonb;
begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_group is null or p_group not in ('running','waiting','done') or p_offset is null or p_offset<0
    or p_limit is null or p_limit not between 1 and 12
    or (p_office_id is not null and p_office_id<>'executive' and not exists(select 1 from public.hq_departments d where d.id::text=p_office_id)) then
    raise exception 'HQ_INVALID_TASK_QUERY' using errcode='22023';
  end if;
  -- Count and window share one statement/snapshot. Canceled is terminal but
  -- remains labeled Canceled; blocked is Waiting, never successful completion.
  with scoped as materialized (
    select t.id,t.title,t.assignee_id,t.status,t.created_at,t.completed_at,
      case when t.status in ('working','review') then 'running' when t.status in ('queued','blocked') then 'waiting' else 'done' end as task_group
    from public.hq_business_tasks t
    where t.founder_user_id=uid and (p_task_id is null or t.id=p_task_id)
      and (p_office_id is null
        or p_office_id='executive' and t.assignee_id='AG-CEO-001'
        or exists(select 1 from hq_private.agent_roster a join public.hq_departments d on d.department_key=a.department_key
          where a.id=t.assignee_id and d.id::text=p_office_id))
  ), page as (
    select s.* from scoped s where p_task_id is not null or s.task_group=p_group
    order by s.created_at desc,s.id desc limit p_limit offset p_offset
  )
  select pg_catalog.jsonb_build_object(
    'counts',pg_catalog.jsonb_build_object('running',(select count(*) from scoped where task_group='running'),
      'waiting',(select count(*) from scoped where task_group='waiting'),'done',(select count(*) from scoped where task_group='done')),
    'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',p.id,'title',p.title,'assigneeId',p.assignee_id,'status',p.status,'createdAt',p.created_at,'completedAt',p.completed_at,
      'brief',case when p_task_id is null then '' else t.brief end,
      'acceptance',case when p_task_id is null then '' else t.acceptance end,
      'updatedAt',t.updated_at,'repairCount',t.repair_count,
      'deliverable',case when p_task_id is null then null else t.deliverable end,
      'reviewSummary',case when p_task_id is null then null else t.review_summary end,
      'error',t.error) order by p.created_at desc,p.id desc)
      from page p join public.hq_business_tasks t on t.id=p.id and t.founder_user_id=uid),'[]'::jsonb)) into result;
  return result;
end $$;
create function public.hq_task_browser(p_group text default 'running',p_office_id text default null,p_offset integer default 0,p_limit integer default 12,p_task_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.task_browser(p_group,p_office_id,p_offset,p_limit,p_task_id); $$;
revoke all on function hq_private.task_browser(text,text,integer,integer,uuid),public.hq_task_browser(text,text,integer,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.task_browser(text,text,integer,integer,uuid),public.hq_task_browser(text,text,integer,integer,uuid) to authenticated;
