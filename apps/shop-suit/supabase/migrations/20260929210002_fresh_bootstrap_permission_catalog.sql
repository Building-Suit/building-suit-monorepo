-- SS-BOOTSTRAP-PERMISSION-REPAIR
-- Fresh hosted databases apply migrations before seed.sql. Several historical
-- migrations populate portal-scoped permissions, so those inserts were no-ops
-- when the shop-crm portal did not yet exist. Establish the portal before the
-- seed phase and replay the canonical permission catalog additively.

insert into public.portals (key, name)
values ('shop-crm', 'Shop Suit')
on conflict (key) do nothing;

insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('appointments.manage', 'Create, reschedule and update appointments'),
  ('appointments.schedule.manage', 'Manage staff working hours, breaks and time off'),
  ('appointments.view', 'View staff calendars and appointment history'),
  ('cash_shifts.adjust', 'Record authorized drawer pay-ins and pay-outs'),
  ('cash_shifts.manage', 'Review and manage cashier shifts'),
  ('cash_shifts.use', 'Open and close the signed-in cashier drawer'),
  ('clients.manage', 'Manage customers'),
  ('clients.view', 'View customers'),
  ('discounts.manage', 'Apply discretionary discounts'),
  ('expenses.manage', 'Manage expenses'),
  ('expenses.view', 'View expenses'),
  ('inventory.adjust', 'Record stock counts and manual stock adjustments'),
  ('inventory.manage', 'Manage stock receipts and thresholds'),
  ('inventory.view', 'View inventory and stock history'),
  ('payments.receive', 'Record and allocate customer receipts'),
  ('payments.refund', 'Record outbound customer refunds'),
  ('payments.reverse', 'Reverse mistaken customer receipts'),
  ('payments.view', 'View customer payments and receivables'),
  ('products.manage', 'Manage the product catalog'),
  ('products.view', 'View the product catalog'),
  ('purchase_returns.manage', 'Return purchased stock'),
  ('reports.cost_profit.view', 'View cost and profit figures'),
  ('reports.view', 'View operational reports'),
  ('sales.issue', 'Issue sales and deduct product inventory'),
  ('sales.manage', 'Create and edit sale drafts'),
  ('sales.view', 'View sales'),
  ('services.manage', 'Manage the service catalog'),
  ('services.view', 'View the service catalog'),
  ('settings.manage', 'Manage business settings'),
  ('supplier_credits.manage', 'Record supplier credits'),
  ('supplier_payments.record', 'Record supplier payments'),
  ('supplier_payments.reverse', 'Reverse supplier payments'),
  ('team.audit.view', 'View sensitive team audit history'),
  ('team.manage', 'Invite, suspend, remove, and assign staff'),
  ('team.permissions.manage', 'Change staff roles and permissions'),
  ('team.view', 'View the team and assignments'),
  ('vendor_invoices.manage', 'Create and post supplier purchases'),
  ('vendor_invoices.view', 'View supplier purchases'),
  ('vendors.manage', 'Manage suppliers'),
  ('vendors.view', 'View suppliers')
) as permission(key, description)
where portal.key = 'shop-crm'
on conflict (portal_id, key) do update
set description = excluded.description;

-- Rebuild the standard role bindings for any existing shops.
select shop_private.ensure_shop_team_roles(shop.id)
from public.shops shop;

-- Re-fire the later role permission grant triggers (appointments, cash shifts,
-- etc.) without changing the role key value.
update public.roles
set key = key
where key is not null;

notify pgrst, 'reload schema';
