-- SAS Billing compatibility: evolve the existing Shop authority, not a second configuration.
-- Existing row becomes revision 1 of the forward versioned contract. Updates and
-- exact replays retain the existing platform billing event/bridge receipts.
begin;
alter table public.shop_billing_configuration
 add column version bigint not null default 1 check (version > 0),
 add column enabled boolean not null default false,
 add column recipient_details text not null default '',
 add column qr_alt_en text not null default '',
 add column qr_alt_ar text not null default '';
CREATE OR REPLACE FUNCTION shop_private.platform_admin_billing_command_existing(p_request_id uuid, p_action text, p_submission_id uuid, p_reason text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text; v_prior public.platform_billing_events;
  v_submission public.shop_billing_submissions; v_before jsonb; v_after jsonb;
  v_shop_id uuid; v_subscription public.subscriptions; v_amount numeric(12, 2);
  v_reference text; v_received_date date; v_parameters jsonb;
  v_config public.shop_billing_configuration; v_event_id uuid; v_end timestamptz;
  v_start timestamptz; v_days integer; v_blockers jsonb; v_mismatch_reason text;
  v_override_id uuid; v_currency text; v_effective_from timestamptz; v_expires_at timestamptz;
begin
  v_role := shop_private.assert_platform_admin(true);
  p_payload := coalesce(p_payload, '{}'::jsonb);
  if p_request_id is null
    or p_action not in ('configure_instructions', 'mark_under_review', 'approve', 'reject', 'set_price_override')
    or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    or (p_action in ('configure_instructions', 'set_price_override') and p_submission_id is not null)
    or (p_action not in ('configure_instructions', 'set_price_override') and p_submission_id is null) then
    raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
  end if;
  v_parameters := jsonb_build_object('action', p_action, 'submissionId', p_submission_id, 'payload', p_payload);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_prior from public.platform_billing_events event where event.request_id = p_request_id;
  if found then
    if v_prior.actor_user_id <> auth.uid() or v_prior.action <> p_action
      or v_prior.submission_id is distinct from p_submission_id
      or v_prior.reason <> btrim(p_reason) or v_prior.parameters is distinct from v_parameters then
      raise exception 'PLATFORM_BILLING_COMMAND_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('data', v_prior.after_state, 'replayed', true, 'auditId', v_prior.id);
  end if;

  if p_action = 'configure_instructions' then
    if (p_payload - array['recipientAlias', 'paymentLink', 'qrImageUrl', 'instructionsEn', 'instructionsAr', 'expectedVersion', 'enabled', 'recipientDetails', 'qrAltEn', 'qrAltAr']) <> '{}'::jsonb
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
    if (p_payload ? 'expectedVersion' and (jsonb_typeof(p_payload->'expectedVersion') <> 'number' or (p_payload->>'expectedVersion') !~ '^[1-9][0-9]*$'))
      or (p_payload ? 'enabled' and jsonb_typeof(p_payload->'enabled') <> 'boolean')
      or exists (select 1 from jsonb_each(p_payload) e where e.key in ('recipientDetails','qrAltEn','qrAltAr') and (jsonb_typeof(e.value) <> 'string' or length(e.value #>> '{}') > 4000)) then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode='22023';
    end if;
    select * into v_config from public.shop_billing_configuration where singleton for update;
    if p_payload ? 'expectedVersion' and (p_payload->>'expectedVersion')::bigint <> v_config.version then raise exception 'BILLING_CONFIGURATION_VERSION_CONFLICT' using errcode='40001'; end if;
    v_before := to_jsonb(v_config);
    update public.shop_billing_configuration set
      version = version + 1,
      enabled = coalesce((p_payload->>'enabled')::boolean, enabled),
      recipient_details = coalesce(p_payload->>'recipientDetails', recipient_details),
      qr_alt_en = coalesce(p_payload->>'qrAltEn', qr_alt_en),
      qr_alt_ar = coalesce(p_payload->>'qrAltAr', qr_alt_ar),
      recipient_alias = nullif(btrim(p_payload ->> 'recipientAlias'), ''),
      payment_link = nullif(btrim(p_payload ->> 'paymentLink'), ''),
      qr_image_url = nullif(btrim(p_payload ->> 'qrImageUrl'), ''),
      instructions_en = coalesce(btrim(p_payload ->> 'instructionsEn'), ''),
      instructions_ar = coalesce(btrim(p_payload ->> 'instructionsAr'), ''),
      updated_by_user_id = auth.uid(), updated_at = clock_timestamp()
    where singleton returning * into v_config;
    v_after := to_jsonb(v_config);
  elsif p_action = 'set_price_override' then
    if (p_payload - array['shopId', 'amount', 'currency', 'effectiveFrom', 'expiresAt']) <> '{}'::jsonb
      or jsonb_typeof(p_payload -> 'shopId') <> 'string'
      or jsonb_typeof(p_payload -> 'amount') <> 'number'
      or jsonb_typeof(p_payload -> 'currency') <> 'string'
      or jsonb_typeof(p_payload -> 'effectiveFrom') <> 'string'
      or (p_payload ? 'expiresAt' and p_payload -> 'expiresAt' <> 'null'::jsonb
        and jsonb_typeof(p_payload -> 'expiresAt') <> 'string') then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end if;
    begin
      v_shop_id := (p_payload ->> 'shopId')::uuid;
      v_amount := (p_payload ->> 'amount')::numeric;
      v_currency := upper(btrim(p_payload ->> 'currency'));
      v_effective_from := (p_payload ->> 'effectiveFrom')::timestamptz;
      v_expires_at := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
    exception when others then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end;
    if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2)
      or v_currency !~ '^[A-Z]{3}$'
      or v_effective_from < clock_timestamp() - interval '10 years'
      or (v_expires_at is not null and v_expires_at <= v_effective_from) then
      raise exception 'PLATFORM_BILLING_COMMAND_INVALID' using errcode = '22023';
    end if;
    perform 1 from public.shops shop where shop.id = v_shop_id for update;
    if not found then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
    select subscription.* into v_subscription
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = v_shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1 for update of subscription;
    if v_subscription.id is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
    v_before := shop_private.billing_subscription_snapshot(v_shop_id);
    insert into public.subscription_price_overrides (
      subscription_id, amount, currency, reason, effective_from, expires_at, created_by_user_id
    ) values (
      v_subscription.id, v_amount, v_currency, btrim(p_reason),
      v_effective_from, v_expires_at, auth.uid()
    ) returning id into v_override_id;
    v_after := jsonb_build_object(
      'priceOverrideId', v_override_id, 'shopId', v_shop_id,
      'subscriptionId', v_subscription.id, 'amount', v_amount,
      'currency', v_currency, 'reason', btrim(p_reason),
      'effectiveFrom', v_effective_from, 'expiresAt', v_expires_at,
      'subscription', shop_private.billing_subscription_snapshot(v_shop_id)
    );
  else
    select * into v_submission from public.shop_billing_submissions submission
    where submission.id = p_submission_id for update;
    if not found then raise exception 'BILLING_NOTICE_NOT_FOUND' using errcode = '22023'; end if;
    v_shop_id := v_submission.shop_id;
    v_before := to_jsonb(v_submission) || jsonb_build_object(
      'subscription', shop_private.billing_subscription_snapshot(v_submission.shop_id)
    );
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
        review_reason = btrim(p_reason), reviewed_by_user_id = auth.uid(), reviewed_at = clock_timestamp()
      where id = p_submission_id returning * into v_submission;
    else
      if v_submission.status not in ('submitted', 'under_review')
        or (p_payload - array['receivedAmount', 'receivedReference', 'receivedDate', 'amountOverrideReason']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'receivedAmount') <> 'number'
        or jsonb_typeof(p_payload -> 'receivedReference') <> 'string'
        or jsonb_typeof(p_payload -> 'receivedDate') <> 'string'
        or (p_payload ? 'amountOverrideReason' and jsonb_typeof(p_payload -> 'amountOverrideReason') <> 'string') then
        raise exception 'BILLING_NOTICE_STATE_INVALID' using errcode = '22023';
      end if;
      v_amount := (p_payload ->> 'receivedAmount')::numeric;
      v_reference := btrim(p_payload ->> 'receivedReference');
      v_received_date := (p_payload ->> 'receivedDate')::date;
      v_mismatch_reason := nullif(btrim(p_payload ->> 'amountOverrideReason'), '');
      if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2)
        or length(v_reference) not between 2 and 200
        or v_received_date > current_date or v_received_date < current_date - 365
        or ((v_amount is distinct from v_submission.effective_price_amount
            or v_submission.paid_amount is distinct from v_submission.effective_price_amount)
          and (v_mismatch_reason is null or length(v_mismatch_reason) not between 2 and 1000))
        or (v_mismatch_reason is not null and length(v_mismatch_reason) > 1000) then
        raise exception 'BILLING_AMOUNT_MISMATCH_OVERRIDE_REQUIRED' using errcode = '22023';
      end if;

      perform shop_private.lock_all_plan_resources(v_submission.shop_id);
      select subscription.* into v_subscription
      from public.shop_memberships membership
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      where membership.shop_id = v_submission.shop_id and membership.role = 'owner'
      order by (membership.status = 'active') desc, membership.created_at, membership.id
      limit 1 for update of subscription;
      if v_subscription.id is null or v_submission.plan_id is null or v_submission.catalog_terms_id is null then
        raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
      end if;
      v_blockers := shop_private.plan_change_blockers(v_submission.shop_id, v_submission.resource_limits_snapshot);
      if jsonb_array_length(v_blockers) > 0 then
        raise exception 'PLAN_CHANGE_BLOCKED' using errcode = '23514', detail = v_blockers::text;
      end if;

      v_start := greatest(coalesce(v_subscription.current_period_end, clock_timestamp()), clock_timestamp());
      v_end := v_start + case v_submission.billing_interval_snapshot
        when 'monthly' then interval '1 month'
        when 'quarterly' then interval '3 months'
        when 'annual' then interval '1 year'
        else null end;
      if v_end is null then raise exception 'BILLING_INTERVAL_INVALID' using errcode = '22023'; end if;
      v_days := greatest(1, ceil(extract(epoch from v_end - v_start) / 86400.0)::integer);
      perform set_config('shop.billing_approval', 'approved', true);
      update public.subscriptions set
        plan_id = v_submission.plan_id, catalog_terms_id = v_submission.catalog_terms_id,
        status = 'active',
        current_period_start = case when current_period_end is null or current_period_end <= now()
          then now() else coalesce(current_period_start, now()) end,
        current_period_end = v_end, locked_at = null, updated_at = now()
      where id = v_subscription.id;
      update public.shop_billing_submissions set status = 'approved',
        review_reason = btrim(p_reason), reviewed_by_user_id = auth.uid(),
        received_amount = v_amount, received_reference = v_reference,
        received_date = v_received_date, activation_days = v_days,
        approved_subscription_end = v_end, reviewed_at = clock_timestamp(),
        metadata = metadata || jsonb_strip_nulls(jsonb_build_object(
          'amountMismatchOverrideReason', v_mismatch_reason,
          'amountMismatch', v_mismatch_reason is not null
        ))
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
$function$

;
CREATE OR REPLACE FUNCTION public.platform_admin_billing_read(p_resource text DEFAULT 'queue'::text, p_status text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'version', configuration.version, 'enabled', configuration.enabled,
      'recipientDetails', configuration.recipient_details,
      'qrAltEn', configuration.qr_alt_en, 'qrAltAr', configuration.qr_alt_ar,
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link,
      'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at
    ) into v_result from public.shop_billing_configuration configuration where configuration.singleton;
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
      select event.id, event.shop_id as "shopId", shop.name as "shopName",
        event.submission_id as "submissionId", event.action, event.reason,
        event.actor_user_id as "actorUserId", event.parameters,
        event.before_state as "beforeState", event.after_state as "afterState",
        event.occurred_at as "occurredAt"
      from public.platform_billing_events event left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from event_rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from event_rows), 'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  else
    with queue_rows as (
      select submission.id, submission.shop_id as "shopId", shop.name as "shopName",
        submission.kind, submission.status,
        current_plan.slug as "currentPlanSlug", current_terms.display_name as "currentPlanName",
        submission.plan_slug_snapshot as "requestedPlanSlug",
        submission.plan_name_snapshot as "requestedPlanName",
        submission.billing_interval_snapshot as "billingInterval",
        submission.list_price_amount as "listPriceAmount",
        submission.effective_price_amount as "effectivePriceAmount",
        submission.price_source as "priceSource",
        submission.resource_limits_snapshot as "resourceLimits",
        submitted_terms.private_offer_id as "privateOfferId",
        submission.offer_entitlements as entitlements,
        (select period.id from public.subscription_commercial_periods period where period.billing_submission_id=submission.id) as "commercialPeriodId",
        (select period.subscription_id from public.subscription_commercial_periods period where period.billing_submission_id=submission.id) as "subscriptionId",
        coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'originalFileName',e.original_file_name,
          'mimeType',e.mime_type,'sizeBytes',e.size_bytes,'sha256',e.sha256,'retainedUntil',e.retained_until)
          order by e.created_at,e.id) from public.shop_billing_payment_evidence e where e.submission_id=submission.id),'[]'::jsonb) as evidence,
        shop_private.plan_change_blockers(submission.shop_id, submission.resource_limits_snapshot) as "usageBlockers",
        submission.expected_amount as "expectedAmount", submission.paid_amount as "paidAmount",
        submission.currency, submission.transfer_date as "transferDate",
        submission.transfer_reference as "transferReference",
        submission.review_reason as "reviewReason", submission.received_amount as "receivedAmount",
        submission.received_reference as "receivedReference", submission.received_date as "receivedDate",
        submission.activation_days as "activationDays",
        submission.approved_subscription_end as "approvedSubscriptionEnd",
        submission.submitted_at as "submittedAt", submission.reviewed_at as "reviewedAt"
      from public.shop_billing_submissions submission
      join public.plan_catalog_terms submitted_terms on submitted_terms.id=submission.catalog_terms_id
      join public.shops shop on shop.id = submission.shop_id
      join public.shop_memberships membership on membership.shop_id = submission.shop_id and membership.role = 'owner'
      join public.subscriptions subscription on subscription.profile_id = membership.profile_id
      join public.plans current_plan on current_plan.id = subscription.plan_id
      join public.plan_catalog_terms current_terms on current_terms.id = subscription.catalog_terms_id
      where (nullif(btrim(p_status), '') is null or submission.status = btrim(p_status))
        and membership.id = (select selected.id from public.shop_memberships selected
          where selected.shop_id = submission.shop_id and selected.role = 'owner'
          order by (selected.status = 'active') desc, selected.created_at, selected.id limit 1)
    ), page_rows as (
      select * from queue_rows order by "submittedAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page_row)) from page_rows page_row), '[]'::jsonb),
      'total', (select count(*)::integer from queue_rows), 'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$function$

;
CREATE OR REPLACE FUNCTION public.shop_billing_read(p_shop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_subscription jsonb; v_subscription_id uuid; v_result jsonb;
begin
  if p_shop_id is null or not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  v_subscription := shop_private.billing_subscription_snapshot(p_shop_id);
  if v_subscription is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
  v_subscription_id := (v_subscription ->> 'id')::uuid;
  select jsonb_build_object(
    'subscription', v_subscription,
    'availablePlans', (select coalesce(jsonb_agg(jsonb_build_object(
      'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
      'catalogTermsId', terms.id, 'planVariant', terms.plan_variant,
      'variantName', terms.variant_name, 'billingInterval', terms.billing_interval,
      'currency', terms.currency,
      'listPriceAmount', (price.quote ->> 'listPriceAmount')::numeric,
      'effectivePriceAmount', (price.quote ->> 'effectivePriceAmount')::numeric,
      'priceSource', price.quote ->> 'priceSource',
      'resourceLimits', terms.resource_limits,
      'blockers', shop_private.plan_change_blockers(p_shop_id, terms.resource_limits)
    ) order by plan.sort_order, terms.plan_variant, terms.billing_interval), '[]'::jsonb)
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id
    cross join lateral shop_private.current_plan_offers(plan.id) terms
    cross join lateral (select shop_private.subscription_effective_price(
      v_subscription_id, terms.id, clock_timestamp()) quote) price
    where portal.key = 'shop-crm' and plan.is_active and plan.is_public
      and plan.is_purchasable and not plan.is_coming_soon
      and terms.is_public and terms.is_purchasable),
    'instructions', case when configuration.enabled then jsonb_build_object(
      'recipientAlias', configuration.recipient_alias,
      'paymentLink', configuration.payment_link, 'qrImageUrl', configuration.qr_image_url,
      'instructionsEn', configuration.instructions_en,
      'instructionsAr', configuration.instructions_ar,
      'updatedAt', configuration.updated_at, 'manualVerification', true
    ) else null end,
    'usage', shop_private.plan_usage_snapshot(p_shop_id),
    'submissions', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', submission.id, 'kind', submission.kind, 'status', submission.status,
      'requestedPlanId', submission.plan_id,
      'requestedPlanSlug', submission.plan_slug_snapshot,
      'requestedPlanName', submission.plan_name_snapshot,
      'planVariant', submission.plan_variant_snapshot,
      'billingInterval', submission.billing_interval_snapshot,
      'listPriceAmount', submission.list_price_amount,
      'effectivePriceAmount', submission.effective_price_amount,
      'priceSource', submission.price_source, 'expectedAmount', submission.expected_amount,
      'paidAmount', submission.paid_amount, 'currency', submission.currency,
      'transferDate', submission.transfer_date, 'transferReference', submission.transfer_reference,
      'reviewReason', submission.review_reason, 'receivedAmount', submission.received_amount,
      'receivedReference', submission.received_reference, 'receivedDate', submission.received_date,
      'activationDays', submission.activation_days,
      'approvedSubscriptionEnd', submission.approved_subscription_end,
      'submittedAt', submission.submitted_at, 'reviewedAt', submission.reviewed_at
    ) order by submission.submitted_at desc, submission.id desc), '[]'::jsonb)
    from public.shop_billing_submissions submission where submission.shop_id = p_shop_id)
  ) into v_result
  from public.shop_billing_configuration configuration where configuration.singleton;
  return v_result;
end;
$function$

;
commit;
