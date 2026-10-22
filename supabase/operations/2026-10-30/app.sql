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
  FOR item IN SELECT * FROM (VALUES
    ('public','site_settings','TABLE','DELETE,INSERT,SELECT,UPDATE','anon'),
    ('public','site_settings','TABLE','DELETE,INSERT,SELECT,UPDATE','authenticated'),
    ('public','site_settings','TABLE','DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE','service_role'),
    ('public','project_links','TABLE','DELETE,INSERT,SELECT,UPDATE','anon'),
    ('public','project_links','TABLE','DELETE,INSERT,SELECT,UPDATE','authenticated'),
    ('public','project_links','TABLE','DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE','service_role'),
    ('public','admin_users','TABLE','DELETE,INSERT,SELECT,UPDATE','anon'),
    ('public','admin_users','TABLE','DELETE,INSERT,SELECT,UPDATE','authenticated'),
    ('public','admin_users','TABLE','DELETE,INSERT,MAINTAIN,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE','service_role')
  ) AS allowed(schema_name,object_name,object_kind,privileges,role_name) LOOP
    IF to_regclass(format('%I.%I',item.schema_name,item.object_name)) IS NOT NULL THEN
      EXECUTE format('GRANT %s ON %s %I.%I TO %I',item.privileges,item.object_kind,item.schema_name,item.object_name,item.role_name);
    END IF;
  END LOOP;
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
  FOR item IN SELECT * FROM (VALUES
    ('public','is_landing_admin','',ARRAY['anon','authenticated','service_role']::text[]),
    ('public','set_updated_at','',ARRAY['service_role']::text[])
  ) AS allowed(schema_name,routine_name,arguments,roles) LOOP
    IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=item.schema_name AND p.proname=item.routine_name
        AND pg_get_function_identity_arguments(p.oid)=item.arguments) THEN
      target:=format('%I.%I(%s)',item.schema_name,item.routine_name,item.arguments);
      FOREACH role_name IN ARRAY item.roles LOOP
        EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO %I',target,role_name);
      END LOOP;
      EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC',target);
    END IF;
  END LOOP;
  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=ANY(ARRAY['public']::text[]) AND p.prorettype IN ('trigger'::regtype,'event_trigger'::regtype)
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC,anon,authenticated',item.signature); END LOOP;
END $routines$;
ALTER FUNCTION public.is_landing_admin() SET search_path='';
NOTIFY pgrst,'reload schema';
COMMIT;
