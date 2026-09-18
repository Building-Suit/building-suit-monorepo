-- Disposable local catalog only. Hosted catalogs are migrated from their source.
insert into public.portals (key, name) values ('shop-crm', 'Shop Suit local fixture');
insert into public.plans (portal_id, name, slug, price_amount, currency, trial_days, features)
select id, 'Basic', 'basic', 799, 'EGP', 30, '{"max_products":100,"max_services":50}' from public.portals where key='shop-crm';
insert into public.plans (portal_id, name, slug, price_amount, currency, trial_days, features)
select id, 'Pro', 'pro', 1199, 'EGP', 30, '{"inventory":true,"max_products":1000,"max_services":500}' from public.portals where key='shop-crm';
