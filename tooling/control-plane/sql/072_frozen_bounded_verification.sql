BEGIN;
CREATE TABLE control.bounded_verification_plans(
 run_id uuid NOT NULL REFERENCES control.workflow_runs,task_id text NOT NULL REFERENCES control.tasks,
 ordinal integer NOT NULL CHECK(ordinal>0),plan jsonb NOT NULL,input_snapshot jsonb NOT NULL,
 plan_fingerprint text NOT NULL CHECK(plan_fingerprint ~ '^[a-f0-9]{64}$'),
 source_sha text NOT NULL CHECK(source_sha ~ '^[a-f0-9]{40}$'),frozen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(run_id,task_id),UNIQUE(run_id,ordinal)
);
ALTER TABLE control.bounded_verification_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY bounded_plan_read ON control.bounded_verification_plans FOR SELECT TO bs_control_app,bs_control_observer USING(true);
REVOKE ALL ON control.bounded_verification_plans FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_verifier,bs_control_operator,bs_control_observer;
GRANT SELECT ON control.bounded_verification_plans TO bs_control_app,bs_control_observer;
CREATE FUNCTION control.verification_plan_input_snapshot(p_task text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT jsonb_build_object('verification_plan',p#>'{task,verification_plan}','project_configuration',coalesce(p#>'{project,verification_config}','{}'),'workstream_configuration',coalesce(p#>'{workstream,verification_config}','{}')) FROM (SELECT control.generic_task_packet(p_task) p) packet;
$$;
CREATE FUNCTION control.freeze_bounded_verification_plan(p_run uuid,p_plans jsonb,p_source text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; item jsonb; ordinal integer:=0; expected jsonb; got jsonb; prior jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF NOT FOUND OR r.max_tasks-r.completed_tasks<>jsonb_array_length(p_plans) OR p_source !~ '^[a-f0-9]{40}$' THEN RAISE EXCEPTION 'exact_remaining_bounded_task_set_required';END IF;
 SELECT coalesce(jsonb_agg(task_id ORDER BY priority,sequence,created_at,task_id),'[]') INTO expected FROM (
 SELECT task_id,priority,sequence,created_at FROM control.tasks WHERE suit_slug=r.suit_slug AND project_id=r.project_id AND workstream_slug=r.workstream_slug AND status NOT IN('complete','cancelled') ORDER BY priority,sequence,created_at,task_id LIMIT r.max_tasks-r.completed_tasks) tasks;
 SELECT coalesce(jsonb_agg(value->>'task_id' ORDER BY ordinality),'[]') INTO got FROM jsonb_array_elements(p_plans) WITH ORDINALITY;
 IF got IS DISTINCT FROM expected THEN RAISE EXCEPTION 'bounded_task_set_changed_or_incomplete';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_plans) LOOP
 ordinal:=ordinal+1;
 IF item->'inputs' IS DISTINCT FROM control.verification_plan_input_snapshot(item->>'task_id') OR item->>'version' IS DISTINCT FROM '1' OR coalesce(item->>'plan_fingerprint','') !~ '^[a-f0-9]{64}$'
 OR jsonb_typeof(item->'obligations') IS DISTINCT FROM 'array'
 OR jsonb_array_length(item->'obligations')<>jsonb_array_length(item#>'{inputs,verification_plan}')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item->'obligations') o WHERE (o->>'category' IS NULL OR o->>'category' NOT IN('EXISTING_EXECUTABLE','TASK_OWNED_OUTPUT','EXTERNAL_EVIDENCE')) OR (o->>'category'='EXISTING_EXECUTABLE' AND jsonb_array_length(o->'checks')=0) OR (o->>'category'='TASK_OWNED_OUTPUT' AND jsonb_array_length(o->'expected_outputs')=0) OR (o->>'category'='EXTERNAL_EVIDENCE' AND o->'external_gate'='null')) THEN RAISE EXCEPTION 'unresolved_or_stale_verification_plan_before_attempt_one';END IF;
 IF EXISTS(SELECT 1 FROM control.task_dependencies dep JOIN control.tasks parent ON parent.task_id=dep.depends_on_task_id WHERE dep.task_id=item->>'task_id' AND dep.dependency_type='hard' AND parent.status<>'complete' AND NOT got @> jsonb_build_array(parent.task_id)) THEN RAISE EXCEPTION 'prerequisite_outside_bounded_task_set';END IF;
 SELECT plan INTO prior FROM control.bounded_verification_plans WHERE run_id=p_run AND task_id=item->>'task_id';
 IF prior IS NOT NULL AND prior IS DISTINCT FROM item THEN RAISE EXCEPTION 'immutable_bounded_plan_conflict';END IF;
 INSERT INTO control.bounded_verification_plans(run_id,task_id,ordinal,plan,input_snapshot,plan_fingerprint,source_sha) VALUES(p_run,item->>'task_id',ordinal,item,item->'inputs',item->>'plan_fingerprint',p_source) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
CREATE FUNCTION control.start_prevalidated_workflow_run(p_suit text,p_max integer,p_plans jsonb,p_source text,p_controller text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE result jsonb;
BEGIN
 IF coalesce(p_controller,'')='' THEN RAISE EXCEPTION 'registered_controller_fingerprint_required';END IF;
 result:=control.ensure_workflow_run(p_suit,p_max);
 IF result->>'started'='true' THEN UPDATE control.workflow_runs SET controller_protocol='cp-batch-v2',controller_fingerprint=p_controller WHERE run_id=(result->>'run_id')::uuid;END IF;
 IF result->>'started'='true' THEN PERFORM control.freeze_bounded_verification_plan((result->>'run_id')::uuid,p_plans,p_source);END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION control.freeze_bounded_verification_plan(uuid,jsonb,text),control.start_prevalidated_workflow_run(text,integer,jsonb,text,text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_operator,bs_control_observer;
GRANT EXECUTE ON FUNCTION control.freeze_bounded_verification_plan(uuid,jsonb,text),control.start_prevalidated_workflow_run(text,integer,jsonb,text,text) TO bs_control_verifier;
-- Prevent bypassing whole-bound admission through the ordinary runtime transport.
REVOKE ALL ON FUNCTION control.start_workflow_run(text,integer),control.ensure_workflow_run(text,integer) FROM PUBLIC,anon,authenticated,bs_control_app;
-- Existing runs keep their identity/history; a reviewed frozen adoption is explicit.
CREATE FUNCTION control.require_current_bounded_verification_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE frozen control.bounded_verification_plans%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW;END IF;
 IF NEW.status NOT IN('in_progress','verification') THEN RETURN NEW;END IF;
 SELECT f.* INTO frozen FROM control.bounded_verification_plans f JOIN control.workflow_runs r USING(run_id) WHERE f.task_id=NEW.task_id AND r.status='running';
 IF frozen.task_id IS NOT NULL AND frozen.input_snapshot IS DISTINCT FROM jsonb_set(control.verification_plan_input_snapshot(NEW.task_id),'{verification_plan}',NEW.verification_plan) THEN RAISE EXCEPTION 'frozen_bounded_verification_plan_changed';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER require_frozen_verification BEFORE INSERT OR UPDATE ON control.tasks FOR EACH ROW EXECUTE FUNCTION control.require_current_bounded_verification_plan();
-- Filter acquisition to the full reviewed set rather than discovering a later
-- pre-existing mapping debt after a successful earlier task.
DO $$DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.claim_next_task(text,text)'::regprocedure);
 definition:=replace(definition,'AND control.task_publication_authority_is_current(task.task_id)', 'AND control.task_publication_authority_is_current(task.task_id) AND (NOT EXISTS(SELECT 1 FROM control.bounded_verification_plans f WHERE f.run_id=active_run.run_id) OR EXISTS(SELECT 1 FROM control.bounded_verification_plans f WHERE f.run_id=active_run.run_id AND f.task_id=task.task_id))');
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION control.verification_plan_input_snapshot(text),control.require_current_bounded_verification_plan() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.verification_plan_input_snapshot(text) TO bs_control_app,bs_control_verifier;
COMMIT;
