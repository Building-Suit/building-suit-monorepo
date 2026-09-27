-- Keep browser callers on the supported public command surface. The public
-- wrappers retain the caller's JWT settings for auth.uid(), while executing as
-- their owner so authenticated does not need direct access to implementation
-- functions in shop_private.
alter function public.create_owner_shop(text, text) security definer;
alter function public.create_owner_shop(text, text, public.business_mode) security definer;
alter function public.set_shop_business_mode(uuid, public.business_mode) security definer;
alter function public.save_product(uuid, uuid, text, text, text, numeric) security definer;
alter function public.archive_product(uuid, uuid) security definer;
alter function public.save_service(uuid, uuid, text, text, numeric, text, numeric) security definer;
alter function public.archive_service(uuid, uuid) security definer;
alter function public.adjust_stock(uuid, uuid, uuid, numeric, numeric, text) security definer;
alter function public.save_expense(uuid, uuid, uuid, text, numeric, text, date, text) security definer;
alter function public.void_expense(uuid, uuid) security definer;
alter function public.create_vendor(uuid, text, text, text, text, text, text, text) security definer;
alter function public.create_supplier_purchase(uuid, uuid, uuid, text, date, text, jsonb) security definer;
alter function public.void_supplier_purchase(uuid, uuid) security definer;

revoke all on function
  shop_private.create_owner_shop(text, text),
  shop_private.create_owner_shop(text, text, public.business_mode),
  shop_private.set_shop_business_mode(uuid, public.business_mode),
  shop_private.save_product(uuid, uuid, text, text, text, numeric),
  shop_private.archive_product(uuid, uuid),
  shop_private.save_service(uuid, uuid, text, text, numeric, text, numeric),
  shop_private.archive_service(uuid, uuid),
  shop_private.adjust_stock(uuid, uuid, uuid, numeric, numeric, text),
  shop_private.save_expense(uuid, uuid, uuid, text, numeric, text, date, text),
  shop_private.void_expense(uuid, uuid),
  shop_private.assert_purchase_entitlement(uuid),
  shop_private.create_vendor(uuid, text, text, text, text, text, text, text),
  shop_private.create_supplier_purchase(uuid, uuid, uuid, text, date, text, jsonb),
  shop_private.void_supplier_purchase(uuid, uuid)
from public, anon, authenticated, service_role;

-- Add tenant identity to the foreign-key boundary for records written by the
-- supported stock, expense, and supplier-purchase commands. Validation is
-- deliberately immediate: pre-existing cross-shop rows abort the migration
-- instead of being repaired or discarded silently.
alter table public.products
  add constraint products_id_shop_unique unique (id, shop_id);
alter table public.vendors
  add constraint vendors_id_shop_unique unique (id, shop_id);
alter table public.expense_categories
  add constraint expense_categories_id_shop_unique unique (id, shop_id);
alter table public.inventory_batches
  add constraint inventory_batches_id_shop_product_unique
    unique (id, shop_id, product_id);

alter table public.stock_adjustment_requests
  add constraint stock_adjustment_requests_product_shop_fk
    foreign key (product_id, shop_id)
    references public.products (id, shop_id)
    on delete restrict
    not valid;
alter table public.inventory_batches
  add constraint inventory_batches_product_shop_fk
    foreign key (product_id, shop_id)
    references public.products (id, shop_id)
    on delete restrict
    not valid;
alter table public.inventory_movements
  add constraint inventory_movements_product_shop_fk
    foreign key (product_id, shop_id)
    references public.products (id, shop_id)
    on delete restrict
    not valid,
  add constraint inventory_movements_batch_shop_product_fk
    foreign key (batch_id, shop_id, product_id)
    references public.inventory_batches (id, shop_id, product_id)
    on delete restrict
    not valid;
alter table public.expenses
  add constraint expenses_category_shop_fk
    foreign key (category_id, shop_id)
    references public.expense_categories (id, shop_id)
    on delete restrict
    not valid;
alter table public.vendor_invoices
  add constraint vendor_invoices_vendor_shop_fk
    foreign key (vendor_id, shop_id)
    references public.vendors (id, shop_id)
    on delete restrict
    not valid;

alter table public.stock_adjustment_requests
  validate constraint stock_adjustment_requests_product_shop_fk;
alter table public.inventory_batches
  validate constraint inventory_batches_product_shop_fk;
alter table public.inventory_movements
  validate constraint inventory_movements_product_shop_fk;
alter table public.inventory_movements
  validate constraint inventory_movements_batch_shop_product_fk;
alter table public.expenses
  validate constraint expenses_category_shop_fk;
alter table public.vendor_invoices
  validate constraint vendor_invoices_vendor_shop_fk;

-- Reassert direct-write and legacy-sale boundaries alongside the new wrapper
-- posture. Read grants and RLS policies are intentionally unchanged.
revoke insert, update, delete, truncate on table
  public.products,
  public.services,
  public.vendors,
  public.expense_categories,
  public.expenses,
  public.stock_adjustment_requests,
  public.inventory_batches,
  public.inventory_movements,
  public.vendor_invoices,
  public.vendor_invoice_items,
  public.shop_business_mode_changes
from anon, authenticated;

revoke all on function public.issue_invoice_and_deduct_inventory(uuid, uuid)
from public, anon, authenticated;

notify pgrst, 'reload schema';
