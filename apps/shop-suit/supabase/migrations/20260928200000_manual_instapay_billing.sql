-- SS-BILLING-001: canonical 14-day trials and manually reconciled InstaPay
-- subscription notices. Existing trial deadlines are deliberately untouched.

alter table public.plans alter column trial_days set default 14;
update public.plans plan
set trial_days = 14, updated_at = now()
where plan.portal_id = (
  select portal.id from public.portals portal where portal.key = 'shop-crm'
)
and plan.trial_days is distinct from 14;

create function shop_private.enforce_shop_trial_policy()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.portals portal
    where portal.id = new.portal_id and portal.key = 'shop-crm'
  ) and new.trial_days <> 14 then
    raise exception 'SHOP_TRIAL_DAYS_MUST_BE_14' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger plans_shop_trial_policy
before insert or update of portal_id, trial_days on public.plans
for each row execute function shop_private.enforce_shop_trial_policy();

create table public.shop_billing_configuration (
  singleton boolean primary key default true check (singleton),
  recipient_alias text,
  payment_link text,
  qr_image_url text,
  instructions_en text not null default '',
  instructions_ar text not null default '',
  updated_by_user_id uuid references auth.users (id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  check (recipient_alias is null or length(btrim(recipient_alias)) between 2 and 200),
  check (payment_link is null or (length(btrim(payment_link)) between 8 and 1000 and payment_link ~ '^https://')),
  check (qr_image_url is null or (length(btrim(qr_image_url)) between 8 and 1000 and qr_image_url ~ '^https://')),
  check (length(instructions_en) <= 2000),
  check (length(instructions_ar) <= 2000)
);

insert into public.shop_billing_configuration (singleton) values (true);

alter table public.shop_billing_submissions
  drop constraint shop_billing_submissions_status_check;

update public.shop_billing_submissions
set status = case status when 'pending' then 'submitted' when 'cancelled' then 'rejected' else status end;

alter table public.shop_billing_submissions
  alter column status set default 'submitted',
  add constraint shop_billing_submissions_status_check
    check (status in ('submitted', 'under_review', 'approved', 'rejected')),
  add column request_id uuid,
  add column plan_id uuid references public.plans (id) on delete restrict,
  add column expected_amount numeric(12, 2),
  add column paid_amount numeric(12, 2),
  add column transfer_date date,
  add column transfer_reference text,
  add column review_reason text,
  add column reviewed_by_user_id uuid references auth.users (id) on delete restrict,
  add column received_amount numeric(12, 2),
  add column received_reference text,
  add column received_date date,
  add column activation_days integer,
  add column approved_subscription_end timestamptz,
  add constraint shop_billing_expected_amount_positive
    check (expected_amount is null or expected_amount > 0),
  add constraint shop_billing_paid_amount_positive
    check (paid_amount is null or paid_amount > 0),
  add constraint shop_billing_received_amount_positive
    check (received_amount is null or received_amount > 0),
  add constraint shop_billing_transfer_reference_length
    check (transfer_reference is null or length(btrim(transfer_reference)) between 2 and 200),
  add constraint shop_billing_received_reference_length
    check (received_reference is null or length(btrim(received_reference)) between 2 and 200),
  add constraint shop_billing_review_reason_length
    check (review_reason is null or length(btrim(review_reason)) between 2 and 1000),
  add constraint shop_billing_activation_days_range
    check (activation_days is null or activation_days between 1 and 3660);

create unique index shop_billing_submissions_request_idx
  on public.shop_billing_submissions (request_id) where request_id is not null;
drop index public.shop_billing_submissions_pending_idx;
create index shop_billing_submissions_review_queue_idx
  on public.shop_billing_submissions (submitted_at, id)
  where status in ('submitted', 'under_review');

update public.shop_billing_submissions submission
set plan_id = subscription.plan_id,
    expected_amount = coalesce(submission.amount, plan.price_amount),
    paid_amount = coalesce(submission.amount, plan.price_amount),
    transfer_reference = coalesce(submission.reference, 'legacy-' || submission.id::text),
    transfer_date = submission.submitted_at::date
from public.shop_memberships membership
join public.subscriptions subscription on subscription.profile_id = membership.profile_id
join public.plans plan on plan.id = subscription.plan_id
where membership.shop_id = submission.shop_id
  and membership.role = 'owner'
  and submission.plan_id is null;

create table public.platform_billing_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  actor_role text not null check (actor_role = 'operator'),
  shop_id uuid references public.shops (id) on delete restrict,
  submission_id uuid references public.shop_billing_submissions (id) on delete restrict,
  action text not null check (action in (
    'configure_instructions', 'mark_under_review', 'approve', 'reject'
  )),
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  before_state jsonb,
  after_state jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);

create index platform_billing_events_shop_time_idx
  on public.platform_billing_events (shop_id, occurred_at desc, id desc);

alter table public.shop_billing_configuration enable row level security;
alter table public.platform_billing_events enable row level security;
revoke all on table public.shop_billing_configuration, public.platform_billing_events
  from public, anon, authenticated;
grant all on table public.shop_billing_configuration, public.platform_billing_events
  to service_role;

create trigger platform_billing_events_immutable
before update or delete or truncate on public.platform_billing_events
for each statement execute function shop_private.preserve_platform_admin_event();

create function shop_private.billing_subscription_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', subscription.id,
    'status', subscription.status,
    'planId', plan.id,
    'planSlug', plan.slug,
    'planName', plan.name,
    'priceAmount', plan.price_amount,
    'currency', plan.currency,
    'trialStartAt', subscription.trial_start_at,
    'trialEndAt', subscription.trial_end_at,
    'periodStart', subscription.current_period_start,
    'periodEnd', subscription.current_period_end,
    'accessState', case
      when shop.status = 'suspended' then 'suspended'
      when subscription.status = 'trialing' and subscription.trial_end_at > now() then 'trialing'
      when subscription.status = 'active' and subscription.current_period_end > now() then 'active'
      else 'read_only'
    end,
    'trialDaysRemaining', case
      when subscription.status = 'trialing' and subscription.trial_end_at > now()
      then ceil(extract(epoch from subscription.trial_end_at - now()) / 86400.0)::integer
      else 0
    end
  )
  from public.shops shop
  join public.shop_memberships membership
    on membership.shop_id = shop.id and membership.role = 'owner'
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
$$;

create function public.shop_billing_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_subscription jsonb;
  v_result jsonb;
begin
  if p_shop_id is null or not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_subscription := shop_private.billing_subscription_snapshot(p_shop_id);
  if v_subscription is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'subscription', v_subscription,
    'instructions', jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at,
      'manualVerification', true
    ),
    'usage', jsonb_build_object(
      'products', (select count(*)::integer from public.products product
        where product.shop_id = p_shop_id and product.is_active),
      'services', (select count(*)::integer from public.services service
        where service.shop_id = p_shop_id and service.is_active),
      'members', (select count(*)::integer from public.shop_memberships membership
        where membership.shop_id = p_shop_id and membership.status = 'active'),
      'limits', (select plan.features from public.plans plan
        where plan.id = (v_subscription ->> 'planId')::uuid)
    ),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', submission.id,
      'kind', submission.kind,
      'status', submission.status,
      'expectedAmount', submission.expected_amount,
      'paidAmount', submission.paid_amount,
      'currency', submission.currency,
      'transferDate', submission.transfer_date,
      'transferReference', submission.transfer_reference,
      'reviewReason', submission.review_reason,
      'receivedAmount', submission.received_amount,
      'receivedReference', submission.received_reference,
      'receivedDate', submission.received_date,
      'activationDays', submission.activation_days,
      'approvedSubscriptionEnd', submission.approved_subscription_end,
      'submittedAt', submission.submitted_at,
      'reviewedAt', submission.reviewed_at
    ) order by submission.submitted_at desc, submission.id desc), '[]'::jsonb)
    from public.shop_billing_submissions submission where submission.shop_id = p_shop_id)
  ) into v_result
  from public.shop_billing_configuration configuration where configuration.singleton;

  return v_result;
end;
$$;

create function public.submit_shop_billing_notice(
  p_request_id uuid,
  p_shop_id uuid,
  p_paid_amount numeric,
  p_transfer_date date,
  p_transfer_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_profile_id uuid;
  v_plan_id uuid;
  v_expected_amount numeric(12, 2);
  v_currency text;
  v_subscription_status text;
  v_existing public.shop_billing_submissions;
  v_submission_id uuid;
begin
  if p_request_id is null or p_shop_id is null
    or p_paid_amount is null or p_paid_amount <= 0 or p_paid_amount > 9999999999.99
    or p_paid_amount <> round(p_paid_amount, 2)
    or p_transfer_date is null or p_transfer_date > current_date
    or p_transfer_date < current_date - 365
    or p_transfer_reference is null
    or length(btrim(p_transfer_reference)) not between 2 and 200 then
    raise exception 'BILLING_NOTICE_INVALID' using errcode = '22023';
  end if;
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;

  select membership.profile_id, subscription.plan_id, plan.price_amount,
    plan.currency, subscription.status
  into v_profile_id, v_plan_id, v_expected_amount, v_currency, v_subscription_status
  from public.shop_memberships membership
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  where membership.shop_id = p_shop_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;
  if v_profile_id is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_existing from public.shop_billing_submissions submission
  where submission.request_id = p_request_id;
  if found then
    if v_existing.shop_id <> p_shop_id
      or v_existing.submitted_by_profile_id <> v_profile_id
      or v_existing.paid_amount is distinct from p_paid_amount
      or v_existing.transfer_date is distinct from p_transfer_date
      or v_existing.transfer_reference is distinct from btrim(p_transfer_reference) then
      raise exception 'BILLING_NOTICE_KEY_REUSED' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  insert into public.shop_billing_submissions (
    request_id, shop_id, submitted_by_profile_id, plan_id, kind, status,
    amount, expected_amount, paid_amount, currency, reference,
    transfer_date, transfer_reference, metadata
  ) values (
    p_request_id, p_shop_id, v_profile_id, v_plan_id,
    case when v_subscription_status = 'active' then 'renewal' else 'activation' end,
    'submitted', p_paid_amount, v_expected_amount, p_paid_amount, v_currency,
    btrim(p_transfer_reference), p_transfer_date, btrim(p_transfer_reference),
    jsonb_build_object('channel', 'instapay_manual', 'automaticVerification', false)
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$$;

create function public.platform_admin_billing_read(
  p_resource text default 'queue',
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform shop_private.assert_platform_admin(false);
  if p_resource not in ('queue', 'configuration', 'summary', 'audit')
    or p_page is null or p_page < 1 or p_page > 100000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or nullif(btrim(p_status), '') not in ('submitted', 'under_review', 'approved', 'rejected') then
    raise exception 'PLATFORM_BILLING_READ_INVALID' using errcode = '22023';
  end if;

  if p_resource = 'configuration' then
    select jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at
    ) into v_result
    from public.shop_billing_configuration configuration where configuration.singleton;
  elsif p_resource = 'summary' then
    select jsonb_build_object(
      'open', count(*) filter (where submission.status in ('submitted', 'under_review'))::integer,
      'submitted', count(*) filter (where submission.status = 'submitted')::integer,
      'underReview', count(*) filter (where submission.status = 'under_review')::integer,
      'approved', count(*) filter (where submission.status = 'approved')::integer,
      'rejected', count(*) filter (where submission.status = 'rejected')::integer
    ) into v_result from public.shop_billing_submissions submission;
  elsif p_resource = 'audit' then
    with event_rows as (
      select event.id, event.shop_id as "shopId", shop.name as "shopName", event.submission_id as "submissionId",
        event.action, event.reason, event.actor_user_id as "actorUserId",
        event.before_state as "beforeState", event.after_state as "afterState",
        event.occurred_at as "occurredAt"
      from public.platform_billing_events event left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from event_rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from event_rows),
      'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  else
    with queue_rows as (
      select submission.id, submission.shop_id as "shopId", shop.name as "shopName",
        submission.kind, submission.status, plan.slug as "planSlug", plan.name as "planName",
        submission.expected_amount as "expectedAmount", submission.paid_amount as "paidAmount",
        submission.currency, submission.transfer_date as "transferDate",
        submission.transfer_reference as "transferReference",
        submission.review_reason as "reviewReason", submission.received_amount as "receivedAmount",
        submission.received_reference as "receivedReference", submission.received_date as "receivedDate",
        submission.activation_days as "activationDays",
        submission.approved_subscription_end as "approvedSubscriptionEnd",
        submission.submitted_at as "submittedAt", submission.reviewed_at as "reviewedAt"
      from public.shop_billing_submissions submission
      join public.shops shop on shop.id = submission.shop_id
      left join public.plans plan on plan.id = submission.plan_id
      where nullif(btrim(p_status), '') is null or submission.status = btrim(p_status)
    ), page_rows as (
      select * from queue_rows order by "submittedAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from queue_rows),
      'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$$;

create function public.platform_admin_billing_command(
  p_request_id uuid,
  p_action text,
  p_submission_id uuid,
  p_reason text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_prior public.platform_billing_events;
  v_submission public.shop_billing_submissions;
  v_before jsonb;
  v_after jsonb;
  v_shop_id uuid;
  v_owner_profile_id uuid;
  v_subscription_id uuid;
  v_days integer;
  v_end timestamptz;
  v_amount numeric(12, 2);
  v_reference text;
  v_received_date date;
  v_parameters jsonb;
  v_config public.shop_billing_configuration;
  v_event_id uuid;
begin
  v_role := shop_private.assert_platform_admin(true);
  p_payload := coalesce(p_payload, '{}'::jsonb);
  if p_request_id is null
    or p_action not in ('configure_instructions', 'mark_under_review', 'approve', 'reject')
    or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    or (p_action = 'configure_instructions' and p_submission_id is not null)
    or (p_action <> 'configure_instructions' and p_submission_id is null) then
    raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
  end if;
  v_parameters := jsonb_build_object(
    'action', p_action, 'submissionId', p_submission_id, 'payload', p_payload
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_prior from public.platform_billing_events event
  where event.request_id = p_request_id;
  if found then
    if v_prior.actor_user_id <> auth.uid() or v_prior.action <> p_action
      or v_prior.submission_id is distinct from p_submission_id
      or v_prior.reason <> btrim(p_reason)
      or v_prior.parameters is distinct from v_parameters then
      raise exception 'PLATFORM_BILLING_COMMAND_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('data', v_prior.after_state, 'replayed', true, 'auditId', v_prior.id);
  end if;

  if p_action = 'configure_instructions' then
    if (p_payload - array['recipientAlias', 'paymentLink', 'qrImageUrl', 'instructionsEn', 'instructionsAr']) <> '{}'::jsonb
      or (p_payload ? 'recipientAlias' and jsonb_typeof(p_payload -> 'recipientAlias') <> 'string')
      or (p_payload ? 'paymentLink' and jsonb_typeof(p_payload -> 'paymentLink') <> 'string')
      or (p_payload ? 'qrImageUrl' and jsonb_typeof(p_payload -> 'qrImageUrl') <> 'string')
      or (p_payload ? 'instructionsEn' and jsonb_typeof(p_payload -> 'instructionsEn') <> 'string')
      or (p_payload ? 'instructionsAr' and jsonb_typeof(p_payload -> 'instructionsAr') <> 'string')
      or length(coalesce(p_payload ->> 'recipientAlias', '')) > 200
      or length(coalesce(p_payload ->> 'paymentLink', '')) > 1000
      or length(coalesce(p_payload ->> 'qrImageUrl', '')) > 1000
      or length(coalesce(p_payload ->> 'instructionsEn', '')) > 2000
      or length(coalesce(p_payload ->> 'instructionsAr', '')) > 2000
      or (nullif(btrim(p_payload ->> 'paymentLink'), '') is not null and btrim(p_payload ->> 'paymentLink') !~ '^https://')
      or (nullif(btrim(p_payload ->> 'qrImageUrl'), '') is not null and btrim(p_payload ->> 'qrImageUrl') !~ '^https://') then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end if;
    select * into v_config from public.shop_billing_configuration where singleton for update;
    v_before := to_jsonb(v_config);
    update public.shop_billing_configuration set
      recipient_alias = nullif(btrim(p_payload ->> 'recipientAlias'), ''),
      payment_link = nullif(btrim(p_payload ->> 'paymentLink'), ''),
      qr_image_url = nullif(btrim(p_payload ->> 'qrImageUrl'), ''),
      instructions_en = coalesce(btrim(p_payload ->> 'instructionsEn'), ''),
      instructions_ar = coalesce(btrim(p_payload ->> 'instructionsAr'), ''),
      updated_by_user_id = auth.uid(), updated_at = clock_timestamp()
    where singleton returning * into v_config;
    v_after := to_jsonb(v_config);
  else
    select * into v_submission from public.shop_billing_submissions submission
    where submission.id = p_submission_id for update;
    if not found then
      raise exception 'BILLING_NOTICE_NOT_FOUND' using errcode = '22023';
    end if;
    v_shop_id := v_submission.shop_id;
    v_before := to_jsonb(v_submission);

    if p_action = 'mark_under_review' then
      if p_payload <> '{}'::jsonb or v_submission.status <> 'submitted' then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      update public.shop_billing_submissions set status = 'under_review'
      where id = p_submission_id returning * into v_submission;
    elsif p_action = 'reject' then
      if p_payload <> '{}'::jsonb or v_submission.status not in ('submitted', 'under_review') then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      update public.shop_billing_submissions set status = 'rejected',
        review_reason = btrim(p_reason), reviewed_by_user_id = auth.uid(),
        reviewed_at = clock_timestamp()
      where id = p_submission_id returning * into v_submission;
    else
      if v_submission.status not in ('submitted', 'under_review')
        or (p_payload - array['receivedAmount', 'receivedReference', 'receivedDate', 'days']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'receivedAmount') <> 'number'
        or jsonb_typeof(p_payload -> 'receivedReference') <> 'string'
        or jsonb_typeof(p_payload -> 'receivedDate') <> 'string'
        or jsonb_typeof(p_payload -> 'days') <> 'number' then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      v_amount := (p_payload ->> 'receivedAmount')::numeric;
      v_reference := btrim(p_payload ->> 'receivedReference');
      v_received_date := (p_payload ->> 'receivedDate')::date;
      v_days := (p_payload ->> 'days')::integer;
      if v_amount <= 0 or v_amount > 9999999999.99
        or v_amount <> round(v_amount, 2)
        or length(v_reference) not between 2 and 200
        or v_received_date > current_date or v_received_date < current_date - 365
        or (p_payload ->> 'days')::numeric <> trunc((p_payload ->> 'days')::numeric)
        or v_days not between 1 and 3660 then
        raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
      end if;

      select membership.profile_id, subscription.id
      into v_owner_profile_id, v_subscription_id
      from public.shop_memberships membership
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      where membership.shop_id = v_submission.shop_id and membership.role = 'owner'
      order by (membership.status = 'active') desc, membership.created_at, membership.id
      limit 1 for update of subscription;
      if v_subscription_id is null or v_submission.plan_id is null then
        raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
      end if;

      select greatest(coalesce(subscription.current_period_end, now()), now())
        + make_interval(days => v_days)
      into v_end from public.subscriptions subscription where subscription.id = v_subscription_id;
      update public.subscriptions set plan_id = v_submission.plan_id, status = 'active',
        current_period_start = case
          when current_period_end is null or current_period_end <= now() then now()
          else coalesce(current_period_start, now()) end,
        current_period_end = v_end, locked_at = null, updated_at = now()
      where id = v_subscription_id;
      update public.shop_billing_submissions set status = 'approved',
        review_reason = btrim(p_reason), reviewed_by_user_id = auth.uid(),
        received_amount = v_amount, received_reference = v_reference,
        received_date = v_received_date, activation_days = v_days,
        approved_subscription_end = v_end, reviewed_at = clock_timestamp()
      where id = p_submission_id returning * into v_submission;
    end if;
    v_after := to_jsonb(v_submission) || jsonb_build_object(
      'subscription', shop_private.billing_subscription_snapshot(v_submission.shop_id)
    );
  end if;

  insert into public.platform_billing_events (
    request_id, actor_user_id, actor_role, shop_id, submission_id,
    action, reason, parameters, before_state, after_state
  ) values (
    p_request_id, auth.uid(), v_role, v_shop_id, p_submission_id,
    p_action, btrim(p_reason), v_parameters, v_before, v_after
  ) returning id into v_event_id;
  return jsonb_build_object('data', v_after, 'replayed', false, 'auditId', v_event_id);
end;
$$;

revoke all on function shop_private.billing_subscription_snapshot(uuid)
  from public, anon, authenticated, service_role;
revoke all on function shop_private.enforce_shop_trial_policy()
  from public, anon, authenticated, service_role;
revoke all on function public.shop_billing_read(uuid),
  public.submit_shop_billing_notice(uuid, uuid, numeric, date, text),
  public.platform_admin_billing_read(text, text, integer, integer),
  public.platform_admin_billing_command(uuid, text, uuid, text, jsonb)
from public, anon, service_role;
grant execute on function public.shop_billing_read(uuid),
  public.submit_shop_billing_notice(uuid, uuid, numeric, date, text),
  public.platform_admin_billing_read(text, text, integer, integer),
  public.platform_admin_billing_command(uuid, text, uuid, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
