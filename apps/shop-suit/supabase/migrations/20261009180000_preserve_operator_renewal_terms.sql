-- SS-LAUNCH-SOLO-VARIANTS-001 repair: operator renewal must check and extend
-- the subscription's pinned terms instead of the current family default.
-- Preserve applied migrations, authorization, blockers, audit and replay behavior.

create or replace function public.platform_plan_command(
  p_request_id uuid, p_action text, p_reason text,
  p_plan_id uuid default null, p_shop_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_prior public.platform_plan_events; v_parameters jsonb;
  v_before jsonb; v_after jsonb; v_event_id uuid;
  v_plan public.plans; v_terms public.plan_catalog_terms; v_new_terms public.plan_catalog_terms;
  v_subscription public.subscriptions; v_current_terms public.plan_catalog_terms;
  v_subscription_id uuid; v_version integer; v_effective_at timestamptz;
  v_limits jsonb; v_blockers jsonb; v_timing text; v_downgrade boolean;
  v_end timestamptz; v_override_id uuid; v_amount numeric(12,2); v_currency text;
begin
  v_role := shop_private.assert_platform_admin(true);
  p_payload := coalesce(p_payload, '{}'::jsonb);
  if p_request_id is null
    or p_action not in ('publish_terms', 'set_availability', 'change_subscription',
      'renew_subscription', 'suspend_subscription', 'set_price_override', 'remove_price_override')
    or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    or (p_action in ('publish_terms', 'set_availability') and (p_plan_id is null or p_shop_id is not null))
    or (p_action not in ('publish_terms', 'set_availability') and p_shop_id is null) then
    raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
  end if;
  v_parameters := jsonb_build_object(
    'action', p_action, 'planId', p_plan_id, 'shopId', p_shop_id, 'payload', p_payload
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_prior from public.platform_plan_events event where event.request_id = p_request_id;
  if found then
    if v_prior.actor_user_id <> auth.uid() or v_prior.action <> p_action
      or v_prior.reason <> btrim(p_reason) or v_prior.parameters is distinct from v_parameters then
      raise exception 'PLATFORM_PLAN_COMMAND_KEY_REUSED' using errcode = '22023';
    end if;
    return jsonb_build_object('data', v_prior.after_state, 'replayed', true, 'auditId', v_prior.id);
  end if;

  if p_action in ('publish_terms', 'set_availability') then
    select * into v_plan from public.plans plan where plan.id = p_plan_id for update;
    if not found then raise exception 'PLATFORM_ADMIN_PLAN_NOT_FOUND' using errcode = '22023'; end if;
    select * into v_terms from shop_private.current_plan_terms(p_plan_id);
    v_before := jsonb_build_object('plan', to_jsonb(v_plan), 'terms', to_jsonb(v_terms));
    if p_action = 'set_availability' then
      if (p_payload - array['isActive','isPublic','isPurchasable','isComingSoon']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'isActive') <> 'boolean'
        or jsonb_typeof(p_payload -> 'isPublic') <> 'boolean'
        or jsonb_typeof(p_payload -> 'isPurchasable') <> 'boolean'
        or jsonb_typeof(p_payload -> 'isComingSoon') <> 'boolean'
        or ((p_payload ->> 'isPurchasable')::boolean and not (p_payload ->> 'isPublic')::boolean) then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      update public.plans set
        is_active = (p_payload ->> 'isActive')::boolean,
        is_public = (p_payload ->> 'isPublic')::boolean,
        is_purchasable = (p_payload ->> 'isPurchasable')::boolean,
        is_coming_soon = (p_payload ->> 'isComingSoon')::boolean,
        updated_at = now() where id = p_plan_id returning * into v_plan;
      v_after := jsonb_build_object('plan', to_jsonb(v_plan), 'terms', to_jsonb(v_terms));
    else
      if (p_payload - array['displayName','billingInterval','currency','priceAmount','resourceLimits','effectiveFrom']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'displayName') <> 'string'
        or jsonb_typeof(p_payload -> 'billingInterval') <> 'string'
        or jsonb_typeof(p_payload -> 'currency') <> 'string'
        or jsonb_typeof(p_payload -> 'priceAmount') <> 'number'
        or jsonb_typeof(p_payload -> 'resourceLimits') <> 'object'
        or jsonb_typeof(p_payload -> 'effectiveFrom') <> 'string' then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      begin
        v_effective_at := (p_payload ->> 'effectiveFrom')::timestamptz;
      exception when others then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end;
      v_limits := p_payload -> 'resourceLimits';
      if length(btrim(p_payload ->> 'displayName')) not between 1 and 120
        or p_payload ->> 'billingInterval' not in ('monthly','quarterly','annual')
        or upper(btrim(p_payload ->> 'currency')) !~ '^[A-Z]{3}$'
        or (p_payload ->> 'priceAmount')::numeric < 0
        or (p_payload ->> 'priceAmount')::numeric <> trunc((p_payload ->> 'priceAmount')::numeric)
        or not shop_private.valid_resource_limits(v_limits)
        or v_effective_at < clock_timestamp() - interval '5 minutes' then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select coalesce(max(terms.version), 0) + 1 into v_version
      from public.plan_catalog_terms terms where terms.plan_id = p_plan_id;
      insert into public.plan_catalog_terms (
        plan_id, version, display_name, billing_interval, currency, price_amount,
        trial_days, resource_limits, is_public, is_purchasable, effective_from
      ) values (
        p_plan_id, v_version, btrim(p_payload ->> 'displayName'),
        p_payload ->> 'billingInterval', upper(btrim(p_payload ->> 'currency')),
        (p_payload ->> 'priceAmount')::integer, 14, v_limits,
        v_plan.is_public, v_plan.is_purchasable, v_effective_at
      ) returning * into v_new_terms;
      if v_effective_at <= clock_timestamp() then
        update public.plans set name = v_new_terms.display_name,
          price_amount = v_new_terms.price_amount, currency = v_new_terms.currency,
          billing_interval = v_new_terms.billing_interval,
          resource_limits = v_new_terms.resource_limits,
          catalog_version = v_new_terms.version, updated_at = now()
        where id = p_plan_id returning * into v_plan;
      end if;
      v_after := jsonb_build_object('plan', to_jsonb(v_plan), 'terms', to_jsonb(v_new_terms));
    end if;
  else
    perform 1 from public.shops shop where shop.id = p_shop_id for update;
    if not found then raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND' using errcode = '22023'; end if;
    select subscription.* into v_subscription
    from public.shop_memberships membership
    join public.subscriptions subscription on subscription.profile_id = membership.profile_id
    where membership.shop_id = p_shop_id and membership.role = 'owner'
    order by (membership.status = 'active') desc, membership.created_at, membership.id
    limit 1 for update of subscription;
    if v_subscription.id is null then raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023'; end if;
    v_subscription_id := v_subscription.id;
    select * into v_current_terms from public.plan_catalog_terms terms
    where terms.id = v_subscription.catalog_terms_id;
    v_before := shop_private.platform_plan_subscription_snapshot(p_shop_id);

    if p_action = 'set_price_override' then
      if p_plan_id is not null
        or (p_payload - array['amount','currency','effectiveFrom','expiresAt']) <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'amount') <> 'number'
        or jsonb_typeof(p_payload -> 'currency') <> 'string'
        or jsonb_typeof(p_payload -> 'effectiveFrom') <> 'string'
        or (p_payload ? 'expiresAt' and p_payload -> 'expiresAt' <> 'null'::jsonb
          and jsonb_typeof(p_payload -> 'expiresAt') <> 'string') then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      begin
        v_amount := (p_payload ->> 'amount')::numeric;
        v_currency := upper(btrim(p_payload ->> 'currency'));
        v_effective_at := (p_payload ->> 'effectiveFrom')::timestamptz;
        v_end := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
      exception when others then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end;
      if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2)
        or v_currency !~ '^[A-Z]{3}$' or (v_end is not null and v_end <= v_effective_at) then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      insert into public.subscription_price_overrides (
        subscription_id, amount, currency, reason, effective_from, expires_at, created_by_user_id
      ) values (v_subscription.id, v_amount, v_currency, btrim(p_reason), v_effective_at, v_end, auth.uid())
      returning id into v_override_id;
    elsif p_action = 'remove_price_override' then
      if p_plan_id is not null or p_payload <> '{}'::jsonb then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select nullif(quote ->> 'priceOverrideId', '')::uuid into v_override_id
      from (select shop_private.subscription_effective_price(
        v_subscription.id, v_subscription.catalog_terms_id, clock_timestamp()) quote) current_price;
      if v_override_id is null then raise exception 'PRICE_OVERRIDE_NOT_ACTIVE' using errcode = '22023'; end if;
      insert into public.subscription_price_override_revocations (
        price_override_id, reason, created_by_user_id
      ) values (v_override_id, btrim(p_reason), auth.uid());
    elsif p_action = 'suspend_subscription' then
      if p_plan_id is not null or p_payload <> '{}'::jsonb then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      update public.subscriptions set status = 'suspended', locked_at = clock_timestamp(), updated_at = now()
      where id = v_subscription.id;
    elsif p_action = 'renew_subscription' then
      if p_plan_id is not null or p_payload <> '{}'::jsonb then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      -- Renewal keeps the exact selected offer, including historical terms.
      -- Resolve it before checking usage or calculating the extension; the
      -- family default can have a different member allowance and interval.
      select * into v_terms from public.plan_catalog_terms terms
      where terms.id = v_subscription.catalog_terms_id
        and terms.plan_id = v_subscription.plan_id;
      if v_terms.id is null then
        raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
      end if;
      v_blockers := shop_private.plan_change_blockers(p_shop_id, v_terms.resource_limits);
      if jsonb_array_length(v_blockers) > 0 then
        raise exception 'PLAN_CHANGE_BLOCKED' using errcode = '23514', detail = v_blockers::text;
      end if;
      v_effective_at := greatest(coalesce(v_subscription.current_period_end, clock_timestamp()), clock_timestamp());
      v_end := v_effective_at + case v_terms.billing_interval
        when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
        when 'annual' then interval '1 year' end;
      perform set_config('shop.billing_approval', 'approved', true);
      update public.subscriptions set catalog_terms_id = v_terms.id, status = 'active',
        current_period_start = case when current_period_end is null or current_period_end <= now()
          then now() else coalesce(current_period_start, now()) end,
        current_period_end = v_end, locked_at = null, updated_at = now()
      where id = v_subscription.id;
      p_plan_id := v_subscription.plan_id;
    else
      if p_plan_id is null
        or (p_payload - 'timing') <> '{}'::jsonb
        or jsonb_typeof(p_payload -> 'timing') <> 'string' then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      v_timing := p_payload ->> 'timing';
      if v_timing not in ('automatic','immediate','period_end') then
        raise exception 'PLATFORM_PLAN_COMMAND_INVALID' using errcode = '22023';
      end if;
      select * into v_terms from shop_private.current_plan_terms(p_plan_id);
      select * into v_plan from public.plans plan where plan.id = p_plan_id
        and plan.is_active and not plan.is_coming_soon;
      if v_terms.id is null or v_plan.id is null then
        raise exception 'PLATFORM_ADMIN_PLAN_NOT_FOUND' using errcode = '22023';
      end if;
      v_blockers := shop_private.plan_change_blockers(p_shop_id, v_terms.resource_limits);
      if jsonb_array_length(v_blockers) > 0 then
        raise exception 'PLAN_CHANGE_BLOCKED' using errcode = '23514', detail = v_blockers::text;
      end if;
      v_downgrade := shop_private.plan_is_downgrade(v_current_terms.resource_limits, v_terms.resource_limits);
      if v_timing = 'period_end' or (v_timing = 'automatic' and v_downgrade
        and v_subscription.status = 'active' and v_subscription.current_period_end > now()) then
        v_effective_at := greatest(v_subscription.current_period_end, clock_timestamp());
        insert into public.subscription_plan_change_requests (
          subscription_id, from_plan_id, from_catalog_terms_id,
          to_plan_id, to_catalog_terms_id, effective_at, reason, created_by_user_id
        ) values (
          v_subscription.id, v_subscription.plan_id, v_subscription.catalog_terms_id,
          p_plan_id, v_terms.id, v_effective_at, btrim(p_reason), auth.uid()
        );
      else
        perform shop_private.lock_all_plan_resources(p_shop_id);
        perform set_config('shop.billing_approval', 'approved', true);
        v_effective_at := clock_timestamp();
        v_end := case when v_subscription.status = 'active' and v_subscription.current_period_end > now()
          then v_subscription.current_period_end
          else clock_timestamp() + case v_terms.billing_interval
            when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
            when 'annual' then interval '1 year' end end;
        update public.subscriptions set plan_id = p_plan_id, catalog_terms_id = v_terms.id,
          status = 'active', current_period_start = case
            when status = 'active' and current_period_end > now() then current_period_start else now() end,
          current_period_end = v_end, locked_at = null, updated_at = now()
        where id = v_subscription.id;
      end if;
    end if;
    v_after := shop_private.platform_plan_subscription_snapshot(p_shop_id);
  end if;

  insert into public.platform_plan_events (
    request_id, actor_user_id, actor_role, action, plan_id, shop_id,
    subscription_id, reason, parameters, before_state, after_state
  ) values (
    p_request_id, auth.uid(), v_role, p_action, p_plan_id, p_shop_id,
    v_subscription_id, btrim(p_reason), v_parameters, v_before, v_after
  ) returning id into v_event_id;
  return jsonb_build_object('data', v_after, 'replayed', false, 'auditId', v_event_id);
end;
$$;
