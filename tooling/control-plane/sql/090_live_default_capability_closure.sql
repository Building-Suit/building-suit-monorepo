BEGIN;
-- Live pre-ledger default grants must not silently reappear on new objects.
-- Ordinary roles use the reviewed executor API through role membership.
REVOKE ALL ON ALL TABLES IN SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator,bs_control_release_installer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app;
REVOKE ALL ON SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app;
DO $$DECLARE owner_role text; grantee_role text; object_kind text;BEGIN
 FOR owner_role IN SELECT rolname FROM pg_roles WHERE rolname IN('postgres','bs_control_migration_owner') LOOP
  FOR grantee_role IN SELECT rolname FROM pg_roles WHERE rolname IN('anon','authenticated','bs_control_app','bs_control_executor','bs_control_observer','bs_control_verifier','bs_control_operator','bs_control_release_installer','bs_dashboard_reader') LOOP
   FOREACH object_kind IN ARRAY ARRAY['TABLES','SEQUENCES','FUNCTIONS'] LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA control REVOKE ALL ON %s FROM %I',owner_role,object_kind,grantee_role);
   END LOOP;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_dashboard_reader') THEN REVOKE ALL ON SCHEMA control FROM bs_dashboard_reader;END IF;
END $$;
COMMIT;
