-- Preserve the source Shop service-role grants explicitly in dedicated projects.
-- Verified against jkdncdexqcymwbihwdhp on 2026-09-19. Project default
-- privileges differ, and ALTER ... SET SCHEMA does not apply public defaults.
-- This restores existing server-only access; browser grants and RLS are unchanged.
BEGIN;

GRANT ALL PRIVILEGES ON TABLE
  public."accounting_periods",
  public."cash_flow_daily",
  public."cash_flow_monthly",
  public."client_balances",
  public."clients",
  public."cogs_movements",
  public."daily_cogs_margin",
  public."dead_stock",
  public."expense_categories",
  public."expenses",
  public."inventory_aging",
  public."inventory_aging_value",
  public."inventory_batches",
  public."inventory_movements",
  public."inventory_stock_batches",
  public."inventory_turnover",
  public."invoice_balances",
  public."invoice_cogs",
  public."invoice_gross_margin",
  public."invoice_items",
  public."invoice_paid_amounts",
  public."invoice_product_cogs",
  public."invoice_product_revenue",
  public."invoices",
  public."membership_roles",
  public."monthly_cogs_margin",
  public."net_profit",
  public."payments",
  public."permissions",
  public."plans",
  public."portals",
  public."product_average_inventory",
  public."product_last_sale",
  public."product_profitability",
  public."product_sales_90d",
  public."products",
  public."profiles",
  public."role_permissions",
  public."roles",
  public."services",
  public."shop_memberships",
  public."shops",
  public."subscriptions",
  public."vendor_balances",
  public."vendor_invoice_balances",
  public."vendor_invoice_items",
  public."vendor_invoice_paid_amounts",
  public."vendor_invoices",
  public."vendors"
TO service_role;

GRANT EXECUTE ON FUNCTION public."assert_period_is_open"(_shop_id uuid, _date timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public."check_expense_period"() TO service_role;
GRANT EXECUTE ON FUNCTION public."check_invoice_period"() TO service_role;
GRANT EXECUTE ON FUNCTION public."check_payment_period"() TO service_role;
GRANT EXECUTE ON FUNCTION public."deduct_inventory_fifo"(_shop_id uuid, _product_id uuid, _quantity numeric, _reference_id uuid, _actor_profile_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public."issue_invoice_and_deduct_inventory"(_invoice_id uuid, _actor_profile_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public."post_vendor_invoice_and_create_batches"(_vendor_invoice_id uuid, _actor_profile_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public."prevent_inventory_movment_mutation"() TO service_role;
GRANT EXECUTE ON FUNCTION public."prevent_invoice_edit_after_issue"() TO service_role;
GRANT EXECUTE ON FUNCTION public."prevent_payment_update"() TO service_role;
GRANT EXECUTE ON FUNCTION public."prevent_vendor_invoice_edit_after_post"() TO service_role;
GRANT EXECUTE ON FUNCTION public."return_inventory_for_invoice"(_invoice_id uuid, _actor_profile_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public."shop_has_active_subscription"(_shop_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public."shop_has_feature"(_shop_id uuid, _feature_key text) TO service_role;
GRANT EXECUTE ON FUNCTION public."user_has_shop_permission"(_shop_id uuid, _permission_key text) TO service_role;
GRANT EXECUTE ON FUNCTION public."user_is_member_of_shop"(_shop_id uuid) TO service_role;

COMMIT;
