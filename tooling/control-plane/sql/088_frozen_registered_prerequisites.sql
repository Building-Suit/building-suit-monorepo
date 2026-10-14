BEGIN;
CREATE FUNCTION control.registered_prerequisite_bindings(p_task text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',depends_on_task_id,'dependency_type',dependency_type) ORDER BY depends_on_task_id,dependency_type),'[]') FROM control.task_dependencies WHERE task_id=p_task;
$$;
ALTER FUNCTION control.registered_prerequisite_bindings(text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.registered_prerequisite_bindings(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.registered_prerequisite_bindings(text) TO bs_control_executor,bs_control_observer,bs_control_verifier;
-- Freezing verification is distinct from claiming a task. A real registered
-- prerequisite in another workstream may remain unfinished; claim authorization
-- continues to require its completion. Bind the actual DAG, never waive it.
DO $$DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.freeze_bounded_verification_plan(uuid,jsonb,text)'::regprocedure);
 definition:=replace(definition,
 $find$IF EXISTS(SELECT 1 FROM control.task_dependencies dep JOIN control.tasks parent ON parent.task_id=dep.depends_on_task_id WHERE dep.task_id=item->>'task_id' AND dep.dependency_type='hard' AND parent.status<>'complete' AND NOT got @> jsonb_build_array(parent.task_id)) THEN RAISE EXCEPTION 'prerequisite_outside_bounded_task_set';END IF;$find$,
 $replacement$IF EXISTS(SELECT 1 FROM control.task_dependencies dep JOIN control.tasks parent ON parent.task_id=dep.depends_on_task_id WHERE dep.task_id=item->>'task_id' AND dep.dependency_type='hard' AND parent.status<>'complete' AND NOT got @> jsonb_build_array(parent.task_id)) AND item->'prerequisite_bindings' IS DISTINCT FROM control.registered_prerequisite_bindings(item->>'task_id') THEN RAISE EXCEPTION 'exact_registered_external_prerequisites_required';END IF;$replacement$);
 IF definition NOT LIKE '%exact_registered_external_prerequisites_required%' THEN RAISE EXCEPTION 'freeze_prerequisite_contract_changed';END IF;
 EXECUTE definition;
 definition:=pg_get_functiondef('control.require_current_bounded_verification_plan()'::regprocedure);
 definition:=replace(definition,' RETURN NEW;', $replacement$ IF frozen.task_id IS NOT NULL AND frozen.plan ? 'prerequisite_bindings' AND frozen.plan->'prerequisite_bindings' IS DISTINCT FROM control.registered_prerequisite_bindings(NEW.task_id) THEN RAISE EXCEPTION 'frozen_registered_prerequisites_changed';END IF;
 RETURN NEW;$replacement$);
 EXECUTE definition;
END $$;
COMMIT;
