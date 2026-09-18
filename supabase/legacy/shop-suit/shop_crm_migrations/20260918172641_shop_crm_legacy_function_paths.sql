-- Existing public shop helpers remain revoked from browser roles until their
-- business logic is rebuilt. Pin their search paths to remove role-dependent
-- object lookup, including the attached immutable/period trigger helpers.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'assert_period_is_open', 'check_expense_period', 'check_invoice_period',
      'check_payment_period', 'deduct_inventory_fifo',
      'issue_invoice_and_deduct_inventory', 'post_vendor_invoice_and_create_batches',
      'prevent_inventory_movment_mutation', 'prevent_invoice_edit_after_issue',
      'prevent_payment_update', 'prevent_vendor_invoice_edit_after_post',
      'return_inventory_for_invoice', 'shop_has_active_subscription',
      'shop_has_feature', 'user_has_shop_permission', 'user_is_member_of_shop'
    ])
  loop
    execute format('alter function %s set search_path = %L', f.signature, '');
  end loop;
end;
$$;
