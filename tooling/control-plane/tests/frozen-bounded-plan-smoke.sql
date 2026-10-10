\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE project uuid; run uuid; plans jsonb; p jsonb; input jsonb; result jsonb; denied boolean; n integer;
BEGIN
 SELECT project_id INTO project FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.suits(slug,display_name,stack_key) VALUES('cp-frozen-fixture','Frozen synthetic','automation-suit');
 INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,verification_config,publication_config)
 VALUES(project,'cp-frozen-fixture','cp-frozen-fixture','Frozen synthetic','automation-suit','{}','{}');
 FOR n IN 1..2 LOOP
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,retry_policy_id)
 VALUES('CP-FROZEN-00'||n,'cp-frozen-fixture',project,'cp-frozen-fixture',n,'Synthetic frozen plan','planned','["Synthetic fixture"]','["git diff --check"]','{"allowed_paths":["tooling/control-plane/**"]}','standard-five');
 END LOOP;
 INSERT INTO control.suits(slug,display_name,stack_key) VALUES('cp-external-prerequisite','Registered external dependency','shared');
 INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,verification_config,publication_config) VALUES(project,'cp-external-prerequisite','cp-external-prerequisite','Registered external dependency','shared','{}','{}');
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,title,status,acceptance_criteria,verification_plan,metadata,retry_policy_id) VALUES('CP-EXTERNAL-001','cp-external-prerequisite',project,'cp-external-prerequisite',1,'Registered prerequisite remains unclaimed','planned','["Synthetic"]','["git diff --check"]','{}','standard-five');
 INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES('CP-FROZEN-001','CP-EXTERNAL-001','hard');
 plans:='[]';
 FOR n IN 1..2 LOOP
 input:=control.verification_plan_input_snapshot('CP-FROZEN-00'||n);
 p:=jsonb_build_object('version',1,'task_id','CP-FROZEN-00'||n,'inputs',input,'plan_fingerprint',repeat('a',64),'obligations',jsonb_build_array(jsonb_build_object('category','EXISTING_EXECUTABLE','checks',jsonb_build_array(jsonb_build_object('name','git-diff-check','program','git','args',jsonb_build_array('diff','--check'))))));
 plans:=plans||jsonb_build_array(p);
 END LOOP;
 SET LOCAL ROLE bs_control_app;
 denied:=false;BEGIN PERFORM control.ensure_workflow_run('cp-frozen-fixture',2);EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Unbound run bypass permitted';END IF;
 RESET ROLE;
 SET LOCAL ROLE bs_control_verifier;
 denied:=false;BEGIN PERFORM control.start_prevalidated_workflow_run('cp-frozen-fixture',2,jsonb_set(plans,'{1,obligations,0,category}','"UNRESOLVED_CONFIG"'),repeat('a',40),'synthetic-controller');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Unresolved upcoming obligation admitted';END IF;
 RESET ROLE;
 IF EXISTS(SELECT 1 FROM control.workflow_runs WHERE suit_slug='cp-frozen-fixture') THEN RAISE EXCEPTION 'Blocked admission created run';END IF;
 IF EXISTS(SELECT 1 FROM control.executions WHERE task_id LIKE 'CP-FROZEN-%') THEN RAISE EXCEPTION 'Blocked admission consumed attempt';END IF;
 SET LOCAL ROLE bs_control_verifier;
 denied:=false;BEGIN PERFORM control.start_prevalidated_workflow_run('cp-frozen-fixture',2,plans,repeat('a',40),'synthetic-controller');EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Unbound external prerequisite admitted';END IF;
 RESET ROLE;
 plans:=jsonb_set(plans,'{0,prerequisite_bindings}',control.registered_prerequisite_bindings('CP-FROZEN-001'));
 SET LOCAL ROLE bs_control_verifier;
 result:=control.start_prevalidated_workflow_run('cp-frozen-fixture',2,plans,repeat('a',40),'synthetic-controller');
 RESET ROLE;
 run:=(result->>'run_id')::uuid;
 IF result->>'started'<>'true' OR (SELECT count(*) FROM control.bounded_verification_plans WHERE run_id=run)<>2 THEN RAISE EXCEPTION 'Whole set not frozen';END IF;
 IF (SELECT status FROM control.tasks WHERE task_id='CP-EXTERNAL-001')<>'planned' OR EXISTS(SELECT 1 FROM control.executions WHERE task_id='CP-EXTERNAL-001') THEN RAISE EXCEPTION 'Freezing claimed or waived external dependency';END IF;
 DELETE FROM control.task_dependencies WHERE task_id='CP-FROZEN-001';
 denied:=false;BEGIN UPDATE control.tasks SET status='in_progress' WHERE task_id='CP-FROZEN-001';EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Changed frozen prerequisite DAG accepted';END IF;
 INSERT INTO control.task_dependencies(task_id,depends_on_task_id,dependency_type) VALUES('CP-FROZEN-001','CP-EXTERNAL-001','hard');
 UPDATE control.tasks SET verification_plan='["pre-existing unmapped SQL obligation"]' WHERE task_id='CP-FROZEN-002';
 denied:=false;BEGIN UPDATE control.tasks SET status='in_progress' WHERE task_id='CP-FROZEN-002';EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Changed upcoming plan started';END IF;
 IF (SELECT max_tasks FROM control.workflow_runs WHERE run_id=run)<>2 THEN RAISE EXCEPTION 'Frozen run limit changed';END IF;
END $$;
ROLLBACK;
