BEGIN;
DO $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; before_events bigint; before_exec bigint; before_pub bigint; before_credits bigint; result jsonb;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE status IN('planned','ready') AND workstream_slug IS NOT NULL ORDER BY sequence LIMIT 1;
 IF t.task_id IS NULL THEN RAISE EXCEPTION 'Registered fixture missing';END IF;
 UPDATE control.workflow_runs SET status='finished',finished_at=now() WHERE suit_slug=t.suit_slug AND status='running';
 INSERT INTO control.workflow_runs(project_id,suit_slug,workstream_slug,status,max_tasks,completed_tasks)
 VALUES(t.project_id,t.suit_slug,t.workstream_slug,'running',1,0) RETURNING * INTO r;
 -- Pending/blocked registered scope is still intended work and must not close.
 result:=control.reconcile_empty_run(r.run_id);
 IF result->>'closed'<>'false' THEN RAISE EXCEPTION 'Pending native scope closed';END IF;
 UPDATE control.tasks SET status='complete' WHERE project_id=r.project_id AND workstream_slug=r.workstream_slug AND suit_slug=r.suit_slug;
 UPDATE control.runtime_operations SET status='consumed' WHERE task_id IN(SELECT task_id FROM control.tasks WHERE project_id=r.project_id AND workstream_slug=r.workstream_slug AND suit_slug=r.suit_slug);
 SELECT count(*) INTO before_events FROM control.task_events;SELECT count(*) INTO before_exec FROM control.executions;
 SELECT count(*) INTO before_pub FROM control.pull_requests;SELECT count(*) INTO before_credits FROM control.workflow_run_task_credits;
 result:=control.reconcile_empty_run(r.run_id);
 IF result->>'closed'<>'true' OR (SELECT status FROM control.workflow_runs WHERE run_id=r.run_id)<>'cancelled' THEN RAISE EXCEPTION 'Obsolete no-work run not closed: %',result;END IF;
 IF control.run_is_actionable('cancelled',NULL,now()) OR control.run_is_actionable('finished',NULL,now()) THEN RAISE EXCEPTION 'Terminal scan eligible';END IF;
 IF NOT control.run_is_actionable('running',NULL,NULL) THEN RAISE EXCEPTION 'Dependency wait hidden';END IF;
 IF NOT EXISTS(SELECT 1 FROM control.run_lifecycle_audits WHERE run_id=r.run_id AND evidence->'before'->>'status'='running' AND evidence->>'completion_credit_added'='false') THEN RAISE EXCEPTION 'Audit evidence missing';END IF;
 PERFORM control.record_dot_health(jsonb_build_array(jsonb_build_object('key','run:'||r.run_id,'run_id',r.run_id,'state','STUCK','why','Stale historical fixture','observed_at',now(),'operator_action_required',false,'worker_alive',false)));
 result:=control.claim_dot_recovery(r.run_id,'terminal-fixture','controller-acquisition','{}');
 IF result->>'reason'<>'terminal_run' OR EXISTS(SELECT 1 FROM control.dot_recovery_jobs WHERE run_id=r.run_id) THEN RAISE EXCEPTION 'Historical recovery created';END IF;
 IF before_events<>(SELECT count(*) FROM control.task_events) OR before_exec<>(SELECT count(*) FROM control.executions) OR before_pub<>(SELECT count(*) FROM control.pull_requests) OR before_credits<>(SELECT count(*) FROM control.workflow_run_task_credits) THEN RAISE EXCEPTION 'Historical evidence changed';END IF;
 IF (SELECT completed_tasks FROM control.workflow_runs WHERE run_id=r.run_id)<>0 THEN RAISE EXCEPTION 'Completion inferred/credited';END IF;
END $$;
ROLLBACK;
