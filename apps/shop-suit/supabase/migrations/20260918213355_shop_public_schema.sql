-- Dedicated Shop project: namespace relocation only. No columns, IDs or values change.
-- Run after the source baseline/restore and before switching clients to public.
BEGIN;
DO $relocate$
DECLARE item record;
BEGIN
  IF to_regnamespace('shop_crm') IS NULL THEN
    RAISE EXCEPTION 'Expected the Shop source schema before relocation';
  END IF;
  -- Every collision aborts the transaction instead of replacing another product.
  FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='shop_crm' AND c.relkind IN ('r','p','v','m','S')
  LOOP
    IF to_regclass(format('public.%I',item.relname)) IS NOT NULL THEN
      RAISE EXCEPTION 'Destination relation already exists: public.%',item.relname;
    END IF;
  END LOOP;
  FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='shop_crm' AND c.relkind IN ('r','p') ORDER BY c.relname
  LOOP EXECUTE format('ALTER TABLE shop_crm.%I SET SCHEMA public',item.relname); END LOOP;
  FOR item IN SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='shop_crm' AND c.relkind IN ('v','m','S') ORDER BY c.relname
  LOOP EXECUTE format('ALTER %s shop_crm.%I SET SCHEMA public',
    CASE item.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'SEQUENCE' END,item.relname); END LOOP;
  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='shop_crm' AND p.prokind='f'
  LOOP EXECUTE format('ALTER FUNCTION %s SET SCHEMA public',item.signature); END LOOP;
  -- PostgreSQL retains OID-bound FKs/policies/views/triggers. Stored SQL bodies
  -- and explicit search paths need the new namespace as well.
  FOR item IN SELECT p.oid,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','shop_private') AND p.prokind='f'
      AND (p.prosrc LIKE '%shop_crm%' OR array_to_string(p.proconfig, ',') LIKE '%shop_crm%')
  LOOP EXECUTE regexp_replace(item.definition, '\mshop_crm\M', 'public', 'g'); END LOOP;
END;
$relocate$;
-- No CASCADE: an unexpected dependency/object must be reviewed, never deleted.
DROP SCHEMA shop_crm;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
COMMIT;
