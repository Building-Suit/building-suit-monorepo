begin;

create function public.confirm_assistant_expense(
  p_request_id uuid,
  p_shop_id uuid,
  p_location_id uuid,
  p_category_id uuid,
  p_title text,
  p_amount numeric,
  p_expense_date date,
  p_expected_category_name text,
  p_expected_currency text,
  p_expected_location_name text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner_profile_id uuid;
  v_expense_id uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Ownership transfer locks the owner membership before writing its shop audit
  -- event. Use that same order before taking the normal shop write lock.
  select profile.id into v_owner_profile_id
  from public.shop_memberships membership
  join public.profiles profile on profile.id = membership.profile_id
  join public.shops shop on shop.id = membership.shop_id and shop.portal_id = profile.portal_id
  join public.portals portal on portal.id = shop.portal_id
  where membership.shop_id = p_shop_id and membership.role = 'owner'
    and membership.status = 'active' and membership.removed_at is null
    and profile.user_id = auth.uid() and profile.status = 'active'
    and portal.key = 'shop-crm' and portal.is_active
  for share of membership, profile, portal;
  if not found then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;

  perform shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  perform 1 from public.shops shop
    where shop.id = p_shop_id and shop.business_currency = p_expected_currency;
  if not found then
    raise exception 'ASSISTANT_EXPENSE_DETAILS_CHANGED' using errcode = '55000';
  end if;

  perform 1 from public.shop_locations location
    where location.shop_id = p_shop_id and location.id = p_location_id
      and location.status = 'active' and location.name = p_expected_location_name
    for share;
  if not found then
    raise exception 'ASSISTANT_EXPENSE_DETAILS_CHANGED' using errcode = '55000';
  end if;

  perform 1 from public.expense_categories category
    where category.shop_id = p_shop_id and category.id = p_category_id
      and category.is_active and category.name = p_expected_category_name
    for share;
  if not found then
    raise exception 'ASSISTANT_EXPENSE_DETAILS_CHANGED' using errcode = '55000';
  end if;

  v_expense_id := shop_private.save_expense(
    p_request_id, p_shop_id, p_location_id, null,
    p_title, p_amount, p_expected_category_name, p_expense_date, null
  );

  -- The existing command resolves by name and can return a prior request.
  -- Check its actual record against the reviewed identifiers before committing.
  if not exists (
    select 1 from public.expenses expense
    where expense.id = v_expense_id and expense.shop_id = p_shop_id
      and expense.location_id = p_location_id and expense.category_id = p_category_id
      and expense.currency = p_expected_currency
      and expense.created_by_profile_id = v_owner_profile_id
  ) then
    raise exception 'EXPENSE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  return v_expense_id;
end;
$$;

revoke all on function public.confirm_assistant_expense(uuid, uuid, uuid, uuid, text, numeric, date, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_assistant_expense(uuid, uuid, uuid, uuid, text, numeric, date, text, text, text)
  to authenticated;

comment on function public.confirm_assistant_expense(uuid, uuid, uuid, uuid, text, numeric, date, text, text, text) is
  'Record one owner-reviewed paid expense under the ordinary Shop write, audit and replay rules.';

notify pgrst, 'reload schema';
commit;
