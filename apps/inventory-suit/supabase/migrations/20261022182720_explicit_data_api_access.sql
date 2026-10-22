-- Explicit Data API access: compatible with the 2026-10-30 Supabase defaults.
-- Audited grants preserve application/RLS access on clean replay. No row changes.
-- Absent objects belong to pending releases; this migration does not deploy them.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $access$
DECLARE item record;
BEGIN

  FOR item IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=ANY(ARRAY['public']::text[]) AND c.relkind IN ('r','p','v','m')
  LOOP
    EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER ON TABLE %I.%I FROM PUBLIC,anon,authenticated',item.nspname,item.relname);
    IF current_setting('server_version_num')::integer>=170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE %I.%I FROM PUBLIC,anon,authenticated',item.nspname,item.relname);
    END IF;
  END LOOP;
END $access$;

DO $routines$
DECLARE item record; target text; role_name text;
BEGIN

  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=ANY(ARRAY['public']::text[]) AND p.prorettype IN ('trigger'::regtype,'event_trigger'::regtype)
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC,anon,authenticated',item.signature); END LOOP;
END $routines$;
NOTIFY pgrst,'reload schema';
COMMIT;
