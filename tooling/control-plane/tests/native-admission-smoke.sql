BEGIN;
DO $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; result jsonb; old_limit integer; old_executions integer;
BEGIN
 -- Existing fixture task is already registered; make it an idle native run.
 SELECT * INTO t FROM control.tasks WHERE status IN('planned','ready') AND workstream_slug IS NOT NULL ORDER BY sequence LIMIT 1;
 IF t.task_id IS NULL THEN RAISE EXCEPTION 'Native admission fixture missing';END IF;
 UPDATE control.workflow_runs SET status='finished',finished_at=now() WHERE suit_slug=t.suit_slug AND status='running';
 INSERT INTO control.workflow_runs(project_id,suit_slug,workstream_slug,status,max_tasks,completed_tasks)
 VALUES(t.project_id,t.suit_slug,t.workstream_slug,'running',7,0) RETURNING * INTO r;
 SELECT count(*) INTO old_executions FROM control.executions WHERE task_id=t.task_id;
 result:=control.diagnose_native_run_admission(r.run_id);
 IF result IS NULL THEN RAISE EXCEPTION 'Idle native run requires exact pending diagnostics';END IF;
 result:=control.reconcile_native_run_admission(r.run_id);
 IF (SELECT max_tasks FROM control.workflow_runs WHERE run_id=r.run_id)<>7 OR (SELECT current_task_id FROM control.workflow_runs WHERE run_id=r.run_id) IS NOT NULL
 OR (SELECT count(*) FROM control.executions WHERE task_id=t.task_id)<>old_executions THEN RAISE EXCEPTION 'Diagnostics mutated run identity/limit or product attempts';END IF;
 PERFORM control.record_dot_health(jsonb_build_array(jsonb_build_object('key','run:'||r.run_id,'run_id',r.run_id,'state','WAITING_ADMISSION','observed_at',now(),'operator_action_required',false,'recovery_owner','Dot')));
 PERFORM control.record_dot_health(jsonb_build_array(jsonb_build_object('key','run:'||r.run_id,'run_id',r.run_id,'state','RECONCILING','observed_at',now(),'operator_action_required',false,'recovery_owner','Dot')));
 IF (SELECT state FROM control.dot_health_current WHERE run_id=r.run_id) <> 'RECONCILING' THEN RAISE EXCEPTION 'Admission recovery health cannot persist';END IF;
 UPDATE control.workflow_runs SET maintenance_requested=true WHERE run_id=r.run_id;
 result:=control.reconcile_native_run_admission(r.run_id);
 IF result->>'reason'<>'run_not_idle_native' THEN RAISE EXCEPTION 'Maintenance gate bypassed';END IF;
END $$;
ROLLBACK;
