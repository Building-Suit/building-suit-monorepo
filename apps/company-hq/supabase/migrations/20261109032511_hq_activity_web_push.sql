-- Activity notifications are transactional. Browser subscriptions and delivery
-- work are private and have no direct Data API grants.
create table hq_private.push_devices (
  endpoint text primary key,
  user_id uuid not null,
  session_id uuid not null,
  p256dh text not null,
  auth_secret text not null
);
create index hq_push_devices_owner on hq_private.push_devices(user_id);
create table hq_private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null references hq_private.push_devices(endpoint) on delete cascade,
  activity text not null,
  created_at timestamptz not null default clock_timestamp(),
  available_at timestamptz not null default clock_timestamp(),
  lease uuid,
  attempts integer not null default 0
);
create index hq_push_available on hq_private.push_deliveries(available_at,id);
create index hq_push_endpoint on hq_private.push_deliveries(endpoint);
alter table hq_private.push_devices enable row level security;
alter table hq_private.push_deliveries enable row level security;
revoke all on hq_private.push_devices,hq_private.push_deliveries from public,anon,authenticated,service_role;

create function hq_private.manage_push_device(p_endpoint text,p_p256dh text,p_auth text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid := hq_private.founder_uid(); v_session uuid;
begin
  if v_user is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~
    '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:]#]+$'
    then raise exception 'HQ_INVALID_PUSH_ENDPOINT' using errcode='22023'; end if;
  if p_p256dh is null and p_auth is null then
    delete from hq_private.push_devices where endpoint=p_endpoint and user_id=v_user;
    return true;
  end if;
  if p_p256dh is null or p_auth is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth !~ '^[A-Za-z0-9_-]{22}$'
    then raise exception 'HQ_INVALID_PUSH_KEYS' using errcode='22023'; end if;
  v_session := (auth.jwt()->>'session_id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,481));
  delete from hq_private.push_devices d where d.user_id=v_user and not exists (
    select 1 from auth.sessions s where s.id=d.session_id and s.user_id=v_user
      and (s.not_after is null or s.not_after>clock_timestamp())
  );
  if (select count(*) from hq_private.push_devices where user_id=v_user and endpoint<>p_endpoint)>=8
    then raise exception 'HQ_PUSH_DEVICE_LIMIT' using errcode='22023'; end if;
  insert into hq_private.push_devices(endpoint,user_id,session_id,p256dh,auth_secret)
    values(p_endpoint,v_user,v_session,p_p256dh,p_auth)
    on conflict(endpoint) do update set session_id=excluded.session_id,p256dh=excluded.p256dh,auth_secret=excluded.auth_secret
    where push_devices.user_id=v_user;
  return found;
end;
$$;

create function hq_private.active_push_device(p_user uuid,p_session uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    join public.hq_founders f on f.user_id=u.id
    join hq_private.founder_invitations i on i.id=f.invitation_id
    where s.id=p_session and u.id=p_user and u.email_confirmed_at is not null
      and (s.not_after is null or s.not_after>statement_timestamp())
      and f.revoked_at is null and i.revoked_at is null and i.bound_user_id=u.id
      and lower(btrim(u.email))=i.email
  );
$$;

create function hq_private.capture_push_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_activity text := tg_argv[0]; v_owner uuid;
begin
  if tg_op='UPDATE' and tg_nargs=2
    and (to_jsonb(new)->tg_argv[1]) is not distinct from (to_jsonb(old)->tg_argv[1]) then return null; end if;
  if not exists(select 1 from hq_private.push_devices) then return null; end if;
  case tg_table_name
    when 'hq_agent_messages' then
      select founder_user_id into strict v_owner from public.hq_agent_conversations where id=new.conversation_id;
      v_activity := case when new.role='founder' then 'founder-message' else 'agent-message' end;
    when 'hq_meeting_events', 'hq_meeting_contributions' then
      select founder_id into strict v_owner from public.hq_meetings where id=new.meeting_id;
    when 'hq_task_artifacts' then
      select founder_user_id into strict v_owner from public.hq_agent_jobs where id=new.job_id;
    when 'hq_business_tasks', 'hq_agent_jobs', 'hq_agent_lessons', 'staffing_workflows' then
      v_owner := new.founder_user_id;
    when 'staffing_decisions' then
      v_owner := new.actor_user_id;
    when 'workforce_trials' then
      v_owner := new.requested_by;
    else null; -- Company-wide proposal, decision and Brain events.
  end case;
  insert into hq_private.push_deliveries(endpoint,activity)
    select d.endpoint,v_activity from hq_private.push_devices d
    where (v_owner is null or d.user_id=v_owner) and hq_private.active_push_device(d.user_id,d.session_id);
  return null;
end;
$$;

create trigger hq_push_activity after insert on public.hq_agent_messages
  for each row execute function hq_private.capture_push_activity('message');
create trigger hq_push_activity after insert or update of status on public.hq_business_tasks
  for each row execute function hq_private.capture_push_activity('task','status');
create trigger hq_push_activity after insert or update of status on public.hq_agent_jobs
  for each row execute function hq_private.capture_push_activity('agent-work','status');
create trigger hq_push_activity after insert on public.hq_plan_decisions
  for each row execute function hq_private.capture_push_activity('plan-decision');
create trigger hq_push_activity after insert or update of revision on public.hq_company_plans
  for each row execute function hq_private.capture_push_activity('plan','revision');
create trigger hq_push_activity after insert or update of status on hq_private.staffing_workflows
  for each row execute function hq_private.capture_push_activity('staffing','status');
create trigger hq_push_activity after insert on hq_private.staffing_decisions
  for each row execute function hq_private.capture_push_activity('staffing-decision');
create trigger hq_push_activity after insert on public.hq_meeting_events
  for each row execute function hq_private.capture_push_activity('meeting');
create trigger hq_push_activity after insert or update of status on public.hq_meeting_contributions
  for each row execute function hq_private.capture_push_activity('meeting-contribution','status');
create trigger hq_push_activity after insert on public.hq_task_artifacts
  for each row execute function hq_private.capture_push_activity('task-result');
create trigger hq_push_activity after insert or update of status on public.hq_agent_lessons
  for each row execute function hq_private.capture_push_activity('learning','status');
create trigger hq_push_activity after insert or update of status on hq_private.workforce_trials
  for each row execute function hq_private.capture_push_activity('trial','status');
create trigger hq_push_activity after update of content_digest on hq_private.brain_sync_state
  for each row execute function hq_private.capture_push_activity('brain','content_digest');

create function hq_private.claim_push_deliveries() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_jobs jsonb;
begin
  delete from hq_private.push_devices d where not hq_private.active_push_device(d.user_id,d.session_id);
  delete from hq_private.push_deliveries where created_at<clock_timestamp()-interval '24 hours' or (attempts>=6 and available_at<=clock_timestamp());
  with eligible as (
    select q.id from hq_private.push_deliveries q where q.available_at<=clock_timestamp()
    order by q.available_at,q.id limit 16 for update skip locked
  ), claimed as (
    update hq_private.push_deliveries q set lease=gen_random_uuid(),attempts=q.attempts+1,
      available_at=clock_timestamp()+interval '2 minutes'
    from eligible e where q.id=e.id returning q.id,q.lease,q.endpoint,q.activity
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'lease',c.lease,'activity',c.activity,
    'endpoint',c.endpoint,'p256dh',d.p256dh,'auth',d.auth_secret)),'[]'::jsonb)
  into v_jobs from claimed c join hq_private.push_devices d on d.endpoint=c.endpoint;
  return v_jobs;
end;
$$;

create function hq_private.finish_push_delivery(p_id uuid,p_lease uuid,p_result text) returns void
language plpgsql security definer set search_path='' as $$
declare v_job hq_private.push_deliveries;
begin
  select * into v_job from hq_private.push_deliveries where id=p_id and lease=p_lease for update;
  if not found then return; end if;
  if p_result='expired' then
    delete from hq_private.push_devices where endpoint=v_job.endpoint;
  elsif p_result in ('sent','discard') or v_job.attempts>=6 then
    delete from hq_private.push_deliveries where id=p_id;
  elsif p_result='retry' then
    update hq_private.push_deliveries set lease=null,available_at=clock_timestamp()+make_interval(mins=>v_job.attempts)
      where id=p_id;
  end if;
end;
$$;

create function public.hq_manage_push_device(p_endpoint text,p_p256dh text,p_auth text) returns boolean
language sql security invoker set search_path='' as $$ select hq_private.manage_push_device(p_endpoint,p_p256dh,p_auth); $$;
create function public.hq_claim_push_deliveries() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.claim_push_deliveries(); $$;
create function public.hq_finish_push_delivery(p_id uuid,p_lease uuid,p_result text) returns void
language sql security invoker set search_path='' as $$ select hq_private.finish_push_delivery(p_id,p_lease,p_result); $$;
revoke all on function hq_private.manage_push_device(text,text,text),public.hq_manage_push_device(text,text,text),
  hq_private.active_push_device(uuid,uuid),hq_private.capture_push_activity(),
  hq_private.claim_push_deliveries(),public.hq_claim_push_deliveries(),
  hq_private.finish_push_delivery(uuid,uuid,text),public.hq_finish_push_delivery(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.manage_push_device(text,text,text),public.hq_manage_push_device(text,text,text) to authenticated;
grant execute on function hq_private.claim_push_deliveries(),public.hq_claim_push_deliveries(),
  hq_private.finish_push_delivery(uuid,uuid,text),public.hq_finish_push_delivery(uuid,uuid,text) to service_role;

-- Operator-owned schedule, configured separately in the verified environment.
-- The schedule sends no HTTP request when there is no due notification.
create function hq_private.dispatch_push_deliveries(p_project_ref text) returns void
language plpgsql security definer set search_path='' as $$
declare v_token text;
begin
  if p_project_ref is null or p_project_ref not in ('dpruoncalmwicrqhqelu','nkpvskyugnnnozepbwzb')
    then raise exception 'HQ_INVALID_PUSH_PROJECT'; end if;
  if not exists(select 1 from hq_private.push_deliveries where available_at<=clock_timestamp()) then return; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name='hq_push_dispatch_token';
  if v_token is null then return; end if;
  perform net.http_post(url:='https://'||p_project_ref||'.supabase.co/functions/v1/hq-web-push',
    headers:=jsonb_build_object('Content-Type','application/json','X-HQ-Push-Token',v_token),
    body:='{}'::jsonb,timeout_milliseconds:=30000);
end;
$$;
revoke all on function hq_private.dispatch_push_deliveries(text) from public,anon,authenticated,service_role;

create function hq_private.check_push_device(p_endpoint text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_user uuid := hq_private.founder_uid();
begin
  if v_user is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  return exists(select 1 from hq_private.push_devices
    where endpoint=p_endpoint and user_id=v_user and session_id=(auth.jwt()->>'session_id')::uuid);
end;
$$;
create function public.hq_check_push_device(p_endpoint text) returns boolean
language sql security invoker set search_path='' as $$ select hq_private.check_push_device(p_endpoint); $$;
revoke all on function hq_private.check_push_device(text),public.hq_check_push_device(text) from public,anon,authenticated,service_role;
grant execute on function hq_private.check_push_device(text),public.hq_check_push_device(text) to authenticated;
