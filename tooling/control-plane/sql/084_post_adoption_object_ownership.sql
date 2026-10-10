BEGIN;
-- Complete ownership for objects introduced after the role-boundary migration.
-- Runtime roles retain their explicit capability grants, never schema ownership.
DO $$DECLARE obj record;BEGIN
 FOR obj IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='control'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',obj.signature);
  EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog,control',obj.signature);
 END LOOP;
END $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_dashboard_reader') THEN REVOKE ALL ON ALL TABLES IN SCHEMA control FROM bs_dashboard_reader;REVOKE ALL ON ALL SEQUENCES IN SCHEMA control FROM bs_dashboard_reader;REVOKE ALL ON ALL FUNCTIONS IN SCHEMA control FROM bs_dashboard_reader;GRANT bs_control_observer TO bs_dashboard_reader;END IF;END $$;
ALTER DEFAULT PRIVILEGES FOR ROLE bs_control_migration_owner IN SCHEMA control REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA control REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
