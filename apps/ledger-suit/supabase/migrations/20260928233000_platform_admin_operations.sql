-- LS-ADMIN-002 / LS-D-ADMIN. Bounded commercial operations only: no raw
-- financial-history mutation, provider impersonation, or tenant-derived authority.

alter table app.platform_operators drop constraint platform_operators_role_check;
alter table app.platform_operators add constraint platform_operators_role_check
  check (role in ('observer','billing_operator','platform_admin'));

create or replace function app.is_manual_payment_operator(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(app.platform_operator_role() in ('billing_operator','platform_admin'),false)
    and not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid());
$$;

create table app.platform_access_overrides (
  organization_id uuid primary key references public.organizations(id),
  suspended boolean not null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default clock_timestamp()
);
revoke all on app.platform_access_overrides from public,anon,authenticated,service_role;

-- An operator suspension makes product writes read-only without rewriting the
-- provider subscription, paid period, organization state, or accounting rows.
create or replace function app.subscription_access_state(p_organization_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when exists(select 1 from app.platform_access_overrides o
      where o.organization_id=p_organization_id and o.suspended) then 'read_only'
    else coalesce((
      select case
        when s.status='trialing' and s.trial_ends_at is not null and s.trial_ends_at>now() then 'trialing'
        when s.status='active' and (s.current_period_end is null or s.current_period_end>now()) then 'active'
        when s.status in ('past_due','grace_period') and s.grace_period_ends_at is not null and s.grace_period_ends_at>now() then 'grace_period'
        else 'read_only'
      end from public.subscriptions s where s.organization_id=p_organization_id
    ),'checkout_required')
  end;
$$;

create type public.support_request_status as enum ('open','in_progress','waiting_customer','resolved','closed');
create type public.support_request_priority as enum ('normal','high','urgent');
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  requester_id uuid references public.profiles(id),
  requester_email extensions.citext not null,
  subject text not null check (length(btrim(subject)) between 1 and 200),
  customer_message text not null check (length(btrim(customer_message)) between 1 and 10000),
  status public.support_request_status not null default 'open',
  priority public.support_request_priority not null default 'normal',
  reminder_count integer not null default 0 check (reminder_count>=0),
  last_reminder_requested_at timestamptz,
  reminder_delivery_status text not null default 'not_configured'
    check (reminder_delivery_status in ('not_configured')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);
create index support_requests_queue on public.support_requests(status,priority,created_at,id);
create index support_requests_organization on public.support_requests(organization_id,created_at desc);
create trigger support_requests_set_updated_at before update on public.support_requests
  for each row execute function app.set_updated_at();
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public,anon,authenticated,service_role;

create function app.preserve_support_request_content() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    raise exception 'SUPPORT_REQUEST_CONTENT_IMMUTABLE' using errcode='42501';
  end if;
  if new.organization_id is distinct from old.organization_id or new.requester_id is distinct from old.requester_id
    or new.requester_email is distinct from old.requester_email
    or new.subject is distinct from old.subject or new.customer_message is distinct from old.customer_message
    or new.created_at is distinct from old.created_at then
    raise exception 'SUPPORT_REQUEST_CONTENT_IMMUTABLE' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger support_request_content_immutable before update or delete on public.support_requests
  for each row execute function app.preserve_support_request_content();
revoke all on function app.preserve_support_request_content() from public,anon,authenticated,service_role;

create function app.platform_organization_snapshot(p_organization_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'organization',jsonb_build_object('id',o.id,'status',o.status),
    'access',jsonb_build_object('state',app.subscription_access_state(o.id),
      'operator_suspended',coalesce(x.suspended,false),'changed_at',x.changed_at),
    'subscription',case when s.id is null then null else jsonb_build_object(
      'id',s.id,'plan_key',p.key,'status',s.status,'provider',s.provider,
      'billing_interval',s.billing_interval,'current_period_start',s.current_period_start,
      'current_period_end',s.current_period_end,'provider_subscription_id',s.provider_subscription_id) end)
  from public.organizations o
  left join public.subscriptions s on s.organization_id=o.id
  left join public.subscription_plans p on p.id=s.plan_id
  left join app.platform_access_overrides x on x.organization_id=o.id
  where o.id=p_organization_id;
$$;
revoke all on function app.platform_organization_snapshot(uuid) from public,anon,authenticated,service_role;

create function app.platform_support_snapshot(p_request_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',r.id,'organization_id',r.organization_id,'status',r.status,
    'priority',r.priority,'reminder_count',r.reminder_count,
    'last_reminder_requested_at',r.last_reminder_requested_at,
    'reminder_delivery_status',r.reminder_delivery_status,'resolved_at',r.resolved_at,'closed_at',r.closed_at)
  from public.support_requests r where r.id=p_request_id;
$$;
revoke all on function app.platform_support_snapshot(uuid) from public,anon,authenticated,service_role;

-- Replace the foundation projection with searchable, filterable fixed queries.
drop function public.platform_admin_read(text,integer,integer,uuid);
create function public.platform_admin_read(
  p_resource text,p_offset integer default 0,p_limit integer default 50,p_target_id uuid default null,
  p_search text default null,p_status text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role text:=app.platform_operator_role(); v_data jsonb; v_error text; v_audit uuid;
  v_search text:=nullif(btrim(p_search),''); v_status text:=nullif(btrim(p_status),'');
begin
  if v_role is null then v_error:='OPERATOR_REQUIRED';
  elsif p_resource is null or p_resource not in ('identity','users','organizations','memberships','subscriptions','payments','payment_evidence','audit','status','support')
    or p_offset is null or p_offset<0 or p_offset>100000 or p_limit is null or p_limit not between 1 and 100
    or length(coalesce(v_search,''))>100 or length(coalesce(v_status,''))>64 then v_error:='ADMIN_READ_INVALID';
  elsif p_resource='payment_evidence' and p_target_id is null then v_error:='ADMIN_READ_INVALID';
  end if;
  if v_error is null then
    case p_resource
    when 'identity' then v_data:=jsonb_build_array(jsonb_build_object('id',auth.uid(),'role',v_role));
    when 'users' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select p.id,p.email,p.full_name,p.created_at,count(m.id)::integer as membership_count
        from public.profiles p left join public.organization_members m on m.user_id=p.id
        where (p_target_id is null or p.id=p_target_id)
          and (v_search is null or p.id::text ilike '%'||v_search||'%' or p.email ilike '%'||v_search||'%' or coalesce(p.full_name,'') ilike '%'||v_search||'%')
          and (v_status is null or exists(select 1 from public.organization_members sm where sm.user_id=p.id and sm.status::text=v_status))
        group by p.id,p.email,p.full_name,p.created_at order by p.id limit p_limit offset p_offset
      ) r;
    when 'organizations' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select o.id,o.name,o.status,app.subscription_access_state(o.id) as access_state,
          coalesce(x.suspended,false) as operator_suspended,p.key as plan_key,s.status as subscription_status,
          count(distinct m.id)::integer as member_count,count(distinct pay.id)::integer as pending_payment_count,
          count(distinct sr.id)::integer as open_support_count,o.created_at
        from public.organizations o
        left join public.subscriptions s on s.organization_id=o.id left join public.subscription_plans p on p.id=s.plan_id
        left join app.platform_access_overrides x on x.organization_id=o.id
        left join public.organization_members m on m.organization_id=o.id
        left join public.manual_payment_requests pay on pay.organization_id=o.id and pay.status in ('submitted','under_review')
        left join public.support_requests sr on sr.organization_id=o.id and sr.status not in ('resolved','closed')
        where (p_target_id is null or o.id=p_target_id)
          and (v_search is null or o.id::text ilike '%'||v_search||'%' or o.name ilike '%'||v_search||'%')
          and (v_status is null or o.status::text=v_status or s.status::text=v_status or app.subscription_access_state(o.id)=v_status)
        group by o.id,o.name,o.status,x.suspended,p.key,s.status,o.created_at order by o.id limit p_limit offset p_offset
      ) r;
    when 'memberships' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select m.id,m.organization_id,o.name as organization_name,m.user_id,p.email,p.full_name,m.role,m.status,m.joined_at
        from public.organization_members m join public.organizations o on o.id=m.organization_id join public.profiles p on p.id=m.user_id
        where (p_target_id is null or m.id=p_target_id or m.organization_id=p_target_id or m.user_id=p_target_id)
          and (v_search is null or o.name ilike '%'||v_search||'%' or p.email ilike '%'||v_search||'%' or coalesce(p.full_name,'') ilike '%'||v_search||'%')
          and (v_status is null or m.status::text=v_status or m.role::text=v_status)
        order by m.id limit p_limit offset p_offset
      ) r;
    when 'subscriptions' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select s.id,s.organization_id,o.name as organization_name,p.key as plan_key,s.status,s.provider,s.provider_status,
          s.billing_interval,s.current_period_start,s.current_period_end,s.trial_ends_at,
          app.subscription_access_state(s.organization_id) as access_state,coalesce(x.suspended,false) as operator_suspended
        from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id join public.organizations o on o.id=s.organization_id
        left join app.platform_access_overrides x on x.organization_id=s.organization_id
        where (p_target_id is null or s.id=p_target_id or s.organization_id=p_target_id)
          and (v_search is null or s.id::text ilike '%'||v_search||'%' or o.name ilike '%'||v_search||'%' or p.key ilike '%'||v_search||'%')
          and (v_status is null or s.status::text=v_status or app.subscription_access_state(s.organization_id)=v_status or coalesce(s.provider,'none')=v_status)
        order by s.id limit p_limit offset p_offset
      ) r;
    when 'payments' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select pay.id,pay.organization_id,o.name as organization_name,pay.plan_key,pay.billing_interval,pay.amount_minor,
          pay.currency_code,pay.status,pay.evidence_id,pay.created_at,pay.period_start,pay.period_end
        from public.manual_payment_requests pay join public.organizations o on o.id=pay.organization_id
        where (p_target_id is null or pay.id=p_target_id or pay.organization_id=p_target_id)
          and (v_search is null or pay.id::text ilike '%'||v_search||'%' or o.name ilike '%'||v_search||'%' or pay.plan_key ilike '%'||v_search||'%')
          and (v_status is null or pay.status=v_status)
        order by pay.id limit p_limit offset p_offset
      ) r;
    when 'payment_evidence' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select e.id,e.request_id,e.filename,e.mime_type,e.size_bytes,e.sha256,e.storage_key,e.submitted_at
        from public.manual_payment_evidence e join public.manual_payment_requests p on p.id=e.request_id and p.evidence_id=e.id
        where p.id=p_target_id order by e.id limit p_limit offset p_offset
      ) r;
    when 'support' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select sr.id,sr.organization_id,o.name as organization_name,sr.requester_id,sr.requester_email,sr.subject,
          sr.customer_message,sr.status,sr.priority,sr.reminder_count,sr.last_reminder_requested_at,
          sr.reminder_delivery_status,sr.created_at,sr.updated_at,sr.resolved_at,sr.closed_at
        from public.support_requests sr left join public.organizations o on o.id=sr.organization_id
        where (p_target_id is null or sr.id=p_target_id or sr.organization_id=p_target_id or sr.requester_id=p_target_id)
          and (v_search is null or sr.id::text ilike '%'||v_search||'%' or sr.requester_email ilike '%'||v_search||'%'
            or sr.subject ilike '%'||v_search||'%' or coalesce(o.name,'') ilike '%'||v_search||'%')
          and (v_status is null or sr.status::text=v_status or sr.priority::text=v_status)
        order by case sr.priority when 'urgent' then 1 when 'high' then 2 else 3 end,sr.created_at,sr.id limit p_limit offset p_offset
      ) r;
    when 'audit' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select id,actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,before_state,after_state,occurred_at
        from app.platform_operator_audit
        where (p_target_id is null or target_id=p_target_id)
          and (v_search is null or operation ilike '%'||v_search||'%' or coalesce(reason,'') ilike '%'||v_search||'%' or coalesce(context,'') ilike '%'||v_search||'%')
          and (v_status is null or outcome=v_status or coalesce(error_code,'')=v_status)
        order by occurred_at desc,id limit p_limit offset p_offset
      ) r;
    when 'status' then
      v_data:=jsonb_build_array(jsonb_build_object('id','ledger','checked_at',clock_timestamp(),
        'pending_payments',(select count(*) from public.manual_payment_requests where status in ('submitted','under_review')),
        'unprocessed_billing_events',(select count(*) from public.billing_events where processed_at is null),
        'failed_billing_events',(select count(*) from public.billing_events where processing_error is not null),
        'open_support_requests',(select count(*) from public.support_requests where status not in ('resolved','closed')),
        'suspended_organizations',(select count(*) from app.platform_access_overrides where suspended),
        'support_available',true,'support_reminder_delivery','not_configured'));
    end case;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,outcome,error_code,parameters)
  values(auth.uid(),v_role,'read.'||left(coalesce(p_resource,'invalid'),64),p_target_id,
    case when v_error is null then 'succeeded' else 'rejected' end,v_error,
    jsonb_build_object('offset',p_offset,'limit',p_limit,'search',left(v_search,100),'status',left(v_status,64))) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_data,'audit_id',v_audit);
end;
$$;

create function public.platform_admin_set_access(
  p_command_id uuid,p_organization_id uuid,p_action text,p_reason text,p_context text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=app.platform_operator_role(); v_error text; v_before jsonb; v_after jsonb; v_audit uuid;
  v_prior app.platform_operator_audit; v_outcome text:='succeeded'; v_parameters jsonb;
begin
  if v_role is distinct from 'platform_admin' then v_error:='OPERATOR_REQUIRED';
  elsif p_command_id is null or p_organization_id is null or p_action not in ('suspend','reactivate')
    or p_reason is null or p_reason !~ '[^[:space:]]' or length(p_reason) not between 1 and 1000
    or p_context is null or p_context !~ '[^[:space:]]' or length(p_context) not between 1 and 1000 then v_error:='ADMIN_COMMAND_INVALID'; end if;
  v_parameters:=jsonb_build_object('organization_id',p_organization_id,'action',left(p_action,64),'reason',left(p_reason,1000),'context',left(p_context,1000));
  if v_error is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_command_id::text,0));
    select * into v_prior from app.platform_operator_audit where actor_id=auth.uid() and command_id=p_command_id and outcome='succeeded';
    if found then
      if v_prior.operation<>'access.'||p_action or v_prior.parameters is distinct from v_parameters then v_error:='ADMIN_COMMAND_KEY_REUSED';
      else v_outcome:='replayed'; v_before:=v_prior.before_state; v_after:=v_prior.after_state; end if;
    else begin
      perform 1 from public.organizations where id=p_organization_id for update;
      if not found then raise exception 'ADMIN_TARGET_NOT_FOUND' using errcode='22023'; end if;
      perform 1 from public.subscriptions where organization_id=p_organization_id for update;
      v_before:=app.platform_organization_snapshot(p_organization_id);
      insert into app.platform_access_overrides(organization_id,suspended,reason,changed_by,changed_at)
      values(p_organization_id,p_action='suspend',btrim(p_reason),auth.uid(),clock_timestamp())
      on conflict(organization_id) do update set suspended=excluded.suspended,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=excluded.changed_at;
      v_after:=app.platform_organization_snapshot(p_organization_id);
    exception when others then v_error:=case when sqlerrm='ADMIN_TARGET_NOT_FOUND' then sqlerrm else 'ADMIN_COMMAND_FAILED' end; v_after:=v_before; end; end if;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,parameters,before_state,after_state)
  values(auth.uid(),v_role,'access.'||left(coalesce(p_action,'invalid'),64),p_organization_id,p_command_id,left(p_reason,1000),left(p_context,1000),
    case when v_error is null then v_outcome else 'rejected' end,v_error,v_parameters,v_before,v_after) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_after,'replayed',v_outcome='replayed','audit_id',v_audit);
end;
$$;

create function public.platform_admin_correct_subscription(
  p_command_id uuid,p_organization_id uuid,p_target_plan_key text,p_reason text,p_context text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=app.platform_operator_role(); v_error text; v_before jsonb; v_after jsonb; v_audit uuid;
  v_prior app.platform_operator_audit; v_outcome text:='succeeded'; v_parameters jsonb; v_subscription public.subscriptions; v_plan uuid; v_price uuid;
begin
  if v_role is distinct from 'platform_admin' then v_error:='OPERATOR_REQUIRED';
  elsif p_command_id is null or p_organization_id is null or p_target_plan_key not in ('solo','starter','business')
    or p_reason is null or p_reason !~ '[^[:space:]]' or length(p_reason) not between 1 and 1000
    or p_context is null or p_context !~ '[^[:space:]]' or length(p_context) not between 1 and 1000 then v_error:='ADMIN_COMMAND_INVALID'; end if;
  v_parameters:=jsonb_build_object('organization_id',p_organization_id,'target_plan_key',left(p_target_plan_key,64),'reason',left(p_reason,1000),'context',left(p_context,1000));
  if v_error is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_command_id::text,0));
    select * into v_prior from app.platform_operator_audit where actor_id=auth.uid() and command_id=p_command_id and outcome='succeeded';
    if found then
      if v_prior.operation<>'subscription.correct' or v_prior.parameters is distinct from v_parameters then v_error:='ADMIN_COMMAND_KEY_REUSED';
      else v_outcome:='replayed'; v_before:=v_prior.before_state; v_after:=v_prior.after_state; end if;
    else begin
      perform 1 from public.organizations where id=p_organization_id for update;
      if not found then raise exception 'ADMIN_TARGET_NOT_FOUND' using errcode='22023'; end if;
      select * into v_subscription from public.subscriptions where organization_id=p_organization_id for update;
      if not found then raise exception 'ADMIN_TARGET_NOT_FOUND' using errcode='22023'; end if;
      v_before:=app.platform_organization_snapshot(p_organization_id);
      if v_subscription.provider is distinct from 'manual' then raise exception 'ADMIN_PROVIDER_CHANGE_UNSAFE' using errcode='22023'; end if;
      if v_subscription.billing_interval is null then raise exception 'ADMIN_SUBSCRIPTION_CORRECTION_UNSAFE' using errcode='22023'; end if;
      select r.plan_id,r.price_id into v_plan,v_price from app.resolve_purchasable_plan(p_target_plan_key,v_subscription.billing_interval,'EGP') r;
      if v_plan is null or v_price is null then raise exception 'ADMIN_SUBSCRIPTION_CORRECTION_UNSAFE' using errcode='22023'; end if;
      update public.subscriptions set plan_id=v_plan,price_id=v_price where id=v_subscription.id;
      v_after:=app.platform_organization_snapshot(p_organization_id);
    exception when others then
      v_error:=case when sqlerrm in ('ADMIN_TARGET_NOT_FOUND','ADMIN_PROVIDER_CHANGE_UNSAFE','ADMIN_SUBSCRIPTION_CORRECTION_UNSAFE','PLAN_NOT_AVAILABLE','PLAN_PRICE_NOT_AVAILABLE') then sqlerrm else 'ADMIN_COMMAND_FAILED' end;
      v_after:=v_before;
    end; end if;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,parameters,before_state,after_state)
  values(auth.uid(),v_role,'subscription.correct',p_organization_id,p_command_id,left(p_reason,1000),left(p_context,1000),
    case when v_error is null then v_outcome else 'rejected' end,v_error,v_parameters,v_before,v_after) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_after,'replayed',v_outcome='replayed','audit_id',v_audit);
end;
$$;

create function public.platform_admin_update_support(
  p_command_id uuid,p_request_id uuid,p_action text,p_reason text,p_context text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=app.platform_operator_role(); v_error text; v_before jsonb; v_after jsonb; v_audit uuid;
  v_prior app.platform_operator_audit; v_outcome text:='succeeded'; v_parameters jsonb; v_request public.support_requests;
begin
  if v_role is distinct from 'platform_admin' then v_error:='OPERATOR_REQUIRED';
  elsif p_command_id is null or p_request_id is null or p_action not in ('start','wait_customer','resolve','close','reopen','remind')
    or p_reason is null or p_reason !~ '[^[:space:]]' or length(p_reason) not between 1 and 1000
    or p_context is null or p_context !~ '[^[:space:]]' or length(p_context) not between 1 and 1000 then v_error:='ADMIN_COMMAND_INVALID'; end if;
  v_parameters:=jsonb_build_object('request_id',p_request_id,'action',left(p_action,64),'reason',left(p_reason,1000),'context',left(p_context,1000));
  if v_error is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_command_id::text,0));
    select * into v_prior from app.platform_operator_audit where actor_id=auth.uid() and command_id=p_command_id and outcome='succeeded';
    if found then
      if v_prior.operation<>'support.'||p_action or v_prior.parameters is distinct from v_parameters then v_error:='ADMIN_COMMAND_KEY_REUSED';
      else v_outcome:='replayed'; v_before:=v_prior.before_state; v_after:=v_prior.after_state; end if;
    else begin
      select * into v_request from public.support_requests where id=p_request_id for update;
      if not found then raise exception 'ADMIN_TARGET_NOT_FOUND' using errcode='22023'; end if;
      v_before:=app.platform_support_snapshot(p_request_id);
      if p_action='start' and v_request.status not in ('open','waiting_customer') then raise exception 'ADMIN_SUPPORT_INVALID_STATE' using errcode='22023';
      elsif p_action='wait_customer' and v_request.status not in ('open','in_progress') then raise exception 'ADMIN_SUPPORT_INVALID_STATE' using errcode='22023';
      elsif p_action='resolve' and v_request.status not in ('open','in_progress','waiting_customer') then raise exception 'ADMIN_SUPPORT_INVALID_STATE' using errcode='22023';
      elsif p_action='close' and v_request.status='closed' then raise exception 'ADMIN_SUPPORT_INVALID_STATE' using errcode='22023';
      elsif p_action='reopen' and v_request.status not in ('resolved','closed') then raise exception 'ADMIN_SUPPORT_INVALID_STATE' using errcode='22023';
      elsif p_action='remind' and v_request.status not in ('in_progress','waiting_customer') then raise exception 'ADMIN_SUPPORT_INVALID_STATE' using errcode='22023'; end if;
      update public.support_requests set
        status=case p_action when 'start' then 'in_progress'::public.support_request_status when 'wait_customer' then 'waiting_customer'::public.support_request_status
          when 'resolve' then 'resolved'::public.support_request_status when 'close' then 'closed'::public.support_request_status
          when 'reopen' then 'open'::public.support_request_status else status end,
        reminder_count=reminder_count+case when p_action='remind' then 1 else 0 end,
        last_reminder_requested_at=case when p_action='remind' then clock_timestamp() else last_reminder_requested_at end,
        reminder_delivery_status='not_configured',
        resolved_at=case when p_action='resolve' then clock_timestamp() when p_action='reopen' then null else resolved_at end,
        closed_at=case when p_action='close' then clock_timestamp() when p_action='reopen' then null else closed_at end
      where id=p_request_id;
      v_after:=app.platform_support_snapshot(p_request_id);
    exception when others then v_error:=case when sqlerrm in ('ADMIN_TARGET_NOT_FOUND','ADMIN_SUPPORT_INVALID_STATE') then sqlerrm else 'ADMIN_COMMAND_FAILED' end; v_after:=v_before; end; end if;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,parameters,before_state,after_state)
  values(auth.uid(),v_role,'support.'||left(coalesce(p_action,'invalid'),64),p_request_id,p_command_id,left(p_reason,1000),left(p_context,1000),
    case when v_error is null then v_outcome else 'rejected' end,v_error,v_parameters,v_before,v_after) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_after,'replayed',v_outcome='replayed','audit_id',v_audit);
end;
$$;

-- Platform admins inherit the existing audited manual-payment command; billing
-- operators retain payment-only authority.
create or replace function public.platform_admin_review_payment(p_command_id uuid,p_request_id uuid,p_evidence_id uuid,p_action text,p_reason text,p_context text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role text:=app.platform_operator_role(); v_error text; v_before jsonb; v_after jsonb; v_org uuid; v_audit uuid;
  v_prior app.platform_operator_audit; v_outcome text:='succeeded'; v_parameters jsonb;
begin
  if v_role is null or v_role not in ('billing_operator','platform_admin') then v_error:='OPERATOR_REQUIRED';
  elsif p_command_id is null or p_request_id is null or p_evidence_id is null
    or p_action is null or p_action not in ('under_review','approved','rejected')
    or p_reason is null or p_reason !~ '[^[:space:]]' or length(p_reason) not between 1 and 1000
    or p_context is null or p_context !~ '[^[:space:]]' or length(p_context) not between 1 and 1000 then v_error:='ADMIN_COMMAND_INVALID'; end if;
  v_parameters:=jsonb_build_object('request_id',p_request_id,'evidence_id',p_evidence_id,'action',left(p_action,64),'reason',left(p_reason,1000),'context',left(p_context,1000));
  if v_error is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_command_id::text,0));
    select * into v_prior from app.platform_operator_audit where actor_id=auth.uid() and command_id=p_command_id and outcome='succeeded';
    if found then
      if v_prior.operation<>'payment.review' or v_prior.parameters is distinct from v_parameters then v_error:='ADMIN_COMMAND_KEY_REUSED';
      else v_outcome:='replayed'; v_before:=v_prior.before_state; v_after:=v_prior.after_state; end if;
    else begin
      select organization_id into v_org from public.manual_payment_requests where id=p_request_id;
      if v_org is null then raise exception 'ADMIN_TARGET_NOT_FOUND' using errcode='22023'; end if;
      perform 1 from public.organizations where id=v_org for update;
      perform 1 from public.manual_payment_requests where id=p_request_id for update;
      perform 1 from public.subscriptions where organization_id=v_org for update;
      v_before:=app.platform_payment_snapshot(p_request_id);
      perform app.review_manual_payment(p_request_id,p_evidence_id,p_action,btrim(p_reason));
      v_after:=app.platform_payment_snapshot(p_request_id);
    exception when others then
      v_error:=case when sqlerrm in ('ADMIN_TARGET_NOT_FOUND','MANUAL_PAYMENT_OPERATOR_REQUIRED','MANUAL_PAYMENT_REVIEW_INVALID','MANUAL_PAYMENT_STALE_EVIDENCE','MANUAL_PAYMENT_INVALID_STATE','MANUAL_PAYMENT_SUBSCRIPTION_CONFLICT') then sqlerrm else 'ADMIN_COMMAND_FAILED' end;
      v_after:=v_before;
    end; end if;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,parameters,before_state,after_state)
  values(auth.uid(),v_role,'payment.review',p_request_id,p_command_id,left(p_reason,1000),left(p_context,1000),case when v_error is null then v_outcome else 'rejected' end,v_error,v_parameters,v_before,v_after) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_after,'replayed',v_outcome='replayed','audit_id',v_audit);
end;
$$;

revoke all on function public.platform_admin_read(text,integer,integer,uuid,text,text),
  public.platform_admin_set_access(uuid,uuid,text,text,text),
  public.platform_admin_correct_subscription(uuid,uuid,text,text,text),
  public.platform_admin_update_support(uuid,uuid,text,text,text) from public,anon,service_role;
grant execute on function public.platform_admin_read(text,integer,integer,uuid,text,text),
  public.platform_admin_set_access(uuid,uuid,text,text,text),
  public.platform_admin_correct_subscription(uuid,uuid,text,text,text),
  public.platform_admin_update_support(uuid,uuid,text,text,text) to authenticated;
