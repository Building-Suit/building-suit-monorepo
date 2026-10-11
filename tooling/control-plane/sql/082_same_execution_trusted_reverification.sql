BEGIN;
-- A guarded reaccepted failed execution is reverified on the same identity.
-- The inherited approval is read from authoritative history, never task input.
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('control.start_verification_run(text,bigint,text,jsonb)'::regprocedure);
 definition:=replace(definition, $old$execution_status <> 'succeeded'$old$, $new$(execution_status <> 'succeeded' AND NOT control.publication_execution_is_eligible(p_task_id,p_execution_id))$new$);
 definition:=replace(definition, $old$task_status NOT IN ('in_progress', 'verification')$old$, $new$task_status NOT IN ('in_progress', 'verification', 'passed')$new$);
 definition:=replace(definition, $old$COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('verification_mode', requested_mode)$old$, $new$COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('verification_mode', requested_mode) || CASE WHEN execution_status='failed' THEN (SELECT jsonb_build_object('verifier_only_reacceptance',v.metadata->'verifier_only_reacceptance','preserved_failed_execution',v.metadata->'preserved_failed_execution','preserved_execution',v.metadata->'preserved_execution','approval_event_id',v.metadata->'approval_event_id') FROM control.verification_runs v WHERE execution_id=p_execution_id ORDER BY verification_run_id DESC LIMIT 1) ELSE '{}'::jsonb END$new$);
 definition:=replace(definition,$old$SET engine_stage = 'verification'
  WHERE execution_id = p_execution_id;$old$,$new$SET engine_stage = 'verification'
  WHERE execution_id = p_execution_id AND execution_status='succeeded';$new$);
 EXECUTE definition;
END $$;
COMMIT;
