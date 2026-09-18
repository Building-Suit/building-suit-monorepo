-- The invoker trigger functions need the private period check when a trusted
-- service_role write eventually posts an invoice, payment or expense.
grant usage on schema shop_private to service_role;
grant execute on function shop_private.assert_period_is_open(uuid, timestamptz)
  to service_role;
