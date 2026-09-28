-- LS-ADMIN-001 / LS-D-ADMIN. Operator authority never derives from tenant roles.
create table app.platform_operators (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('observer','billing_operator')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
revoke all on app.platform_operators from public,anon,authenticated,service_role;
-- Preserve explicitly provisioned reviewer identities; dedicated-account checks apply below.
insert into app.platform_operators(user_id,role)
select user_id,'billing_operator' from app.manual_payment_operators;

create table app.platform_operator_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  operation text not null,
  target_id uuid,
  command_id uuid,
  reason text,
  context text,
  outcome text not null check (outcome in ('succeeded','rejected','replayed')),
  error_code text,
  parameters jsonb not null default '{}',
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default clock_timestamp()
);
create index platform_operator_audit_time on app.platform_operator_audit(occurred_at desc,id);
create unique index platform_operator_command_once on app.platform_operator_audit(actor_id,command_id)
  where outcome='succeeded' and command_id is not null;
revoke all on app.platform_operator_audit from public,anon,authenticated,service_role;
create function app.preserve_operator_audit() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'OPERATOR_AUDIT_IMMUTABLE' using errcode='42501'; end;
$$;
create trigger platform_operator_audit_immutable before update or delete or truncate on app.platform_operator_audit
  for each statement execute function app.preserve_operator_audit();
revoke all on function app.preserve_operator_audit() from public,anon,authenticated,service_role;

create function app.platform_operator_role() returns text language sql stable security definer set search_path='' as $$
  select o.role from app.platform_operators o
  where o.user_id=auth.uid() and o.enabled and auth.role()='authenticated'
    -- Dedicated operator identities cannot double as tenant identities (even inactive memberships).
    and not exists(select 1 from public.organization_members m where m.user_id=o.user_id);
$$;
revoke all on function app.platform_operator_role() from public,anon,authenticated,service_role;
create or replace function app.is_manual_payment_operator(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(app.platform_operator_role()='billing_operator',false)
    and not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid());
$$;
-- Retire the previous provisioning path; it cannot confer authority after this migration.
drop table app.manual_payment_operators;
-- Preserve the reviewed billing algorithm verbatim, but remove its unaudited API entry point.
alter function public.review_manual_payment(uuid,uuid,text,text) set schema app;
revoke all on function app.review_manual_payment(uuid,uuid,text,text) from public,anon,authenticated,service_role;

-- Global reads must go through the audited projection boundary. Tenant reads stay unchanged.
alter policy manual_requests_read on public.manual_payment_requests using (app.has_capability(organization_id,'billing.manage'));
alter policy manual_evidence_read on public.manual_payment_evidence using (app.has_capability(organization_id,'billing.manage'));
alter policy manual_history_read on public.manual_payment_history using (app.has_capability(organization_id,'billing.manage'));
alter policy manual_receipts_read on storage.objects using (
  bucket_id='manual-payment-receipts' and exists(select 1 from public.manual_payment_evidence e
    where e.storage_key=storage.objects.name and e.object_id=storage.objects.id and app.has_capability(e.organization_id,'billing.manage'))
);

-- Fixed projections only: never dynamic SQL, auth secrets, ledger rows, webhook payloads or tax details.
create function public.platform_admin_read(p_resource text,p_offset integer default 0,p_limit integer default 50,p_target_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text:=app.platform_operator_role(); v_data jsonb; v_error text; v_audit uuid;
begin
  if v_role is null then v_error:='OPERATOR_REQUIRED';
  elsif p_resource is null or p_resource not in ('identity','users','organizations','subscriptions','payments','payment_evidence','audit','status','support')
    or p_offset is null or p_offset<0 or p_offset>100000 or p_limit is null or p_limit not between 1 and 100 then v_error:='ADMIN_READ_INVALID';
  elsif p_resource='payment_evidence' and p_target_id is null then v_error:='ADMIN_READ_INVALID';
  end if;
  if v_error is null then
    case p_resource
    when 'identity' then v_data:=jsonb_build_array(jsonb_build_object('id',auth.uid(),'role',v_role));
    when 'users' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select id,email,full_name,created_at from public.profiles where p_target_id is null or id=p_target_id order by id limit p_limit offset p_offset
      ) r;
    when 'organizations' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select id,name,status,created_at from public.organizations where p_target_id is null or id=p_target_id order by id limit p_limit offset p_offset
      ) r;
    when 'subscriptions' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select s.id,s.organization_id,p.key as plan_key,s.status,s.provider,s.billing_interval,s.current_period_start,s.current_period_end,s.trial_ends_at
        from public.subscriptions s join public.subscription_plans p on p.id=s.plan_id
        where p_target_id is null or s.organization_id=p_target_id order by s.id limit p_limit offset p_offset
      ) r;
    when 'payments' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select id,organization_id,plan_key,billing_interval,amount_minor,currency_code,status,evidence_id,created_at,period_start,period_end
        from public.manual_payment_requests where p_target_id is null or id=p_target_id order by id limit p_limit offset p_offset
      ) r;
    when 'payment_evidence' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select e.id,e.request_id,e.filename,e.mime_type,e.size_bytes,e.sha256,e.storage_key,e.submitted_at
        from public.manual_payment_evidence e join public.manual_payment_requests p on p.id=e.request_id and p.evidence_id=e.id
        where p.id=p_target_id order by e.id limit p_limit offset p_offset
      ) r;
    when 'audit' then
      select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_data from (
        select id,actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,before_state,after_state,occurred_at
        from app.platform_operator_audit where p_target_id is null or target_id=p_target_id
        order by occurred_at desc,id limit p_limit offset p_offset
      ) r;
    when 'support' then v_data:='[]'; -- No support-request store exists in Ledger.
    when 'status' then
      v_data:=jsonb_build_array(jsonb_build_object('id','ledger','checked_at',clock_timestamp(),
        'pending_payments',(select count(*) from public.manual_payment_requests where status in ('submitted','under_review')),
        'unprocessed_billing_events',(select count(*) from public.billing_events where processed_at is null),
        'failed_billing_events',(select count(*) from public.billing_events where processing_error is not null),
        'support_available',false));
    end case;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,outcome,error_code,parameters)
  values(auth.uid(),v_role,'read.'||left(coalesce(p_resource,'invalid'),64),p_target_id,
    case when v_error is null then 'succeeded' else 'rejected' end,v_error,jsonb_build_object('offset',p_offset,'limit',p_limit)) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_data,'audit_id',v_audit);
end;
$$;

create function app.platform_payment_snapshot(p_request_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('payment',jsonb_build_object('id',r.id,'organization_id',r.organization_id,'status',r.status,
    'evidence_id',r.evidence_id,'plan_key',r.plan_key,'amount_minor',r.amount_minor,'currency_code',r.currency_code,
    'period_start',r.period_start,'period_end',r.period_end),
    'subscription',(select jsonb_build_object('id',s.id,'plan_id',s.plan_id,'price_id',s.price_id,'status',s.status,
      'provider',s.provider,'billing_interval',s.billing_interval,'current_period_start',s.current_period_start,
      'current_period_end',s.current_period_end,'cancel_at_period_end',s.cancel_at_period_end,
      'provider_subscription_id',s.provider_subscription_id,'provider_status',s.provider_status,
      'checkout_completed_at',s.checkout_completed_at,'last_payment_at',s.last_payment_at,
      'payment_failed_at',s.payment_failed_at,'grace_period_ends_at',s.grace_period_ends_at,'cancelled_at',s.cancelled_at)
      from public.subscriptions s where s.organization_id=r.organization_id))
  from public.manual_payment_requests r where r.id=p_request_id;
$$;
revoke all on function app.platform_payment_snapshot(uuid) from public,anon,authenticated,service_role;

create function public.platform_admin_review_payment(p_command_id uuid,p_request_id uuid,p_evidence_id uuid,p_action text,p_reason text,p_context text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_role text:=app.platform_operator_role(); v_error text; v_before jsonb; v_after jsonb; v_org uuid; v_audit uuid;
  v_prior app.platform_operator_audit; v_outcome text:='succeeded'; v_parameters jsonb;
begin
  -- Return rejections, do not raise them: the audit must survive the HTTP transaction.
  if v_role is distinct from 'billing_operator' then v_error:='OPERATOR_REQUIRED';
  elsif p_command_id is null or p_request_id is null or p_evidence_id is null
    or p_action is null or p_action not in ('under_review','approved','rejected')
    or p_reason is null or p_reason !~ '[^[:space:]]' or length(p_reason) not between 1 and 1000
    or p_context is null or p_context !~ '[^[:space:]]' or length(p_context) not between 1 and 1000 then v_error:='ADMIN_COMMAND_INVALID';
  end if;
  v_parameters:=jsonb_build_object('request_id',p_request_id,'evidence_id',p_evidence_id,'action',left(p_action,64),
    'reason',left(p_reason,1000),'context',left(p_context,1000));
  if v_error is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_command_id::text,0));
    select * into v_prior from app.platform_operator_audit where actor_id=auth.uid() and command_id=p_command_id and outcome='succeeded';
    if found then
      if v_prior.parameters is distinct from v_parameters then v_error:='ADMIN_COMMAND_KEY_REUSED';
      else v_outcome:='replayed'; v_before:=v_prior.before_state; v_after:=v_prior.after_state; end if;
    else
      begin
        select organization_id into v_org from public.manual_payment_requests where id=p_request_id;
        if v_org is null then raise exception 'ADMIN_TARGET_NOT_FOUND' using errcode='22023'; end if;
        -- Same lock order as LS-BILL-002; snapshots correspond to the serialized mutation.
        perform 1 from public.organizations where id=v_org for update;
        perform 1 from public.manual_payment_requests where id=p_request_id for update;
        perform 1 from public.subscriptions where organization_id=v_org for update;
        v_before:=app.platform_payment_snapshot(p_request_id);
        perform app.review_manual_payment(p_request_id,p_evidence_id,p_action,btrim(p_reason));
        v_after:=app.platform_payment_snapshot(p_request_id);
      exception when others then
        v_error:=case when sqlerrm in ('ADMIN_TARGET_NOT_FOUND','MANUAL_PAYMENT_OPERATOR_REQUIRED','MANUAL_PAYMENT_REVIEW_INVALID',
          'MANUAL_PAYMENT_STALE_EVIDENCE','MANUAL_PAYMENT_INVALID_STATE','MANUAL_PAYMENT_SUBSCRIPTION_CONFLICT') then sqlerrm else 'ADMIN_COMMAND_FAILED' end;
        v_after:=v_before;
      end;
    end if;
  end if;
  insert into app.platform_operator_audit(actor_id,actor_role,operation,target_id,command_id,reason,context,outcome,error_code,parameters,before_state,after_state)
  values(auth.uid(),v_role,'payment.review',p_request_id,p_command_id,left(p_reason,1000),left(p_context,1000),
    case when v_error is null then v_outcome else 'rejected' end,v_error,v_parameters,v_before,v_after) returning id into v_audit;
  if v_error is not null then return jsonb_build_object('ok',false,'error',v_error,'audit_id',v_audit); end if;
  return jsonb_build_object('ok',true,'data',v_after,'replayed',v_outcome='replayed','audit_id',v_audit);
end;
$$;
revoke all on function public.platform_admin_read(text,integer,integer,uuid),public.platform_admin_review_payment(uuid,uuid,uuid,text,text,text) from public,anon,service_role;
grant execute on function public.platform_admin_read(text,integer,integer,uuid),public.platform_admin_review_payment(uuid,uuid,uuid,text,text,text) to authenticated;
