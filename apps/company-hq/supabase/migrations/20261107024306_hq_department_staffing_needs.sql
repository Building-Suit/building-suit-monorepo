-- When the existing worker host refuses work because no eligible lower-tier
-- worker is available, retain a durable HR-owned staffing need. This does not
-- hire, qualify, assign, notify externally, or resume the blocked task.
create table hq_private.department_staffing_needs (
  id uuid primary key default gen_random_uuid(),
  founder_user_id uuid not null,
  task_id uuid not null references public.hq_business_tasks(id),
  department_key text not null,
  department_head_id text not null references hq_private.agent_roster(id),
  hr_owner_id text not null default 'AG-HR-001' references hq_private.agent_roster(id),
  blocked_job_id uuid not null unique references public.hq_agent_jobs(id),
  blocked_agent_id text not null references hq_private.agent_roster(id),
  reason_code text not null check(reason_code='no-eligible-worker'),
  status text not null default 'open' check(status='open'),
  created_at timestamptz not null default clock_timestamp(),
  unique(task_id,department_key)
);
alter table hq_private.department_staffing_needs enable row level security;
revoke all on hq_private.department_staffing_needs from public,anon,authenticated,service_role;
create trigger hq_department_staffing_need_immutable
  before update or delete on hq_private.department_staffing_needs
  for each row execute function hq_private.immutable_record();

create function hq_private.record_department_staffing_need() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_head text; v_department text; v_founder uuid;
begin
  if new.status<>'blocked' or new.error<>'staffing-required' or new.task_id is null then return new; end if;
  -- These IDs and tiers mirror the explicit current model-tier binding in the
  -- private Brain roster source. Unknown roles never acquire a staffing path.
  if new.agent_id in ('AG-HR-001','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001') then
    v_head:=new.agent_id;
  else
    select r.manager_id into v_head from hq_private.agent_roster r where r.id=new.agent_id;
  end if;
  if v_head not in ('AG-HR-001','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001') then return new; end if;
  select r.department_key into v_department from hq_private.agent_roster r where r.id=v_head and r.enabled;
  select t.founder_user_id into v_founder from public.hq_business_tasks t where t.id=new.task_id;
  if v_department is null or v_founder is null then return new; end if;
  insert into hq_private.department_staffing_needs(
    founder_user_id,task_id,department_key,department_head_id,blocked_job_id,blocked_agent_id,reason_code
  ) values(v_founder,new.task_id,v_department,v_head,new.id,new.agent_id,'no-eligible-worker')
  on conflict(task_id,department_key) do nothing;
  return new;
end $$;
revoke all on function hq_private.record_department_staffing_need() from public,anon,authenticated,service_role;
create trigger hq_department_staffing_need_after_block
  after update of status,error on public.hq_agent_jobs
  for each row when (new.status='blocked' and new.error='staffing-required')
  execute function hq_private.record_department_staffing_need();
