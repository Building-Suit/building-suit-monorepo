BEGIN;
-- Frozen plans remain immutable; operator amendments retain original bytes.
CREATE TABLE control.bounded_plan_dependency_amendments(
 run_id uuid NOT NULL REFERENCES control.workflow_runs,task_id text NOT NULL REFERENCES control.tasks,
 original_plan jsonb NOT NULL,new_bindings jsonb NOT NULL,amendment_fingerprint text NOT NULL,
 actor text NOT NULL,evidence text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(run_id,task_id)
);
ALTER TABLE control.bounded_plan_dependency_amendments OWNER TO bs_control_migration_owner;
ALTER TABLE control.bounded_plan_dependency_amendments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.bounded_plan_dependency_amendments FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_runtime_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
CREATE TRIGGER immutable_control_evidence BEFORE UPDATE OR DELETE ON control.bounded_plan_dependency_amendments FOR EACH ROW EXECUTE FUNCTION control.reject_append_only_mutation();
CREATE FUNCTION control.effective_bounded_verification_plan(p_run uuid,p_task text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE original jsonb; amendment control.bounded_plan_dependency_amendments%ROWTYPE;
BEGIN
 SELECT plan INTO original FROM control.bounded_verification_plans WHERE run_id=p_run AND task_id=p_task;
 SELECT * INTO amendment FROM control.bounded_plan_dependency_amendments WHERE run_id=p_run AND task_id=p_task;
 IF NOT FOUND THEN RETURN original;END IF;
 IF amendment.original_plan IS DISTINCT FROM original OR amendment.new_bindings IS DISTINCT FROM control.registered_prerequisite_bindings(p_task) THEN RAISE EXCEPTION 'audited_dependency_amendment_stale';END IF;
 RETURN original||jsonb_build_object('prerequisite_bindings',amendment.new_bindings,'plan_fingerprint',amendment.amendment_fingerprint,'amends_plan_fingerprint',original->>'plan_fingerprint');
END $$;
ALTER FUNCTION control.effective_bounded_verification_plan(uuid,text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.effective_bounded_verification_plan(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.effective_bounded_verification_plan(uuid,text) TO bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
DO $$DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.require_current_bounded_verification_plan()'::regprocedure);
 IF position('frozen.plan->''prerequisite_bindings'' IS DISTINCT FROM' in definition)=0 THEN RAISE EXCEPTION 'frozen_prerequisite_guard_baseline_changed';END IF;
 definition:=replace(definition,'frozen.plan->''prerequisite_bindings'' IS DISTINCT FROM', 'control.effective_bounded_verification_plan(frozen.run_id,frozen.task_id)->''prerequisite_bindings'' IS DISTINCT FROM');
 EXECUTE definition;
 -- Exact existing authorized docs app; no arbitrary app roots or policy change.
 definition:=pg_get_functiondef('control.reconcile_ordinary_run_task(uuid,text)'::regprocedure);
 IF position('apps/[A-Za-z0-9_-]+-suit' in definition)=0 THEN RAISE EXCEPTION 'frozen_source_root_guard_baseline_changed';END IF;
 EXECUTE replace(definition,'apps/[A-Za-z0-9_-]+-suit','apps/([A-Za-z0-9_-]+-suit|building-suit-docs)');
END $$;
-- Planning operations only: no execution, credit, retry-policy or queue-grant writes.
CREATE FUNCTION control.repair_shared_future_suit_dependency(p_run uuid,p_expected_scope text,p_evidence text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; old_edge jsonb; event bigint; frozen jsonb; amended jsonb;
BEGIN
 IF p_run IS DISTINCT FROM '1a75a547-3372-4e2a-b51c-3b1b2bf9ad81'::uuid OR length(btrim(coalesce(p_evidence,'')))<20 THEN RAISE EXCEPTION 'reviewed_shared_planning_evidence_required'; END IF;
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO t FROM control.tasks WHERE task_id='BS-SA-FUTURE-SUIT-001' FOR UPDATE;
 IF EXISTS(SELECT 1 FROM control.audit_events WHERE task_id=t.task_id AND action='shared_foundation_dependency_repaired') THEN
  IF control.dot_scope_fingerprint(t.task_id) IS DISTINCT FROM p_expected_scope OR NOT EXISTS(SELECT 1 FROM control.task_dependencies WHERE task_id=t.task_id AND depends_on_task_id='SAS-M4-EVENTS-001' AND dependency_type='soft')
   OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id='BS-SA-FUTURE-SUIT-M4-VALIDATION-001') THEN RAISE EXCEPTION 'shared_planning_replay_drift';END IF;
  RETURN jsonb_build_object('repaired',true,'idempotent',true,'run_id',p_run);
 END IF;
 IF r.status<>'running' OR r.stop_requested OR r.maintenance_requested OR r.current_task_id IS NOT NULL
  OR r.workstream_slug<>'shared' OR r.max_tasks<>4 OR r.completed_tasks<>2
  OR t.status<>'planned' OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=t.task_id)
  OR control.dot_scope_fingerprint(t.task_id) IS DISTINCT FROM p_expected_scope
  OR NOT control.unattended_queue_task_current(p_run,t.task_id)
  OR NOT EXISTS(SELECT 1 FROM control.task_requirements l JOIN control.requirements req USING(suit_slug,requirement_id)
    WHERE l.task_id=t.task_id AND req.requirement_id='BS-SA-UI-R002' AND req.status='approved') THEN RAISE EXCEPTION 'shared_planning_state_drift';END IF;
 SELECT to_jsonb(d) INTO old_edge FROM control.task_dependencies d WHERE task_id=t.task_id AND depends_on_task_id='SAS-M4-EVENTS-001' AND dependency_type='hard' FOR UPDATE;
 IF old_edge IS NULL THEN RAISE EXCEPTION 'reviewed_m4_edge_required';END IF;
 SELECT plan INTO frozen FROM control.bounded_verification_plans WHERE run_id=p_run AND task_id=t.task_id FOR UPDATE;
 IF frozen IS NULL OR frozen->'prerequisite_bindings' IS DISTINCT FROM control.registered_prerequisite_bindings(t.task_id) THEN RAISE EXCEPTION 'exact_original_frozen_prerequisites_required';END IF;
 -- Preserve roadmap provenance and the original edge; only its semantics change.
 UPDATE control.task_dependencies SET dependency_type='soft' WHERE task_id=t.task_id AND depends_on_task_id='SAS-M4-EVENTS-001';
 amended:=control.registered_prerequisite_bindings(t.task_id);
 INSERT INTO control.bounded_plan_dependency_amendments(run_id,task_id,original_plan,new_bindings,amendment_fingerprint,actor,evidence)
 VALUES(p_run,t.task_id,frozen,amended,encode(sha256(convert_to(jsonb_build_object('original',frozen,'amended_bindings',amended,'source','116_shared_foundation_planning.sql')::text,'UTF8')),'hex'),session_user,p_evidence);
 UPDATE control.tasks SET metadata=metadata||jsonb_build_object('dependency_repair',jsonb_build_object(
  'source','116_shared_foundation_planning.sql','classification','roadmap-ordering-misclassified-as-hard-dependency',
  'foundation_scope','All original acceptance criteria retained; fixture-based identity/navigation/versioned capabilities and disabled unsupported capabilities.',
  'deferred_validation_task','BS-SA-FUTURE-SUIT-M4-VALIDATION-001','prior_dependency',old_edge,'owner_evidence',p_evidence)) WHERE task_id=t.task_id;
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,priority,title,description,task_type,risk_level,model_profile,status,acceptance_criteria,verification_plan,metadata)
 VALUES('BS-SA-FUTURE-SUIT-M4-VALIDATION-001',t.suit_slug,t.project_id,t.workstream_slug,480,40,
  'Validate future-Suit contracts against completed SAS M4 integrations',
  'Deferred integration validation of the shared foundation against real completed SAS M4 event/audit and administration projections. Requires separate bounded authorization; never completion evidence for the foundation.',
  'review','high','standard','planned',
  '["Validate the versioned read/command descriptors and registered identity/navigation against completed SAS M4 adapters and event/audit projections.","Exercise a future Suit with actual M4 integration fixtures, including unavailable/partial feeds and unsupported capabilities safely absent or disabled.","Preserve immutable source audit authority, redaction and product isolation; retain EN/AR, RTL/LTR and Bs-only ownership boundaries.","Record the exact M4 source tasks/commits and independent verification evidence; fixture-only foundation completion cannot satisfy this integration task."]',
  '[{"kind":"planned_test","version":2,"description":"SAS M4 integration coverage; independently verify adapters, correlation, partial feeds, redaction and unsupported capabilities.","commands":["bs-sa-future-suit-m4-validation-001-unit"],"expected_outputs":["packages/contracts/tests/bs-sa-future-suit-m4-validation-001.test.mjs"]}]',
  jsonb_build_object('source','116_shared_foundation_planning.sql','split_from_task_id',t.task_id,'roadmap_phase','post-m4-integration','allowed_paths',t.metadata->'allowed_paths','separate_authorization_required',true,'hosted_production_changes_authorized',false));
 INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES
  ('BS-SA-FUTURE-SUIT-M4-VALIDATION-001',t.task_id,'hard'),('BS-SA-FUTURE-SUIT-M4-VALIDATION-001','SAS-M4-EVENTS-001','hard');
 INSERT INTO control.task_requirements(task_id,suit_slug,requirement_id) SELECT 'BS-SA-FUTURE-SUIT-M4-VALIDATION-001',suit_slug,requirement_id FROM control.task_requirements WHERE task_id=t.task_id;
 PERFORM control.refresh_publication_readiness_contract(t.task_id,'shared-foundation-planning-repair');
 IF control.dot_scope_fingerprint(t.task_id)<>p_expected_scope OR NOT control.unattended_queue_task_current(p_run,t.task_id)
  OR control.unattended_queue_task_current(p_run,'BS-SA-FUTURE-SUIT-M4-VALIDATION-001') THEN RAISE EXCEPTION 'frozen_queue_scope_changed';END IF;
 INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,actor,old_value,new_value,reason,metadata)
 VALUES(t.project_id,t.workstream_slug,t.task_id,'shared_foundation_dependency_repaired','human',session_user,old_edge,
  jsonb_build_object('dependency_type','soft','deferred_task_id','BS-SA-FUTURE-SUIT-M4-VALIDATION-001'),p_evidence,
  jsonb_build_object('run_id',p_run,'acceptance_preserved',true,'queue_grant_preserved',true,'no_product_attempt',true));
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(t.task_id,'shared_foundation_dependency_repaired','human',jsonb_build_object('run_id',p_run,'prior_dependency',old_edge,'dependency_type','soft','deferred_task_id','BS-SA-FUTURE-SUIT-M4-VALIDATION-001','evidence',p_evidence)) RETURNING event_id INTO event;
 PERFORM control.enqueue_supervisor_wake(p_run,event);
 RETURN jsonb_build_object('repaired',true,'idempotent',false,'run_id',p_run,'event_id',event,'scope_fingerprint',p_expected_scope,'deferred_task_id','BS-SA-FUTURE-SUIT-M4-VALIDATION-001');
END $$;

CREATE FUNCTION control.approve_shared_changelog_choices(p_run uuid,p_version text,p_hours integer,p_evidence text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE t control.tasks%ROWTYPE; d control.decisions%ROWTYPE; choice text; event bigint; changed integer:=0;
BEGIN
 IF p_run<>'1a75a547-3372-4e2a-b51c-3b1b2bf9ad81'::uuid OR p_version IS DISTINCT FROM 'semantic-prerelease' OR coalesce(p_hours,0) NOT IN(24,48) OR length(btrim(coalesce(p_evidence,'')))<20 THEN RAISE EXCEPTION 'explicit_shared_owner_choices_required';END IF;
 PERFORM 1 FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO t FROM control.tasks WHERE task_id='BS-CHANGELOG-VERSION-001' FOR UPDATE;
 IF NOT control.unattended_queue_task_current(p_run,t.task_id) THEN RAISE EXCEPTION 'shared_changelog_authority_stale';END IF;
 FOR d IN SELECT * FROM control.decisions WHERE suit_slug='shared' AND decision_id IN('BS-VERSION-D01','BS-CHANGELOG-NEW-D01') ORDER BY decision_id FOR UPDATE LOOP
  choice:=CASE WHEN d.decision_id='BS-VERSION-D01' THEN 'Semantic versioning (MAJOR.MINOR.PATCH), with explicit prerelease labels' ELSE p_hours||' hours from the authoritative publish timestamp' END;
  IF d.status='approved' AND d.metadata->>'owner_choice'=choice THEN CONTINUE;END IF;
  IF d.status<>'open' OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=t.task_id) THEN RAISE EXCEPTION 'decision_state_drift';END IF;
  UPDATE control.decisions SET status='approved',decision_text=choice,decided_at=now(),source='explicit-owner-chat-2026-10-10',metadata=metadata||jsonb_build_object('owner_choice',choice,'owner_evidence',p_evidence) WHERE suit_slug=d.suit_slug AND decision_id=d.decision_id;
  INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,actor,old_value,new_value,reason)
   VALUES(t.project_id,t.workstream_slug,t.task_id,'shared_changelog_decision_approved','human',session_user,to_jsonb(d),jsonb_build_object('decision_id',d.decision_id,'choice',choice),p_evidence);
  changed:=changed+1;
 END LOOP;
 IF (SELECT count(*) FROM control.decisions WHERE suit_slug='shared' AND decision_id IN('BS-VERSION-D01','BS-CHANGELOG-NEW-D01'))<>2 THEN RAISE EXCEPTION 'both_registered_decisions_required';END IF;
 IF changed>0 THEN
  PERFORM control.refresh_publication_readiness_contract(t.task_id,'explicit-shared-changelog-decisions');
  INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(t.task_id,'shared_changelog_choices_approved','human',jsonb_build_object('run_id',p_run,'version',p_version,'new_hours',p_hours,'evidence',p_evidence)) RETURNING event_id INTO event;
  PERFORM control.enqueue_supervisor_wake(p_run,event);
 END IF;
 RETURN jsonb_build_object('approved',true,'idempotent',changed=0,'run_id',p_run,'event_id',event,'version',p_version,'new_hours',p_hours);
END $$;
ALTER FUNCTION control.repair_shared_future_suit_dependency(uuid,text,text) OWNER TO bs_control_migration_owner;
ALTER FUNCTION control.approve_shared_changelog_choices(uuid,text,integer,text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.repair_shared_future_suit_dependency(uuid,text,text),control.approve_shared_changelog_choices(uuid,text,integer,text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_runtime_executor,bs_control_observer,bs_control_verifier;
GRANT EXECUTE ON FUNCTION control.repair_shared_future_suit_dependency(uuid,text,text),control.approve_shared_changelog_choices(uuid,text,integer,text) TO bs_control_operator;
COMMIT;
