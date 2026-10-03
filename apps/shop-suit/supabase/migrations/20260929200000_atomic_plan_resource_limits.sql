-- SS-PLAN-LIMITS-001: one authoritative, concurrency-safe entitlement and
-- resource-limit engine for Shop locations, seats, products, and services.

create index shop_team_invitations_live_shop_expiry_idx
  on public.shop_team_invitations (shop_id, expires_at)
  where status = 'pending';

create index shop_memberships_active_shop_idx
  on public.shop_memberships (shop_id)
  where status = 'active' and removed_at is null;

create index products_active_shop_idx
  on public.products (shop_id) where is_active;

create index services_active_shop_idx
  on public.services (shop_id) where is_active;

create function shop_private.plan_resource_lock_key(
  p_shop_id uuid,
  p_resource text
) returns bigint language plpgsql immutable strict set search_path = '' as $$
begin
  if p_resource not in (
    'active_locations', 'active_members', 'active_products', 'active_services'
  ) then
    raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023';
  end if;
  return pg_catalog.hashtextextended(
    p_shop_id::text || ':plan-resource:' || p_resource,
    91827364
  );
end;
$$;

create function shop_private.lock_plan_resource(
  p_shop_id uuid,
  p_resource text
) returns bigint language plpgsql volatile set search_path = '' as $$
declare v_lock_key bigint := shop_private.plan_resource_lock_key(p_shop_id, p_resource);
begin
  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);
  return v_lock_key;
end;
$$;

create function shop_private.lock_all_plan_resources(p_shop_id uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare v_resource text;
begin
  if p_shop_id is null then
    raise exception 'SHOP_SUBSCRIPTION_NOT_FOUND' using errcode = '22023';
  end if;
  foreach v_resource in array array[
    'active_locations', 'active_members', 'active_products', 'active_services'
  ] loop
    perform shop_private.lock_plan_resource(p_shop_id, v_resource);
  end loop;
end;
$$;

create function shop_private.resolve_plan_entitlement(p_shop_id uuid)
returns table (
  subscription_id uuid,
  plan_id uuid,
  plan_slug text,
  catalog_terms_id uuid,
  subscription_status text,
  access_state text,
  writes_allowed boolean,
  resource_limits jsonb
) language plpgsql stable security definer set search_path = '' as $$
begin
  if p_shop_id is null then
    raise exception 'SHOP_ID_REQUIRED' using errcode = '22023';
  end if;

  return query
  select subscription.id, plan.id, plan.slug, terms.id, subscription.status,
    case
      when shop.status = 'suspended' then 'suspended'
      when subscription.status = 'trialing' and subscription.trial_end_at > now()
        then 'trialing'
      when subscription.status = 'active' and subscription.current_period_end > now()
        then 'active'
      else 'read_only'
    end,
    shop.status = 'active'
      and ((subscription.status = 'trialing' and subscription.trial_end_at > now())
        or (subscription.status = 'active' and subscription.current_period_end > now())),
    terms.resource_limits
  from public.shops shop
  join public.shop_memberships membership
    on membership.shop_id = shop.id and membership.role = 'owner'
  join public.subscriptions subscription on subscription.profile_id = membership.profile_id
  join public.plans plan on plan.id = subscription.plan_id
  join public.plan_catalog_terms terms on terms.id = subscription.catalog_terms_id
  where shop.id = p_shop_id
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;

end;
$$;

create function shop_private.plan_resource_usage(
  p_shop_id uuid,
  p_resource text
) returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_usage bigint;
begin
  case p_resource
    when 'active_locations' then
      select count(*) into v_usage from public.shop_locations location
      where location.shop_id = p_shop_id and location.status = 'active';
    when 'active_members' then
      select
        (select count(*) from public.shop_memberships membership
          where membership.shop_id = p_shop_id and membership.status = 'active'
            and membership.removed_at is null)
        +
        (select count(*) from public.shop_team_invitations invitation
          where invitation.shop_id = p_shop_id and invitation.status = 'pending'
            and invitation.expires_at > now())
      into v_usage;
    when 'active_products' then
      select count(*) into v_usage from public.products product
      where product.shop_id = p_shop_id and product.is_active;
    when 'active_services' then
      select count(*) into v_usage from public.services service
      where service.shop_id = p_shop_id and service.is_active;
    else
      raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023';
  end case;
  return coalesce(v_usage, 0);
end;
$$;

create or replace function shop_private.subscription_resource_limit(
  p_shop_id uuid,
  p_resource text
) returns integer language plpgsql stable security definer set search_path = '' as $$
declare v_entitlement record;
begin
  if p_resource not in (
    'active_locations', 'active_members', 'active_products', 'active_services'
  ) then
    raise exception 'UNKNOWN_PLAN_RESOURCE' using errcode = '22023';
  end if;
  select * into v_entitlement
  from shop_private.resolve_plan_entitlement(p_shop_id);
  -- Shop bootstrap creates its default location and owner membership before
  -- inserting the subscription. The subscription trigger validates both
  -- resources immediately afterward against the selected terms.
  if not found then return null; end if;
  return (v_entitlement.resource_limits ->> p_resource)::integer;
end;
$$;

create function shop_private.assert_plan_resource_capacity(
  p_shop_id uuid,
  p_resource text,
  p_requested bigint default 1
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_entitlement record; v_limit integer; v_usage bigint;
begin
  if p_requested is null or p_requested < 1 then
    raise exception 'PLAN_RESOURCE_INCREMENT_INVALID' using errcode = '22023';
  end if;
  perform shop_private.lock_plan_resource(p_shop_id, p_resource);
  select * into v_entitlement from shop_private.resolve_plan_entitlement(p_shop_id);
  -- Owner bootstrap creates its first location and membership immediately
  -- before the subscription row; the subscription trigger validates both.
  if not found then return; end if;
  if auth.role() = 'authenticated' and not v_entitlement.writes_allowed then
    raise exception 'SHOP_SUBSCRIPTION_INACTIVE' using errcode = '42501';
  end if;
  v_limit := (v_entitlement.resource_limits ->> p_resource)::integer;
  if v_limit is null then return; end if;
  v_usage := shop_private.plan_resource_usage(p_shop_id, p_resource);
  if v_usage + p_requested > v_limit then
    raise exception 'PLAN_RESOURCE_LIMIT_REACHED:%:%', p_resource, v_limit
      using errcode = '23514',
        detail = format('usage=%s requested=%s limit=%s', v_usage, p_requested, v_limit);
  end if;
end;
$$;

create or replace function shop_private.enforce_active_resource_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_resource text; v_increases boolean;
begin
  if tg_table_name = 'shop_locations' then
    v_resource := 'active_locations';
    v_increases := new.status = 'active'
      and (tg_op = 'INSERT' or old.status <> 'active');
  elsif tg_table_name = 'shop_memberships' then
    v_resource := 'active_members';
    v_increases := new.status = 'active' and new.removed_at is null
      and (tg_op = 'INSERT' or old.status <> 'active' or old.removed_at is not null);
  elsif tg_table_name = 'products' then
    v_resource := 'active_products';
    v_increases := new.is_active and (tg_op = 'INSERT' or not old.is_active);
  else
    v_resource := 'active_services';
    v_increases := new.is_active and (tg_op = 'INSERT' or not old.is_active);
  end if;
  if v_increases then
    perform shop_private.assert_plan_resource_capacity(new.shop_id, v_resource);
  end if;
  return new;
end;
$$;

create function shop_private.enforce_invitation_resource_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old_consumed boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_old_consumed := old.shop_id = new.shop_id and old.status = 'pending'
      and old.expires_at > now();
  end if;
  if new.status = 'pending' and new.expires_at > now() and not v_old_consumed then
    perform shop_private.assert_plan_resource_capacity(
      new.shop_id, 'active_members'
    );
  end if;
  return new;
end;
$$;

create trigger shop_team_invitations_plan_limit
before insert or update of shop_id, status, expires_at
on public.shop_team_invitations for each row
execute function shop_private.enforce_invitation_resource_limit();

-- Supported catalog RPCs delegate capacity entirely to the same row triggers
-- as privileged/direct writes. Mutable plan.features values are not a second
-- quota authority.
create or replace function shop_private.save_product(
  p_shop_id uuid, p_product_id uuid, p_name text, p_sku text,
  p_barcode text, p_sale_price numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_product_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'products.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or p_sale_price is null or p_sale_price < 0 or p_sale_price > 999999999.99
    or (p_sku is not null and length(btrim(p_sku)) > 80)
    or (p_barcode is not null and length(btrim(p_barcode)) > 80) then
    raise exception 'INVALID_PRODUCT' using errcode = '22023';
  end if;
  if p_product_id is null then
    begin
      insert into public.products (
        shop_id, name, sku, barcode, sale_price, created_by_profile_id
      ) values (
        p_shop_id, btrim(p_name), nullif(btrim(p_sku), ''),
        nullif(btrim(p_barcode), ''), p_sale_price, v_profile_id
      ) returning id into v_product_id;
    exception when check_violation then
      if sqlerrm like 'PLAN_RESOURCE_LIMIT_REACHED:active_products:%' then
        raise exception 'PRODUCT_LIMIT_REACHED' using errcode = '23514';
      end if;
      raise;
    end;
  else
    update public.products set name = btrim(p_name),
      sku = nullif(btrim(p_sku), ''), barcode = nullif(btrim(p_barcode), ''),
      sale_price = p_sale_price, updated_at = now()
    where id = p_product_id and shop_id = p_shop_id and is_active
    returning id into v_product_id;
    if v_product_id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  end if;
  return v_product_id;
end;
$$;

create or replace function shop_private.save_service(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_service_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or (p_description is not null and length(btrim(p_description)) > 1000)
    or p_base_sale_price is null or p_base_sale_price < 0
    or p_base_sale_price > 999999999.99
    or p_discount_type not in ('amount', 'percent') or p_discount_type is null
    or p_discount_value is null or p_discount_value < 0
    or (p_discount_type = 'percent' and p_discount_value > 100)
    or (p_discount_type = 'amount' and p_discount_value > p_base_sale_price) then
    raise exception 'INVALID_SERVICE' using errcode = '22023';
  end if;
  if p_service_id is null then
    begin
      insert into public.services (
        shop_id, name, description, base_sale_price,
        default_discount_type, default_discount_value, created_by_profile_id
      ) values (
        p_shop_id, btrim(p_name), nullif(btrim(p_description), ''), p_base_sale_price,
        p_discount_type, p_discount_value, v_profile_id
      ) returning id into v_service_id;
    exception when check_violation then
      if sqlerrm like 'PLAN_RESOURCE_LIMIT_REACHED:active_services:%' then
        raise exception 'SERVICE_LIMIT_REACHED' using errcode = '23514';
      end if;
      raise;
    end;
  else
    update public.services set name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      base_sale_price = p_base_sale_price,
      default_discount_type = p_discount_type,
      default_discount_value = p_discount_value, updated_at = now()
    where id = p_service_id and shop_id = p_shop_id and is_active
    returning id into v_service_id;
    if v_service_id is null then raise exception 'SERVICE_NOT_FOUND'; end if;
  end if;
  return v_service_id;
end;
$$;

-- Plan changes take all resource locks in the same canonical order used by
-- quota-increasing writes, then validate the target terms without mutating data.
create or replace function shop_private.subscription_catalog_terms()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shop_id uuid; v_limits jsonb; v_limit integer; v_usage bigint; v_resource text;
begin
  if tg_op = 'INSERT' and auth.uid() is not null and not exists (
    select 1 from public.plans plan
    where plan.id = new.plan_id and plan.is_active and plan.is_public
      and plan.is_purchasable and not plan.is_coming_soon
  ) then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id
    or new.catalog_terms_id is null then
    select terms.id, terms.resource_limits into new.catalog_terms_id, v_limits
    from public.plan_catalog_terms terms where terms.plan_id = new.plan_id
    order by terms.version desc limit 1;
    if new.catalog_terms_id is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  else
    select terms.resource_limits into v_limits
    from public.plan_catalog_terms terms where terms.id = new.catalog_terms_id;
  end if;
  if tg_op = 'UPDATE' and old.catalog_terms_id is not null
    and new.catalog_terms_id is distinct from old.catalog_terms_id
    and new.plan_id = old.plan_id then
    raise exception 'SUBSCRIPTION_TERMS_CHANGE_REQUIRES_PLAN_CHANGE' using errcode = '23514';
  end if;

  select membership.shop_id into v_shop_id
  from public.shop_memberships membership
  where membership.profile_id = new.profile_id and membership.role = 'owner'
  order by (membership.status = 'active') desc, membership.created_at, membership.id
  limit 1;

  if v_shop_id is not null
    and (tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id) then
    perform shop_private.lock_all_plan_resources(v_shop_id);
    foreach v_resource in array array[
      'active_locations', 'active_members', 'active_products', 'active_services'
    ] loop
      v_limit := (v_limits ->> v_resource)::integer;
      if v_limit is not null then
        v_usage := shop_private.plan_resource_usage(v_shop_id, v_resource);
        if v_usage > v_limit then
          raise exception 'PLAN_RESOURCE_LIMIT_EXCEEDED:%:%:%',
            v_resource, v_usage, v_limit using errcode = '23514';
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Acceptance converts a live invitation reservation into an active member
-- while holding one seat lock. Updating the invitation first avoids counting
-- both records; the transaction rolls both writes back on any later failure.
create or replace function shop_private.accept_shop_invitation(
  p_request_id uuid,
  p_invitation_code uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.shop_team_invitations%rowtype; v_user_id uuid := auth.uid();
  v_email text; v_shop_id uuid; v_portal_id uuid; v_profile_id uuid; v_membership_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED' using errcode = '22023'; end if;
  select event.shop_id into v_shop_id from public.shop_team_events event
    where event.request_id = p_request_id and event.action = 'accept'
      and event.actor_user_id = v_user_id;
  if found then return v_shop_id; end if;

  select invitation.shop_id into v_shop_id
  from public.shop_team_invitations invitation
  where invitation.invitation_code = p_invitation_code;
  if not found then raise exception 'INVITATION_UNAVAILABLE' using errcode = '55000'; end if;
  perform shop_private.lock_plan_resource(v_shop_id, 'active_members');
  select * into v_invitation from public.shop_team_invitations invitation
    where invitation.invitation_code = p_invitation_code for update;
  if not found or v_invitation.status <> 'pending'
    or v_invitation.expires_at <= clock_timestamp() then
    raise exception 'INVITATION_UNAVAILABLE' using errcode = '55000';
  end if;
  select lower(auth_user.email) into v_email from auth.users auth_user
    where auth_user.id = v_user_id and auth_user.email_confirmed_at is not null;
  if v_email is null or v_email <> v_invitation.email then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = '42501';
  end if;
  select shop.portal_id into v_portal_id from public.shops shop
    where shop.id = v_invitation.shop_id;
  select profile.id into v_profile_id from public.profiles profile
    where profile.user_id = v_user_id and profile.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
    values (v_user_id, v_portal_id, v_invitation.display_name, v_email)
    returning id into v_profile_id;
  elsif not exists (select 1 from public.profiles profile where profile.id = v_profile_id
      and profile.status = 'active'::public.profile_status) then
    raise exception 'PROFILE_INACTIVE' using errcode = '42501';
  end if;
  if exists (select 1 from public.shop_memberships membership
    where membership.shop_id = v_invitation.shop_id and membership.profile_id = v_profile_id) then
    if exists (select 1 from public.shop_memberships membership
      where membership.shop_id = v_invitation.shop_id and membership.profile_id = v_profile_id
        and membership.removed_at is not null) then
      raise exception 'MEMBER_REMOVED' using errcode = '55000';
    end if;
    raise exception 'MEMBER_ALREADY_EXISTS' using errcode = '23505';
  end if;

  update public.shop_team_invitations set status = 'accepted',
    accepted_at = clock_timestamp() where id = v_invitation.id;
  insert into public.shop_memberships (shop_id, profile_id, role, status)
  values (v_invitation.shop_id, v_profile_id, 'employee', 'active')
  returning id into v_membership_id;
  delete from public.membership_roles where membership_id = v_membership_id;
  insert into public.membership_roles (membership_id, role_id)
  values (v_membership_id, v_invitation.role_id);
  delete from public.membership_location_assignments where membership_id = v_membership_id;
  insert into public.membership_location_assignments (shop_id, membership_id, location_id)
    select v_invitation.shop_id, v_membership_id, link.location_id
    from public.shop_team_invitation_locations link where link.invitation_id = v_invitation.id;
  update public.shop_team_invitations set accepted_membership_id = v_membership_id
    where id = v_invitation.id;
  insert into public.shop_team_events (request_id, shop_id, actor_user_id, action,
    target_membership_id, target_invitation_id, after_state)
  values (p_request_id, v_invitation.shop_id, v_user_id, 'accept', v_membership_id,
    v_invitation.id, shop_private.team_member_snapshot(v_membership_id));
  return v_invitation.shop_id;
end;
$$;

create function shop_private.plan_usage_snapshot(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with entitlement as (
    select * from shop_private.resolve_plan_entitlement(p_shop_id)
  ), resources(resource, label, ordinal) as (values
    ('active_locations'::text, 'locations'::text, 1),
    ('active_members', 'members', 2),
    ('active_products', 'products', 3),
    ('active_services', 'services', 4)
  ), usage as (
    select resource, label, ordinal,
      shop_private.plan_resource_usage(p_shop_id, resource) used_value,
      (entitlement.resource_limits ->> resource)::integer limit_value
    from resources cross join entitlement
  )
  select jsonb_build_object(
    'locations', max(used_value) filter (where label = 'locations'),
    'members', max(used_value) filter (where label = 'members'),
    'products', max(used_value) filter (where label = 'products'),
    'services', max(used_value) filter (where label = 'services'),
    'limits', (select resource_limits from entitlement),
    'resources', jsonb_agg(jsonb_build_object(
      'resource', resource, 'used', used_value, 'limit', limit_value,
      'remaining', case when limit_value is null then null
        else greatest(limit_value - used_value, 0) end,
      'unlimited', limit_value is null,
      'atLimit', limit_value is not null and used_value >= limit_value,
      'overLimit', limit_value is not null and used_value > limit_value
    ) order by ordinal)
  ) from usage;
$$;

create function public.shop_plan_usage(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not shop_private.is_member(p_shop_id) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return shop_private.plan_usage_snapshot(p_shop_id);
end;
$$;

create or replace function public.shop_billing_read(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_subscription jsonb; v_result jsonb;
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
    'usage', shop_private.plan_usage_snapshot(p_shop_id),
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

create function public.shop_plan_change_validation(
  p_shop_id uuid,
  p_target_plan_slug text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_target_limits jsonb; v_target_plan_id uuid; v_blockers jsonb;
begin
  if not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select plan.id, terms.resource_limits into v_target_plan_id, v_target_limits
  from public.plans plan
  join public.portals portal on portal.id = plan.portal_id
  join lateral (select catalog.resource_limits from public.plan_catalog_terms catalog
    where catalog.plan_id = plan.id order by catalog.version desc limit 1) terms on true
  where portal.key = 'shop-crm' and plan.slug = p_target_plan_slug
    and plan.is_active and not plan.is_coming_soon;
  if v_target_plan_id is null then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;
  with resources(resource, ordinal) as (values
    ('active_locations'::text, 1), ('active_members', 2),
    ('active_products', 3), ('active_services', 4)
  ), impacts as (
    select resource, ordinal,
      shop_private.plan_resource_usage(p_shop_id, resource) used_value,
      (v_target_limits ->> resource)::integer limit_value
    from resources
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'resource', resource, 'used', used_value, 'limit', limit_value,
    'excess', used_value - limit_value
  ) order by ordinal) filter (where limit_value is not null and used_value > limit_value),
  '[]'::jsonb) into v_blockers from impacts;
  return jsonb_build_object(
    'shopId', p_shop_id, 'targetPlanId', v_target_plan_id,
    'targetPlanSlug', p_target_plan_slug, 'canApply', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers, 'mutated', false
  );
end;
$$;

revoke all on function shop_private.plan_resource_lock_key(uuid, text),
  shop_private.lock_plan_resource(uuid, text),
  shop_private.lock_all_plan_resources(uuid),
  shop_private.resolve_plan_entitlement(uuid),
  shop_private.plan_resource_usage(uuid, text),
  shop_private.assert_plan_resource_capacity(uuid, text, bigint),
  shop_private.enforce_invitation_resource_limit(),
  shop_private.plan_usage_snapshot(uuid)
from public, anon, authenticated, service_role;

revoke all on function public.shop_plan_usage(uuid),
  public.shop_plan_change_validation(uuid, text) from public, anon;
grant execute on function public.shop_plan_usage(uuid),
  public.shop_plan_change_validation(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
