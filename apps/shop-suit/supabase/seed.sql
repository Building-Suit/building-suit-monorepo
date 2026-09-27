-- Disposable local catalog only. Hosted catalogs are migrated from their source.
insert into public.portals (key, name) values ('shop-crm', 'Shop Suit local fixture');
insert into public.plans (portal_id, name, slug, price_amount, currency, trial_days, features)
select id, 'Basic', 'basic', 799, 'EGP', 30, '{"max_products":100,"max_services":50}' from public.portals where key='shop-crm';
insert into public.plans (portal_id, name, slug, price_amount, currency, trial_days, features)
select id, 'Pro', 'pro', 1199, 'EGP', 30, '{"inventory":true,"max_products":1000,"max_services":500}' from public.portals where key='shop-crm';
insert into public.permissions (portal_id, key, description)
select portal.id, permission.key, permission.description
from public.portals portal
cross join (values
  ('sales.view', 'View sales and inventory traceability'),
  ('sales.manage', 'Create and edit sale drafts'),
  ('sales.issue', 'Issue sales and deduct product inventory'),
  ('payments.view', 'View customer payments and receivables'),
  ('payments.receive', 'Record and allocate customer receipts'),
  ('payments.reverse', 'Reverse mistaken customer receipts'),
  ('payments.refund', 'Record outbound customer refunds')
) as permission(key, description)
where portal.key = 'shop-crm';
