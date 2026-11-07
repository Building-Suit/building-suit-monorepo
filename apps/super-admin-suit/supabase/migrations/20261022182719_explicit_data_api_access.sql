-- Explicit Data API access: compatible with the 2026-10-30 Supabase defaults.
-- Audited grants preserve application/RLS access on clean replay. No row changes.
-- Absent objects belong to pending releases; this migration does not deploy them.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public","super_admin_private" REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public","super_admin_private" REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public","super_admin_private" REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $access$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public','release_manifests_ordinal_seq','SEQUENCE','SELECT,UPDATE,USAGE','anon'),
    ('public','release_manifests_ordinal_seq','SEQUENCE','SELECT,UPDATE,USAGE','authenticated'),
    ('public','release_manifests_ordinal_seq','SEQUENCE','SELECT,UPDATE,USAGE','service_role'),
    ('public','suit_registry','TABLE','SELECT','service_role'),
    ('public','suit_environment_bindings','TABLE','SELECT','service_role'),
    ('public','adapter_registrations','TABLE','SELECT','service_role'),
    ('public','adapter_capability_policy','TABLE','SELECT','service_role'),
    ('public','navigation_items','TABLE','SELECT','service_role'),
    ('public','integration_providers','TABLE','SELECT','service_role'),
    ('public','integration_settings','TABLE','SELECT','service_role'),
    ('public','integration_secret_references','TABLE','SELECT','service_role'),
    ('public','configuration_revisions','TABLE','SELECT','service_role'),
    ('public','control_plane_events','TABLE','SELECT','service_role'),
    ('public','admin_environments','TABLE','INSERT,SELECT','service_role'),
    ('public','platform_admins','TABLE','INSERT,SELECT,UPDATE','service_role'),
    ('public','adapter_manifest_observations','TABLE','INSERT,SELECT','service_role')
  ) AS allowed(schema_name,object_name,object_kind,privileges,role_name) LOOP
    IF to_regclass(format('%I.%I',item.schema_name,item.object_name)) IS NOT NULL THEN
      EXECUTE format('GRANT %s ON %s %I.%I TO %I',item.privileges,item.object_kind,item.schema_name,item.object_name,item.role_name);
    END IF;
  END LOOP;
  FOR item IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=ANY(ARRAY['public','super_admin_private']::text[]) AND c.relkind IN ('r','p','v','m')
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
    ('super_admin_private','adapter_key','p_reference uuid',ARRAY[]::text[]),
    ('public','super_admin_session','',ARRAY['authenticated','service_role']::text[]),
    ('super_admin_private','current_platform_admin','',ARRAY[]::text[]),
    ('super_admin_private','assert_platform_owner','',ARRAY[]::text[]),
    ('super_admin_private','assert_payload_keys','p_payload jsonb, p_allowed text[]',ARRAY[]::text[]),
    ('super_admin_private','safe_snapshot','p_resource_type text, p_snapshot jsonb',ARRAY[]::text[]),
    ('super_admin_private','reject_mutation','',ARRAY[]::text[]),
    ('super_admin_private','assert_binding_activation','p_binding_id uuid',ARRAY[]::text[]),
    ('super_admin_private','record_configuration_change','p_request_id uuid, p_correlation_id uuid, p_actor platform_admins, p_resource_type text, p_resource_id uuid, p_resource_version bigint, p_action text, p_reason text, p_safe_parameters jsonb, p_before jsonb, p_after jsonb, p_suit_id uuid, p_target_environment_id uuid, p_request_fingerprint text, p_result jsonb',ARRAY[]::text[]),
    ('super_admin_private','release_digest','p_value jsonb',ARRAY[]::text[]),
    ('public','super_admin_configuration_command','p_request_id uuid, p_correlation_id uuid, p_resource_type text, p_resource_id uuid, p_expected_version bigint, p_reason text, p_payload jsonb',ARRAY['authenticated','service_role']::text[]),
    ('public','super_admin_configuration_read','p_resource text, p_id uuid',ARRAY['authenticated','service_role']::text[]),
    ('super_admin_private','adapter_mac','p_input text, p_key bytea',ARRAY[]::text[]),
    ('super_admin_private','adapter_configuration','p_binding uuid, p_operation text, p_actor uuid',ARRAY[]::text[]),
    ('public','release_catalog_state','',ARRAY['service_role']::text[]),
    ('public','release_publish','p_environment text, p_ref text, p_deployment_sha text, p_releases jsonb',ARRAY['service_role']::text[]),
    ('public','super_admin_adapter_enqueue','p_input jsonb',ARRAY['authenticated']::text[]),
    ('public','super_admin_adapter_claim','p_dispatch_id uuid',ARRAY['service_role']::text[]),
    ('super_admin_private','transfer_binding','p_suit uuid',ARRAY[]::text[]),
    ('super_admin_private','assert_transfer_evidence','c jsonb',ARRAY[]::text[]),
    ('super_admin_private','adapter_complete_verified','p_attempt_id uuid, p_response jsonb',ARRAY[]::text[]),
    ('super_admin_private','super_admin_adapter_complete_before_activity','p_attempt_id uuid, p_response jsonb',ARRAY[]::text[]),
    ('public','super_admin_activity_observe','p_binding uuid, p_request uuid, p_projection jsonb',ARRAY['service_role']::text[]),
    ('public','super_admin_activity_context','p_binding uuid, p_stream text',ARRAY['authenticated']::text[]),
    ('public','super_admin_activity_failure','p_binding uuid, p_stream text',ARRAY['authenticated']::text[]),
    ('public','super_admin_activity_read','p_query jsonb',ARRAY['authenticated']::text[]),
    ('super_admin_private','offer_snapshot','o custom_offer_versions',ARRAY[]::text[]),
    ('super_admin_private','offer_snapshot_before_dispatch','o custom_offer_versions',ARRAY[]::text[]),
    ('super_admin_private','secure_offer_available','cfg jsonb',ARRAY[]::text[]),
    ('super_admin_private','custom_offer_origin','p_binding uuid',ARRAY[]::text[]),
    ('super_admin_private','custom_offer_link','o custom_offer_versions',ARRAY[]::text[]),
    ('public','super_admin_custom_offers_read','p_binding_id uuid',ARRAY['authenticated']::text[]),
    ('super_admin_private','custom_offer_command_before_dispatch','p_input jsonb',ARRAY[]::text[]),
    ('public','super_admin_custom_offer_command','p_input jsonb',ARRAY['authenticated']::text[]),
    ('super_admin_private','adapter_complete_before_secure_offers','p_attempt_id uuid, p_response jsonb',ARRAY[]::text[]),
    ('public','super_admin_adapter_complete','p_attempt_id uuid, p_response jsonb',ARRAY['service_role']::text[]),
    ('super_admin_private','account_binding','p_suit uuid',ARRAY[]::text[]),
    ('super_admin_private','account_provisioning_available','p_binding uuid',ARRAY[]::text[]),
    ('super_admin_private','registry_projection','',ARRAY[]::text[]),
    ('super_admin_private','live_operator_change','',ARRAY[]::text[]),
    ('public','super_admin_live_topic','',ARRAY['authenticated']::text[]),
    ('public','super_admin_live_flush','p_limit integer',ARRAY['service_role']::text[]),
    ('super_admin_private','live_publish','p_id uuid, p_environment uuid, p_user uuid, p_session uuid, p_kinds text[]',ARRAY[]::text[]),
    ('super_admin_private','live_deliver','p_id uuid',ARRAY[]::text[]),
    ('super_admin_private','live_enqueue','p_source text, p_environment uuid, p_binding uuid, p_kinds text[]',ARRAY[]::text[]),
    ('super_admin_private','live_source','',ARRAY[]::text[]),
    ('super_admin_private','release_context','',ARRAY[]::text[]),
    ('super_admin_private','release_copy_valid','p_copy jsonb',ARRAY[]::text[]),
    ('public','release_stage_accept','p_request jsonb',ARRAY['service_role']::text[]),
    ('super_admin_private','release_immutable','',ARRAY[]::text[]),
    ('super_admin_private','legacy_release_retired','',ARRAY[]::text[]),
    ('super_admin_private','candidate_baseline_tree','',ARRAY[]::text[]),
    ('super_admin_private','candidate_versions','p_snapshot jsonb',ARRAY[]::text[]),
    ('super_admin_private','candidate_immutable','',ARRAY[]::text[]),
    ('public','release_candidate_state','',ARRAY['service_role']::text[]),
    ('public','release_candidate_promote','p_release jsonb, p_deployment_sha text, p_main_parent text, p_main_tree text',ARRAY['service_role']::text[]),
    ('super_admin_private','release_candidate_refresh_retained','p_snapshot jsonb',ARRAY[]::text[]),
    ('super_admin_private','release_legacy_public_feed','',ARRAY[]::text[]),
    ('super_admin_private','candidate_public_entry','e jsonb, p_status text, p_time timestamp with time zone',ARRAY[]::text[]),
    ('super_admin_private','release_verified_public_feed','',ARRAY[]::text[]),
    ('public','release_candidate_refresh','p_snapshot jsonb',ARRAY['service_role']::text[]),
    ('public','release_candidate_ready','p_key text, p_digest text',ARRAY['service_role']::text[]),
    ('public','release_candidate_acknowledge','p_receipt jsonb',ARRAY['service_role']::text[]),
    ('super_admin_private','retrospective_history_immutable','',ARRAY[]::text[]),
    ('super_admin_private','retrospective_shop_plan','',ARRAY[]::text[]),
    ('public','release_history_import','p_history jsonb',ARRAY['service_role']::text[]),
    ('public','release_public_feed','',ARRAY['anon','authenticated']::text[])
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
    WHERE n.nspname=ANY(ARRAY['public','super_admin_private']::text[]) AND p.prorettype IN ('trigger'::regtype,'event_trigger'::regtype)
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC,anon,authenticated',item.signature); END LOOP;
END $routines$;
NOTIFY pgrst,'reload schema';
COMMIT;
