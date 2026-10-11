BEGIN;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_executor') THEN CREATE ROLE bs_control_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_migration_owner') THEN CREATE ROLE bs_control_migration_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;END IF;
END $$;
GRANT bs_control_migration_owner TO postgres;
GRANT USAGE ON SCHEMA control TO bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
REVOKE ALL ON ALL TABLES IN SCHEMA control FROM bs_control_app,bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
GRANT SELECT ON ALL TABLES IN SCHEMA control TO bs_control_executor,bs_control_observer,bs_control_verifier;
GRANT bs_control_executor TO bs_control_app;
REVOKE bs_control_app FROM bs_control_verifier;
-- Managed PostgreSQL cannot reassert NOSUPERUSER without superuser authority.
-- Refuse unsafe existing attributes rather than bypassing that provider boundary.
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_app' AND
 (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'provider_administrator_must_remove_unsafe_runtime_role_attributes';
 END IF;
END $$;
-- Ownership is a non-login schema capability. Ordinary processes never inherit it.
ALTER SCHEMA control OWNER TO bs_control_migration_owner;
DO $$DECLARE obj record;BEGIN
 FOR obj IN SELECT c.oid,c.relkind,c.relname FROM pg_class c WHERE relnamespace='control'::regnamespace AND relkind IN('r','p','v','m') LOOP
 EXECUTE format('ALTER %s control.%I OWNER TO bs_control_migration_owner',CASE obj.relkind WHEN 'S' THEN 'SEQUENCE' WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,obj.relname);
 IF obj.relkind IN('r','p') THEN
 EXECUTE format('CREATE POLICY remediation_read_capabilities ON control.%I FOR SELECT TO bs_control_executor,bs_control_observer,bs_control_verifier USING(true)',obj.relname);
 END IF;
 END LOOP;
 FOR obj IN SELECT relname FROM pg_class WHERE relnamespace='control'::regnamespace AND relkind='S' AND relowner<>(SELECT oid FROM pg_roles WHERE rolname='bs_control_migration_owner') LOOP
 EXECUTE format('ALTER SEQUENCE control.%I OWNER TO bs_control_migration_owner',obj.relname);
 END LOOP;
 FOR obj IN SELECT oid::regprocedure fn FROM pg_proc WHERE pronamespace='control'::regnamespace LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',obj.fn);
 EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog,control',obj.fn);
 END LOOP;
END $$;
-- Exact reviewed lifecycle API allowlist. No arbitrary history, policy or
-- authority INSERT/UPDATE/DELETE capability is granted to the executor.
DO $$DECLARE fn record;BEGIN
 FOR fn IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='control'::regnamespace AND proname IN(
'acquire_workflow_run_task','attach_runtime_execution','audit_product_attempts','claim_dot_recovery','claim_dot_stuck_recovery','claim_due_external_recovery','claim_next_task','claim_runtime_operation','complete_parent_satisfied','complete_publication','current_protected_publication_authority','current_run_publication_authority','current_task_recovery_condition','diagnose_native_run_admission','finish_dot_model_invocation','finish_dot_recovery','finish_execution','finish_workflow_run','generic_task_packet','handle_no_publishable_changes','latest_execution','next_ready_task','operator_gate_offers','product_retry_accounting','publication_execution_is_eligible','reclaim_local_supervisor_lease','reconcile_dot_recovery_completion','reconcile_empty_run','reconcile_native_reacceptance_gate','reconcile_native_run_admission','reconcile_ordinary_run_publication','reconcile_reviewed_evidence_incidents','reconcile_shared_retry_exhaustion','record_dot_cycle','record_dot_health','record_dot_incident','record_dot_model_launch','record_execution_setup','record_external_watch_result','record_parent_satisfaction_evaluation','record_publication_started','record_recovery_condition','record_retry_exhaustion_audit','record_runtime_failure','record_task_preparation','record_workflow_task_success','refresh_dot_admission','release_task_claim','reopen_verification','request_workflow_stop','reserve_dot_model_invocation','resolved_retry_policy','run_is_actionable','set_runtime_operation_outcome','skip_unselected_verification_checks','start_execution','start_retry_execution','start_verification_run','workflow_run_gate') AND NOT(proname='record_workflow_task_success' AND pronargs=1) LOOP
 EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER',fn.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO bs_control_executor',fn.signature);
 END LOOP;
 FOR fn IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='control'::regnamespace AND proname IN(
'generic_task_packet','latest_execution','resolved_retry_policy','publication_execution_is_eligible','register_trusted_verification_command','capture_verifier_receipt','finish_verification_run','freeze_bounded_verification_plan','queue_verification_check','reaccept_dot_verifier_only','reaccept_verifier_only','reconcile_strict_verification_binding','record_trusted_reacceptance','record_trusted_task_reparent','record_trusted_verification_state','review_verification_failure','start_prevalidated_workflow_run','update_verification_check') LOOP
 EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER',fn.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO bs_control_verifier',fn.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION control.operator_gate_offers(uuid),control.resolve_authenticated_operator_gate(uuid,uuid,text,text) TO bs_control_operator;
GRANT EXECUTE ON FUNCTION control.operator_gate_offers(uuid),control.run_is_actionable(text,text,timestamptz) TO bs_control_observer;
REVOKE CREATE ON SCHEMA control FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
ALTER DEFAULT PRIVILEGES FOR ROLE bs_control_migration_owner IN SCHEMA control REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
