WITH active_runs AS (
 SELECT * FROM control.workflow_runs r WHERE status='running' OR (status='failed' AND current_task_id IS NOT NULL) OR (status='finished' AND finished_at>now()-interval '24 hours') OR EXISTS(SELECT 1 FROM control.dot_health_observations h WHERE h.run_id=r.run_id)
), subjects AS (
 SELECT 'run:'||r.run_id key,to_jsonb(r) run,t.task_id FROM active_runs r LEFT JOIN control.tasks t ON t.task_id=r.current_task_id
 UNION ALL
 SELECT 'task:'||t.task_id,NULL::jsonb,t.task_id FROM control.tasks t WHERE (status IN('planned','ready','in_progress','verification','passed','failed') OR EXISTS(SELECT 1 FROM control.dot_health_observations h WHERE h.key='task:'||t.task_id))
 AND NOT EXISTS(SELECT 1 FROM active_runs r WHERE r.current_task_id=t.task_id)
)
SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.key,'run',s.run,'task',to_jsonb(t),'execution',e.data,'verification',v.data,'recovery',rec.data,'operation',op.data,'publication',pub.data,
 'policy',CASE WHEN t.task_id IS NOT NULL THEN control.resolved_retry_policy(t.task_id) END,
 'accounting',CASE WHEN t.task_id IS NOT NULL THEN control.product_retry_accounting(t.task_id) END,
 'last_progress_at',progress.created_at,
 'blocking_dependency',EXISTS(SELECT 1 FROM control.task_dependencies d JOIN control.tasks parent ON parent.task_id=d.depends_on_task_id WHERE d.task_id=t.task_id AND d.dependency_type='hard' AND parent.status<>'complete'),
 'blocking_decision',EXISTS(SELECT 1 FROM control.task_decisions td JOIN control.decisions d ON d.suit_slug=td.suit_slug AND d.decision_id=td.decision_id WHERE td.task_id=t.task_id AND td.blocking AND d.status<>'approved'),
 'next_eligible_task',(SELECT ready.task_id FROM control.ready_tasks ready WHERE ready.project_id=(s.run->>'project_id')::uuid AND ready.workstream_slug=s.run->>'workstream_slug'
 AND (EXISTS(SELECT 1 FROM control.dot_task_scope_authorities a WHERE a.run_id=(s.run->>'run_id')::uuid AND a.task_id=ready.task_id)
 OR EXISTS(SELECT 1 FROM control.batch_task_admissions a WHERE a.run_id=(s.run->>'run_id')::uuid AND a.task_id=ready.task_id AND a.status='admitted')) ORDER BY ready.priority,ready.sequence LIMIT 1)
)),'[]'::jsonb)
FROM subjects s LEFT JOIN control.tasks t ON t.task_id=s.task_id
LEFT JOIN LATERAL(SELECT to_jsonb(e) data FROM control.executions e WHERE e.task_id=t.task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1)e ON true
LEFT JOIN LATERAL(SELECT to_jsonb(v) data FROM control.verification_runs v WHERE execution_id=(e.data->>'execution_id')::bigint ORDER BY verification_run_id DESC LIMIT 1)v ON true
LEFT JOIN LATERAL(SELECT to_jsonb(r) data FROM control.recovery_states r WHERE current_task_id=t.task_id AND status='active' ORDER BY updated_at DESC LIMIT 1)rec ON true
LEFT JOIN LATERAL(SELECT to_jsonb(o) data FROM control.runtime_operations o WHERE task_id=t.task_id AND status<>'consumed' ORDER BY created_at DESC LIMIT 1)op ON true
LEFT JOIN LATERAL(SELECT to_jsonb(p) data FROM control.pull_requests p WHERE task_id=t.task_id ORDER BY updated_at DESC LIMIT 1)pub ON true
LEFT JOIN LATERAL(SELECT created_at FROM control.task_events ev WHERE ev.task_id=t.task_id AND event_type IN('task_claimed','execution_started','execution_finished','retry_started','verification_started','verification_finished','publication_started','publication_completed','verifier_only_reaccepted','preexecution_verification_bindings_reconciled','executable_verification_binding_reconciled') ORDER BY created_at DESC LIMIT 1)progress ON true;
