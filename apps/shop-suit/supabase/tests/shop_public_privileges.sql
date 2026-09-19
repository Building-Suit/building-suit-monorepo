-- Regression boundary for dedicated-project server grants; fixtures are rolled back by the runner.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('service_role', 'public.profiles', 'SELECT', true),
    ('service_role', 'public.profiles', 'INSERT', true),
    ('service_role', 'public.products', 'UPDATE', true),
    ('service_role', 'public.plans', 'DELETE', true),
    ('anon', 'public.profiles', 'SELECT', false),
    ('authenticated', 'public.products', 'INSERT', false),
    ('authenticated', 'public.products', 'UPDATE', false),
    ('authenticated', 'public.expenses', 'DELETE', false)
  ) checks(role_name, relation_name, privilege_name, allowed)
  LOOP
    IF has_table_privilege(item.role_name, item.relation_name, item.privilege_name) <> item.allowed THEN
      RAISE EXCEPTION 'Unexpected % privilege for % on %', item.privilege_name, item.role_name, item.relation_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'A public Shop table is missing RLS';
  END IF;
  IF has_function_privilege('anon', 'public.issue_invoice_and_deduct_inventory(uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.issue_invoice_and_deduct_inventory(uuid,uuid)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.issue_invoice_and_deduct_inventory(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Legacy invoice helper must remain server-only';
  END IF;
  IF has_function_privilege('anon', 'public.create_owner_shop(text,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.create_owner_shop(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Owner onboarding RPC must require authentication';
  END IF;
  -- Authenticated invoker RPCs/RLS need the source's explicit helper usage grant.
  -- Internal write checks remain non-callable, and the schema is not a Data API schema.
  IF has_schema_privilege('anon', 'shop_private', 'USAGE')
    OR NOT has_schema_privilege('authenticated', 'shop_private', 'USAGE')
    OR has_function_privilege('authenticated', 'shop_private.assert_shop_write_access(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private helper boundary differs from the authorized source contract';
  END IF;
END $$;
