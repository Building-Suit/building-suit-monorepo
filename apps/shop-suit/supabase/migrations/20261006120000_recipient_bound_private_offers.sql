-- SS-SA-CUSTOM-OFFER-001: private terms extend the existing Shop billing authority.
-- No new plan family, automatic activation, or public catalog offer is created.
create table public.shop_private_offers (
  id uuid primary key,
  offer_version integer not null check (offer_version > 0),
  integration_principal_id uuid not null references public.shop_super_admin_integrations(id) on delete restrict,
  request_id uuid not null,
  shop_id uuid not null references public.shops(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete restrict,
  target_binding_id uuid not null,
  target_environment_id uuid not null,
  suit text not null check (suit = 'shop-suit'),
  expires_at timestamptz not null check (isfinite(expires_at)),
  plan_id uuid not null references public.plans(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  currency text not null check (currency = 'EGP'),
  price_amount numeric(12,2) not null check (price_amount > 0),
  resource_limits jsonb not null check (shop_private.valid_resource_limits(resource_limits)
    and resource_limits ?& array['active_locations','active_members','active_products',
      'active_services','active_customers','active_suppliers']),
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  created_at timestamptz not null default clock_timestamp(),
  unique (integration_principal_id, request_id),
  check (expires_at > created_at)
);

alter table public.plan_catalog_terms
  add column private_offer_id uuid unique references public.shop_private_offers(id) on delete restrict,
  add constraint private_offer_terms_hidden check (
    private_offer_id is null or (not is_public and not is_purchasable
      and plan_variant = 'private_offer'));

create table public.shop_private_offer_redemptions (
  offer_id uuid primary key references public.shop_private_offers(id) on delete restrict,
  submission_id uuid not null unique references public.shop_billing_submissions(id) on delete restrict,
  request_id uuid not null unique,
  redeemed_by_user_id uuid not null references auth.users(id) on delete restrict,
  redeemed_at timestamptz not null default clock_timestamp()
);

alter table public.shop_private_offers enable row level security;
alter table public.shop_private_offer_redemptions enable row level security;
revoke all on public.shop_private_offers, public.shop_private_offer_redemptions from public, anon, authenticated;
grant select, insert on public.shop_private_offers, public.shop_private_offer_redemptions to service_role;
create trigger shop_private_offers_immutable before update or delete or truncate
on public.shop_private_offers for each statement execute function shop_private.reject_commercial_snapshot_mutation();
create trigger shop_private_offer_redemptions_immutable before update or delete or truncate
on public.shop_private_offer_redemptions for each statement execute function shop_private.reject_commercial_snapshot_mutation();

create or replace function shop_private.current_plan_offers(
  p_plan_id uuid, p_at timestamptz default clock_timestamp()
) returns setof public.plan_catalog_terms
language sql stable security definer set search_path = '' as $$
  with effective as (
    select terms.*,
      max(terms.catalog_generation) over (partition by terms.plan_id) current_generation,
      row_number() over (
        partition by terms.plan_id, terms.catalog_generation,
          terms.plan_variant, terms.billing_interval
        order by terms.effective_from desc, terms.version desc, terms.id desc
      ) offer_rank
    from public.plan_catalog_terms terms
    where terms.plan_id = p_plan_id and terms.effective_from <= p_at
      and terms.private_offer_id is null
  )
  select effective.id, effective.plan_id, effective.version,
    effective.display_name, effective.billing_interval, effective.currency,
    effective.price_amount, effective.trial_days, effective.resource_limits,
    effective.is_public, effective.is_purchasable, effective.effective_from,
    effective.created_at, effective.catalog_generation,
    effective.plan_variant, effective.variant_name, effective.private_offer_id
  from effective
  where effective.catalog_generation = effective.current_generation
    and effective.offer_rank = 1
  order by case effective.plan_variant
      when 'standard' then 1 when 'multi_2' then 2 when 'multi_3' then 3 else 9 end,
    case effective.billing_interval when 'monthly' then 1 when 'annual' then 2 else 9 end;
$$;

create or replace function shop_private.apply_plan_catalog_v2_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_slug text;
begin
  if new.private_offer_id is not null then
    if not exists (select 1 from public.shop_private_offers offer
      where offer.id = new.private_offer_id and offer.plan_id = new.plan_id
        and offer.display_name = new.display_name and offer.billing_interval = new.billing_interval
        and offer.currency = new.currency and offer.price_amount = new.price_amount
        and offer.resource_limits = new.resource_limits
        and not new.is_public and not new.is_purchasable) then
      raise exception 'SHOP_PRIVATE_OFFER_TERMS_MISMATCH' using errcode = '23514';
    end if;
    new.catalog_generation := 2;
    new.plan_variant := 'private_offer';
    new.variant_name := new.display_name;
    return new;
  end if;
  select plan.slug into v_slug from public.plans plan where plan.id = new.plan_id;
  new.catalog_generation := 2;
  if v_slug = 'multi' then
    new.plan_variant := case (new.resource_limits ->> 'active_locations')::integer
      when 2 then 'multi_2' when 3 then 'multi_3' else null end;
    if new.plan_variant is null then
      raise exception 'MULTI_VARIANT_BRANCH_LIMIT_INVALID' using errcode = '23514';
    end if;
    new.variant_name := case new.plan_variant
      when 'multi_2' then 'Multi · 2 branches' else 'Multi · 3 branches' end;
  else
    new.plan_variant := 'standard';
    new.variant_name := initcap(replace(v_slug, '-', ' '));
  end if;
  return new;
end;
$$;

-- Private terms can be activated only for their bound owner/shop through a
-- frozen pending billing notice. Even privileged plan changes cannot transplant them.
create function shop_private.subscription_private_offer_binding()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_offer public.shop_private_offers; v_changed boolean;
begin
  select offer.* into v_offer from public.plan_catalog_terms terms
  join public.shop_private_offers offer on offer.id = terms.private_offer_id
  where terms.id = new.catalog_terms_id;
  if not found then return new; end if;
  if not exists (select 1 from public.profiles profile
    join public.shop_memberships membership on membership.profile_id = profile.id
    where profile.id = new.profile_id and profile.user_id = v_offer.recipient_user_id
      and membership.shop_id = v_offer.shop_id and membership.role = 'owner'
      and membership.status = 'active') then
    raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode = '42501';
  end if;
  v_changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    v_changed := new.catalog_terms_id is distinct from old.catalog_terms_id
      or new.profile_id is distinct from old.profile_id;
  end if;
  if v_changed and (current_setting('shop.billing_approval', true) is distinct from 'approved'
    or shop_private.platform_admin_role() is distinct from 'operator'
    or not exists (select 1 from public.shop_billing_submissions notice
      join public.shop_private_offer_redemptions redemption on redemption.submission_id = notice.id
      where redemption.offer_id = v_offer.id and notice.shop_id = v_offer.shop_id
        and notice.catalog_terms_id = new.catalog_terms_id
        and notice.status in ('submitted','under_review'))) then
    raise exception 'SHOP_PRIVATE_OFFER_APPROVAL_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger subscriptions_01_private_offer_binding
before insert or update of catalog_terms_id, profile_id on public.subscriptions
for each row execute function shop_private.subscription_private_offer_binding();
revoke all on function shop_private.subscription_private_offer_binding() from public, anon, authenticated, service_role;

-- Only the authenticated bridge dispatch can register an approved offer.
create function shop_private.register_private_offer(
  p_request_id uuid, p_reason text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_principal public.shop_super_admin_integrations;
  v_offer public.shop_private_offers;
  v_price numeric;
begin
  if auth.role() is distinct from 'service_role'
    or nullif(current_setting('shop.super_admin_bridge_principal_id', true), '') is null then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  select * into v_principal from public.shop_super_admin_integrations
  where id = current_setting('shop.super_admin_bridge_principal_id', true)::uuid
    and enabled and retired_at is null and valid_from <= clock_timestamp()
    and (valid_until is null or valid_until > clock_timestamp());
  if not found then raise exception 'SHOP_SUPER_ADMIN_AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if p_request_id is null or p_reason is null or length(btrim(p_reason)) not between 2 and 1000
    or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 8192
    or not (p_payload ?& array['offerId','offerVersion','shopId','recipientUserId',
      'targetBindingId','targetEnvironmentId','suit','expiresAt','planId','displayName',
      'billingInterval','currency','priceAmount','resourceLimits'])
    or (p_payload - array['offerId','offerVersion','shopId','recipientUserId',
      'targetBindingId','targetEnvironmentId','suit','expiresAt','planId','displayName',
      'billingInterval','currency','priceAmount','resourceLimits']) <> '{}'::jsonb
    or exists (select 1 from jsonb_each(p_payload) entry where entry.value = 'null'::jsonb)
    or jsonb_typeof(p_payload -> 'priceAmount') is distinct from 'number'
    or jsonb_typeof(p_payload -> 'offerVersion') is distinct from 'number'
    or (p_payload ->> 'offerVersion') !~ '^[1-9][0-9]*$'
    or not coalesce(shop_private.valid_resource_limits(p_payload -> 'resourceLimits'), false)
    or not (p_payload -> 'resourceLimits' ?& array['active_locations','active_members',
      'active_products','active_services','active_customers','active_suppliers']) then
    raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode = '22023';
  end if;
  if p_payload ->> 'suit' <> 'shop-suit'
    or (p_payload ->> 'targetBindingId')::uuid <> v_principal.target_binding_id
    or (p_payload ->> 'targetEnvironmentId')::uuid <> v_principal.target_environment_id then
    raise exception 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_price := (p_payload ->> 'priceAmount')::numeric;
  if v_price <= 0 or v_price > 9999999999.99 or v_price <> round(v_price, 2)
    or p_payload ->> 'currency' <> 'EGP'
    or p_payload ->> 'billingInterval' not in ('monthly','annual')
    or length(btrim(p_payload ->> 'displayName')) not between 1 and 80
    or not isfinite((p_payload ->> 'expiresAt')::timestamptz)
    or (p_payload ->> 'expiresAt')::timestamptz <= clock_timestamp()
    or exists (select 1 from jsonb_each(p_payload -> 'resourceLimits') entry
      where jsonb_typeof(entry.value) = 'number' and entry.value::text::numeric > 2147483647) then
    raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode = '22023';
  end if;
  -- The recipient is a project-local Auth subject with an active owner membership.
  if not exists (select 1 from public.shop_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.subscriptions subscription on subscription.profile_id = profile.id
    where membership.shop_id = (p_payload ->> 'shopId')::uuid
      and profile.user_id = (p_payload ->> 'recipientUserId')::uuid
      and membership.role = 'owner' and membership.status = 'active') then
    raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plans plan join public.portals portal on portal.id = plan.portal_id
    where plan.id = (p_payload ->> 'planId')::uuid and portal.key = 'shop-crm'
      and plan.slug in ('solo','team','multi') and plan.is_active) then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;
  insert into public.shop_private_offers (id, offer_version, integration_principal_id,
    request_id, shop_id, recipient_user_id, target_binding_id, target_environment_id,
    suit, expires_at, plan_id, display_name, billing_interval, currency, price_amount,
    resource_limits, reason)
  values ((p_payload ->> 'offerId')::uuid, (p_payload ->> 'offerVersion')::integer,
    v_principal.id, p_request_id, (p_payload ->> 'shopId')::uuid,
    (p_payload ->> 'recipientUserId')::uuid, v_principal.target_binding_id,
    v_principal.target_environment_id, 'shop-suit', (p_payload ->> 'expiresAt')::timestamptz,
    (p_payload ->> 'planId')::uuid, btrim(p_payload ->> 'displayName'),
    p_payload ->> 'billingInterval', 'EGP', v_price, p_payload -> 'resourceLimits', btrim(p_reason))
  returning * into v_offer;
  return jsonb_build_object('data', jsonb_build_object('offerId', v_offer.id,
    'offerVersion', v_offer.offer_version, 'shopId', v_offer.shop_id, 'expiresAt', v_offer.expires_at));
exception when unique_violation then
  raise exception 'SHOP_PRIVATE_OFFER_ALREADY_REGISTERED' using errcode = '23505';
end;
$$;

-- Keep the exact existing approval command as the authoritative implementation.
alter function public.platform_admin_billing_command(uuid,text,uuid,text,jsonb)
  rename to platform_admin_billing_command_existing;
alter function public.platform_admin_billing_command_existing(uuid,text,uuid,text,jsonb)
  set schema shop_private;
revoke all on function shop_private.platform_admin_billing_command_existing(uuid,text,uuid,text,jsonb)
  from public, anon, authenticated, service_role;
create function public.platform_admin_billing_command(
  p_request_id uuid, p_action text, p_submission_id uuid, p_reason text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_action = 'register_private_offer' then
    if p_submission_id is not null then
      raise exception 'SHOP_PRIVATE_OFFER_INVALID' using errcode = '22023';
    end if;
    return shop_private.register_private_offer(p_request_id, p_reason, p_payload);
  end if;
  return shop_private.platform_admin_billing_command_existing(
    p_request_id, p_action, p_submission_id, p_reason, p_payload);
end;
$$;
revoke all on function public.platform_admin_billing_command(uuid,text,uuid,text,jsonb) from public, anon;
grant execute on function public.platform_admin_billing_command(uuid,text,uuid,text,jsonb) to authenticated, service_role;

create function public.redeem_shop_private_offer(
  p_request_id uuid, p_offer_id uuid, p_offer_version integer, p_shop_id uuid,
  p_target_binding_id uuid, p_target_environment_id uuid,
  p_paid_amount numeric, p_transfer_date date, p_transfer_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_offer public.shop_private_offers;
  v_receipt public.shop_private_offer_redemptions;
  v_notice public.shop_billing_submissions;
  v_profile_id uuid; v_terms_id uuid; v_version integer; v_notice_id uuid;
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null
    or not shop_private.is_owner(p_shop_id) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_request_id is null or p_offer_id is null or p_offer_version is null
    or p_shop_id is null or p_target_binding_id is null or p_target_environment_id is null
    or p_paid_amount is null or p_paid_amount <= 0 or p_paid_amount > 9999999999.99
    or p_paid_amount <> round(p_paid_amount,2)
    or p_transfer_date is null or p_transfer_date > current_date or p_transfer_date < current_date - 365
    or p_transfer_reference is null or length(btrim(p_transfer_reference)) not between 2 and 200 then
    raise exception 'BILLING_NOTICE_INVALID' using errcode = '22023';
  end if;
  -- Same request lock as the standard notice path; offer row serializes consumers.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_offer from public.shop_private_offers where id = p_offer_id for update;
  if not found then raise exception 'SHOP_PRIVATE_OFFER_NOT_FOUND' using errcode = '22023'; end if;
  if v_offer.recipient_user_id <> auth.uid() or v_offer.shop_id <> p_shop_id then
    raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode = '42501';
  end if;
  if v_offer.offer_version <> p_offer_version or v_offer.target_binding_id <> p_target_binding_id
    or v_offer.target_environment_id <> p_target_environment_id then
    raise exception 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' using errcode = '42501';
  end if;
  select profile.id into v_profile_id from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  join public.subscriptions subscription on subscription.profile_id = profile.id
  where membership.shop_id = p_shop_id and membership.role = 'owner'
    and membership.status = 'active' and profile.user_id = auth.uid();
  if v_profile_id is null then raise exception 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' using errcode = '42501'; end if;
  select * into v_receipt from public.shop_private_offer_redemptions where offer_id = p_offer_id;
  if found then
    select * into v_notice from public.shop_billing_submissions where id = v_receipt.submission_id;
    if v_receipt.request_id = p_request_id and v_receipt.redeemed_by_user_id = auth.uid()
      and v_notice.paid_amount = p_paid_amount and v_notice.transfer_date = p_transfer_date
      and v_notice.transfer_reference = btrim(p_transfer_reference) then
      return v_notice.id; -- exact retry retrieves the frozen result even after expiry
    end if;
    raise exception 'SHOP_PRIVATE_OFFER_ALREADY_REDEEMED' using errcode = '23505';
  end if;
  if exists (select 1 from public.shop_billing_submissions where request_id = p_request_id) then
    raise exception 'BILLING_NOTICE_KEY_REUSED' using errcode = '22023';
  end if;
  if v_offer.expires_at <= clock_timestamp() then
    raise exception 'SHOP_PRIVATE_OFFER_EXPIRED' using errcode = '22023';
  end if;
  -- Append private immutable terms to an existing family, never update plans.
  perform 1 from public.plans where id = v_offer.plan_id for update;
  select coalesce(max(version),0)+1 into v_version from public.plan_catalog_terms where plan_id = v_offer.plan_id;
  insert into public.plan_catalog_terms (plan_id, version, display_name, billing_interval,
    currency, price_amount, trial_days, resource_limits, is_public, is_purchasable,
    private_offer_id, plan_variant, variant_name)
  values (v_offer.plan_id, v_version, v_offer.display_name, v_offer.billing_interval,
    v_offer.currency, v_offer.price_amount, 7, v_offer.resource_limits, false, false,
    v_offer.id, 'private_offer', v_offer.display_name)
  returning id into v_terms_id;
  insert into public.shop_billing_submissions (request_id, shop_id, submitted_by_profile_id,
    plan_id, catalog_terms_id, list_price_amount, effective_price_amount, expected_amount,
    price_source, quoted_at, kind, status, amount, paid_amount, currency, reference,
    transfer_date, transfer_reference, metadata)
  values (p_request_id, p_shop_id, v_profile_id, v_offer.plan_id, v_terms_id,
    v_offer.price_amount, v_offer.price_amount, v_offer.price_amount, 'catalog', clock_timestamp(),
    'activation','submitted',p_paid_amount,p_paid_amount,v_offer.currency,btrim(p_transfer_reference),
    p_transfer_date,btrim(p_transfer_reference),jsonb_build_object('channel','instapay_manual',
      'automaticVerification',false,'privateOfferId',v_offer.id,'privateOfferVersion',v_offer.offer_version))
  returning id into v_notice_id;
  insert into public.shop_private_offer_redemptions (offer_id, submission_id, request_id, redeemed_by_user_id)
  values (v_offer.id, v_notice_id, p_request_id, auth.uid());
  return v_notice_id;
end;
$$;
revoke all on function public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text)
  from public, anon, service_role;
grant execute on function public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text)
  to authenticated;
revoke all on function shop_private.register_private_offer(uuid,text,jsonb) from public, anon, authenticated, service_role;

create or replace function shop_private.bridge_manifest(p_principal_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with manifest as (
    select jsonb_build_object(
      'adapterId', 'shop-suit-super-admin-bridge', 'suit', 'shop-suit',
      'targetBindingId', principal.target_binding_id,
      'targetEnvironmentId', principal.target_environment_id,
      'audience', principal.audience, 'health', 'ready',
      'manifestSchemaVersion', '1.0', 'protocolVersions', jsonb_build_array('1.0'),
      'manifestRevision', 'ss-sa-custom-offer-001-v1', 'issuedAt', clock_timestamp(),
      'capabilities', coalesce(jsonb_agg(jsonb_build_object(
        'operation', operation, 'version', '1.0',
        'kind', case when operation like '%.command' then 'command' else 'query' end,
        'idempotency', case when operation like '%.command' then 'exact-request-id' else 'nonce-only' end,
        'members', case operation
          when 'adapter.capabilities.read' then jsonb_build_array('manifest')
          when 'shop.platform.query' then to_jsonb(array['dashboard','shops','shop','audit'])
          when 'shop.platform.command' then to_jsonb(array['suspend_shop','reactivate_shop','add_support_note'])
          when 'shop.billing.query' then to_jsonb(array['queue','configuration','summary','audit'])
          when 'shop.billing.command' then to_jsonb(array['configure_instructions','mark_under_review','approve','reject','set_price_override','register_private_offer'])
          when 'shop.plan.query' then to_jsonb(array['catalog','shop','audit'])
          when 'shop.plan.command' then to_jsonb(array['publish_terms','set_availability','change_subscription',
            'renew_subscription','suspend_subscription','set_price_override','remove_price_override'])
        end
      ) order by operation), '[]'::jsonb)
    ) value
    from public.shop_super_admin_integrations principal,
      unnest(principal.allowed_operations) operation
    where principal.id = p_principal_id
    group by principal.id
  )
  select value || jsonb_build_object('manifestDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(value::text, 'UTF8'), 'sha256'), 'hex'))
  from manifest;
$$;

create or replace function public.shop_super_admin_bridge_invoke(
  p_principal_id uuid, p_nonce uuid, p_body_digest text, p_envelope jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_principal public.shop_super_admin_integrations; v_receipt public.shop_super_admin_nonce_receipts;
  v_prior public.shop_super_admin_requests; v_payload jsonb; v_actor jsonb;
  v_operation text; v_request_id uuid; v_correlation_id uuid; v_reason text;
  v_internal_request_id uuid; v_result jsonb; v_audit_id uuid; v_target_id uuid;
  v_is_command boolean; v_request_audit_id uuid;
begin
  if auth.role() <> 'service_role' or jsonb_typeof(p_envelope) <> 'object'
    or p_body_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  select * into v_principal from public.shop_super_admin_integrations principal
  where principal.id = p_principal_id and principal.enabled
    and principal.retired_at is null and principal.valid_from <= clock_timestamp()
    and (principal.valid_until is null or principal.valid_until > clock_timestamp())
  for update;
  if not found then raise exception 'SHOP_SUPER_ADMIN_AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select * into v_receipt from public.shop_super_admin_nonce_receipts receipt
  where receipt.integration_principal_id = p_principal_id and receipt.nonce = p_nonce
    and receipt.body_digest = p_body_digest and receipt.expires_at > clock_timestamp();
  if not found then raise exception 'SHOP_SUPER_ADMIN_NONCE_REQUIRED' using errcode = '42501'; end if;

  if (p_envelope - array['protocolVersion','operation','operationVersion','requestId',
      'correlationId','sourceBindingId','targetBindingId','targetEnvironmentId',
      'actor','reason','payload']) <> '{}'::jsonb
    or p_envelope ->> 'protocolVersion' <> v_principal.protocol_version
    or p_envelope ->> 'operationVersion' <> '1.0'
    or (p_envelope ->> 'sourceBindingId')::uuid <> v_principal.source_binding_id
    or (p_envelope ->> 'targetBindingId')::uuid <> v_principal.target_binding_id
    or (p_envelope ->> 'targetEnvironmentId')::uuid <> v_principal.target_environment_id then
    raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_operation := p_envelope ->> 'operation';
  if not (v_operation = any(v_principal.allowed_operations)) then
    raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_DENIED' using errcode = '42501';
  end if;
  v_request_id := (p_envelope ->> 'requestId')::uuid;
  v_correlation_id := (p_envelope ->> 'correlationId')::uuid;
  if v_receipt.request_id <> v_request_id then
    raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_payload := p_envelope -> 'payload'; v_actor := p_envelope -> 'actor';
  v_reason := nullif(btrim(p_envelope ->> 'reason'), '');
  v_is_command := v_operation like '%.command';
  if jsonb_typeof(v_payload) <> 'object'
    or jsonb_typeof(v_actor) <> 'object'
    or (v_actor - array['authorityBindingId','subjectId','roleSnapshot','sessionId']) <> '{}'::jsonb
    or (v_is_command and (v_reason is null or length(v_reason) not between 2 and 1000))
    or (not v_is_command and v_reason is not null) then
    raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023';
  end if;

  if v_is_command then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_principal_id::text || ':' || v_request_id::text, 0));
    select * into v_prior from public.shop_super_admin_requests request
    where request.integration_principal_id = p_principal_id
      and request.request_id = v_request_id and request.is_command;
    if found then
      if v_prior.operation <> v_operation or v_prior.operation_version <> p_envelope ->> 'operationVersion'
        or v_prior.body_digest <> p_body_digest or v_prior.reason <> v_reason then
        raise exception 'SHOP_SUPER_ADMIN_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
      end if;
      return jsonb_build_object('data', v_prior.result, 'replayed', true,
        'targetAuditId', v_prior.id, 'targetResultVersion', v_prior.result_version);
    end if;
  end if;

  perform set_config('shop.super_admin_bridge_principal_id', p_principal_id::text, true);
  v_internal_request_id := shop_private.bridge_internal_request_id(p_principal_id, v_request_id, v_operation);

  if v_operation = 'adapter.capabilities.read' then
    if v_payload <> '{}'::jsonb then raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    v_result := shop_private.bridge_manifest(p_principal_id);
  elsif v_operation = 'shop.platform.query' then
    if (v_payload - array['resource','shopId','search','status','page','pageSize']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'resource' not in ('dashboard','shops','shop','audit') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'shopId', '')::uuid;
    v_result := public.platform_admin_read(v_payload ->> 'resource', v_target_id,
      v_payload ->> 'search', v_payload ->> 'status',
      coalesce((v_payload ->> 'page')::integer, 1), coalesce((v_payload ->> 'pageSize')::integer, 25));
  elsif v_operation = 'shop.platform.command' then
    if (v_payload - array['shopId','action','payload']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'action' not in ('suspend_shop','reactivate_shop','add_support_note') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := (v_payload ->> 'shopId')::uuid;
    v_result := public.platform_admin_command(v_internal_request_id, v_target_id,
      v_payload ->> 'action', v_reason, coalesce(v_payload -> 'payload', '{}'::jsonb));
  elsif v_operation = 'shop.billing.query' then
    if (v_payload - array['resource','status','page','pageSize']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'resource' not in ('queue','configuration','summary','audit') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_result := public.platform_admin_billing_read(v_payload ->> 'resource',
      v_payload ->> 'status', coalesce((v_payload ->> 'page')::integer, 1),
      coalesce((v_payload ->> 'pageSize')::integer, 25));
  elsif v_operation = 'shop.billing.command' then
    if (v_payload - array['action','submissionId','payload']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'action' not in ('configure_instructions','mark_under_review',
      'approve','reject','set_price_override','register_private_offer') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'submissionId', '')::uuid;
    if v_payload ->> 'action' = 'register_private_offer' then
      v_target_id := (v_payload #>> '{payload,shopId}')::uuid;
    end if;
    v_result := public.platform_admin_billing_command(v_internal_request_id,
      v_payload ->> 'action', nullif(v_payload ->> 'submissionId', '')::uuid, v_reason,
      coalesce(v_payload -> 'payload', '{}'::jsonb));
  elsif v_operation = 'shop.plan.query' then
    if (v_payload - array['resource','shopId','page','pageSize']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'resource' not in ('catalog','shop','audit') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := nullif(v_payload ->> 'shopId', '')::uuid;
    v_result := public.platform_plan_read(v_payload ->> 'resource', v_target_id,
      coalesce((v_payload ->> 'page')::integer, 1), coalesce((v_payload ->> 'pageSize')::integer, 50));
  elsif v_operation = 'shop.plan.command' then
    if (v_payload - array['action','planId','shopId','payload']) <> '{}'::jsonb then
      raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023'; end if;
    if v_payload ->> 'action' not in ('publish_terms','set_availability','change_subscription',
      'renew_subscription','suspend_subscription','set_price_override','remove_price_override') then
      raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023'; end if;
    v_target_id := coalesce(nullif(v_payload ->> 'shopId', '')::uuid,
      nullif(v_payload ->> 'planId', '')::uuid);
    v_result := public.platform_plan_command(v_internal_request_id, v_payload ->> 'action',
      v_reason, nullif(v_payload ->> 'planId', '')::uuid, v_target_id,
      coalesce(v_payload -> 'payload', '{}'::jsonb));
  else
    raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_UNSUPPORTED' using errcode = '22023';
  end if;

  v_audit_id := nullif(v_result ->> 'auditId', '')::uuid;
  insert into public.shop_super_admin_requests (
    integration_principal_id, request_id, correlation_id, operation,
    operation_version, is_command, target_resource_id, body_digest, reason,
    external_authority_binding_id, external_subject_id, external_role_snapshot,
    external_session_id, underlying_audit_id, result, result_digest
  ) values (
    p_principal_id, v_request_id, v_correlation_id, v_operation,
    p_envelope ->> 'operationVersion', v_is_command, v_target_id, p_body_digest, v_reason,
    (v_actor ->> 'authorityBindingId')::uuid, (v_actor ->> 'subjectId')::uuid,
    v_actor ->> 'roleSnapshot', nullif(v_actor ->> 'sessionId', ''), v_audit_id,
    case when v_is_command then v_result -> 'data' else null end,
    md5(coalesce(v_result::text, 'null'))
  ) returning id into v_request_audit_id;
  return jsonb_build_object('data', case when v_is_command then v_result -> 'data' else v_result end,
    'replayed', false, 'targetAuditId', v_request_audit_id, 'targetResultVersion', 1);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023';
end;
$$;

notify pgrst, 'reload schema';
