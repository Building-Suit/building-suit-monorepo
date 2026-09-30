-- Install the billing-notice fallback for databases that already applied the
-- initial catalog migration before its compatibility fix was added.
-- CREATE OR REPLACE preserves the existing trigger and function privileges.
create or replace function shop_private.billing_notice_commercial_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (
    new.catalog_terms_id is distinct from old.catalog_terms_id
    or new.plan_slug_snapshot is distinct from old.plan_slug_snapshot
    or new.plan_name_snapshot is distinct from old.plan_name_snapshot
    or new.billing_interval_snapshot is distinct from old.billing_interval_snapshot
    or new.resource_limits_snapshot is distinct from old.resource_limits_snapshot
    or new.expected_amount is distinct from old.expected_amount
    or new.currency is distinct from old.currency
  ) then raise exception 'BILLING_NOTICE_COMMERCIAL_TERMS_IMMUTABLE' using errcode = '55000'; end if;

  if tg_op = 'INSERT' then
    if new.plan_id is null then
      select subscription.plan_id into new.plan_id
      from public.shop_memberships membership
      join public.subscriptions subscription
        on subscription.profile_id = membership.profile_id
      where membership.shop_id = new.shop_id and membership.role = 'owner'
      order by (membership.status = 'active') desc,
        membership.created_at, membership.id
      limit 1;
    end if;
    select terms.id, plan.slug, terms.display_name, terms.billing_interval,
      terms.resource_limits, coalesce(new.expected_amount, terms.price_amount),
      coalesce(new.currency, terms.currency)
    into new.catalog_terms_id, new.plan_slug_snapshot, new.plan_name_snapshot,
      new.billing_interval_snapshot, new.resource_limits_snapshot,
      new.expected_amount, new.currency
    from public.plans plan
    join public.plan_catalog_terms terms on terms.plan_id = plan.id
    where plan.id = new.plan_id order by terms.version desc limit 1;
    if new.catalog_terms_id is null then
      raise exception 'PLAN_COMMERCIAL_TERMS_NOT_FOUND' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;
