BEGIN;
-- Recover only the two preserved pre-verification SAS workers stopped by
-- source-only RESTORE-111 guards superseded by authenticated owner authority.
-- Keep the original execution/attempt and append the complete interrupted state.
DO $patch$
DECLARE original text; marker text;
BEGIN
 original:=pg_get_functiondef('control.adopt_lifecycle_recovery(uuid,integer,text)'::regprocedure);
 marker:=' -- Never steal an executing worker or a genuine current publication gate.';
 IF position(marker in original)=0 OR position('v.status<>''failed''' in original)=0 THEN RAISE EXCEPTION 'exact_schema113_adoption_required';END IF;
 original:=replace(original,marker,$body$
 IF r.run_id='2518c051-fb28-4641-ae03-c046d7c30807'::uuid
 AND (r.current_task_id,e.execution_id) IN (('SAS-M1-CUSTOM-OFFER-001',321),('SAS-M1-AUDIT-001',322))
 AND e.status='failed' AND v.verification_run_id IS NULL
 AND e.metadata#>>'{actual_worker_result,error}'='worker_process_interrupted'
 AND e.metadata#>>'{actual_worker_result,classification,failure_class}'='transient-infrastructure'
 AND e.metadata ? 'restore111_safety_stop'
 AND control.unattended_queue_grant(p_run)->>'event_id'='17'
 AND control.unattended_queue_task_current(p_run,r.current_task_id)
 AND NOT EXISTS(SELECT 1 FROM control.task_dependencies d JOIN control.tasks parent ON parent.task_id=d.depends_on_task_id WHERE d.task_id=r.current_task_id AND d.dependency_type='hard' AND parent.status<>'complete')
 AND EXISTS(SELECT 1 FROM control.tasks WHERE task_id=r.current_task_id AND status='failed')
 AND EXISTS(SELECT 1 FROM control.recovery_states s JOIN control.recovery_state_events ev ON ev.recovery_state_id=s.recovery_state_id WHERE s.current_task_id=r.current_task_id AND ev.recorded_state->>'execution_id'=e.execution_id::text AND ev.recorded_state->>'status'='resolved' AND ev.recorded_state->>'error_code'='source_only_guard_superseded_by_schema113' AND ev.recorded_state#>>'{metadata,queue_approval_event_id}'='17')
 AND NOT EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id=r.current_task_id AND (lease_expires_at>now() OR status='active' AND error_code NOT IN('retry_audit_investigation_required','same_execution_infrastructure_recovery')))
 AND NOT EXISTS(SELECT 1 FROM control.dot_recovery_jobs WHERE run_id=p_run AND task_id=r.current_task_id AND status='running' AND claim_until>now())
 AND NOT EXISTS(SELECT 1 FROM control.runtime_operations WHERE task_id=r.current_task_id AND status<>'consumed')
 AND EXISTS(SELECT 1 FROM control.runtime_operations op WHERE op.task_id=r.current_task_id AND op.execution_id=e.execution_id AND op.action='task-run' AND op.status='consumed' AND op.result#>>'{payload,error}'='worker_process_interrupted')
 AND (control.product_retry_accounting(r.current_task_id)->>'consumed')::integer=0
 THEN
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(r.current_task_id,'interrupted_source_worker_resumed','failed','in_progress','runner',jsonb_build_object('execution_id',e.execution_id,'attempt',e.attempt,'queue_event_id',17,'product_attempts_added',0,'interrupted_execution',to_jsonb(e),'source_only',true,'hosted_actions_authorized',false));
  PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||r.current_task_id,p_idempotency_key=>'interrupted-source-worker-resumed:'||e.execution_id,p_failure_class=>'transient-infrastructure',p_error_code=>'genuine_interrupted_worker_resumed',p_next_action=>'reconcile-runtime',p_recoverable=>true,p_source=>'runner',p_project_id=>r.project_id,p_workstream_slug=>r.workstream_slug,p_workflow_run_id=>r.run_id,p_current_task_id=>r.current_task_id,p_execution_id=>e.execution_id,p_condition=>jsonb_build_object('actual_worker_result',e.metadata->'actual_worker_result'),p_metadata=>jsonb_build_object('original_execution',e.execution_id,'queue_event_id',17,'product_attempts_added',0),p_status=>'resolved');
  UPDATE control.executions SET status='running',finished_at=NULL,metadata=metadata||jsonb_build_object('same_execution_source_recovery',true) WHERE execution_id=e.execution_id;
  UPDATE control.tasks SET status='in_progress',engine_stage='implementation' WHERE task_id=r.current_task_id;
  PERFORM control.claim_runtime_operation(r.current_task_id,'task-run',e.execution_id,jsonb_build_object('previous_execution_id',e.execution_id,'source','schema114-interrupted-source-recovery'),'sas-source-recovery',gen_random_uuid()::text);
  RETURN jsonb_build_object('adopted',false,'interrupted_execution_resumed',true,'execution_id',e.execution_id,'product_attempts_added',0);
 END IF;
 -- Never steal an executing worker or a genuine current publication gate.
$body$);
 original:=replace(original,'OR v.status<>''failed'' THEN','OR v.verification_run_id IS NULL OR v.status IS DISTINCT FROM ''failed'' THEN');
 EXECUTE original;
END $patch$;
COMMIT;
