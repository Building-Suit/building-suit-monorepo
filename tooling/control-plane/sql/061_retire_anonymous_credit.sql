BEGIN;
CREATE OR REPLACE FUNCTION control.record_workflow_task_success(p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
BEGIN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='attributed_task_credit_required';
END $$;
REVOKE ALL ON FUNCTION control.record_workflow_task_success(uuid) FROM PUBLIC,anon,authenticated,bs_control_app;
COMMIT;
