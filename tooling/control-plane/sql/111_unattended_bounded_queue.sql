BEGIN;
-- Schema-108 extension only. 109/110 are deliberately not prerequisites.
DO $$ BEGIN IF to_regprocedure('control.task_scope_requirement_fingerprint(text)') IS NULL THEN RAISE EXCEPTION 'schema_108_required'; END IF; END $$;

-- Reuse authenticated operator events as the queue grant; no worker can mint it.
CREATE FUNCTION control.unattended_queue_grant(p_run uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT ev.offer||jsonb_build_object('event_id',ev.event_id) FROM control.operator_authority_events ev JOIN control.operator_actors actor USING(actor_id) JOIN control.workflow_runs r USING(run_id)
 WHERE ev.run_id=p_run AND ev.action='unattended-queue-release' AND ev.response='approve' AND actor.enabled
 AND ev.event_id=(SELECT max(event_id) FROM control.operator_authority_events WHERE run_id=p_run AND action='unattended-queue-release')
 AND r.status='running' AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
 AND (ev.offer->>'max_tasks')::integer=r.max_tasks AND ev.offer->>'controller_fingerprint'=r.controller_fingerprint
 AND ev.offer->>'project_fingerprint'=(SELECT md5(allowed_publication_paths::text) FROM control.projects WHERE project_id=r.project_id)
 AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events revoked WHERE revoked.run_id=p_run AND revoked.gate_fingerprint=ev.gate_fingerprint AND revoked.response='revoke')
 ORDER BY ev.event_id DESC LIMIT 1;
$$;
CREATE FUNCTION control.unattended_queue_task_current(p_run uuid,p_task text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT coalesce(EXISTS(SELECT 1 FROM jsonb_array_elements(control.unattended_queue_grant(p_run)->'tasks') item
 WHERE item->>'task_id'=p_task AND item->>'scope_fingerprint'=control.dot_scope_fingerprint(p_task)
 AND item->>'requirement_fingerprint'=control.task_scope_requirement_fingerprint(p_task)
 AND item->'verification_plan'=(SELECT verification_plan FROM control.tasks WHERE task_id=p_task)
 AND item->>'effective_policy_id'=control.resolved_retry_policy(p_task)->>'policy_id'
 AND item->'effective_policy'=(control.resolved_retry_policy(p_task)-'one_invocation_extension'-'inherited_from')),false);
$$;
CREATE FUNCTION control.unattended_queue_offer(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; items jsonb; item jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run;
 IF r.status IS DISTINCT FROM 'running' OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks OR r.admitted_repair_id IS NOT NULL
 OR control.unattended_queue_grant(p_run) IS NOT NULL THEN RETURN NULL;END IF;
 SELECT jsonb_agg(jsonb_build_object('task_id',t.task_id,'scope_fingerprint',control.dot_scope_fingerprint(t.task_id),
 'requirement_fingerprint',control.task_scope_requirement_fingerprint(t.task_id),'verification_plan',t.verification_plan,
 'allowed_paths',coalesce(t.metadata->'allowed_paths','[]'),'previous_policy',control.resolved_retry_policy(t.task_id)-'one_invocation_extension',
 'effective_policy_id',CASE WHEN NOT EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=t.task_id) AND (control.resolved_retry_policy(t.task_id)->>'max_attempts')::integer<>5 THEN 'standard-five' ELSE control.resolved_retry_policy(t.task_id)->>'policy_id' END,
 'effective_policy',CASE WHEN NOT EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=t.task_id) AND (control.resolved_retry_policy(t.task_id)->>'max_attempts')::integer<>5 THEN (SELECT jsonb_build_object('policy_id',policy_id,'max_attempts',max_attempts,'attempt_profiles',attempt_profiles) FROM control.retry_policies WHERE policy_id='standard-five' AND active) ELSE control.resolved_retry_policy(t.task_id)-'one_invocation_extension'-'inherited_from' END,
 'assign_five',NOT EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=t.task_id) AND (control.resolved_retry_policy(t.task_id)->>'max_attempts')::integer<>5,
 'shared_scopes',(SELECT coalesce(jsonb_agg(scope ORDER BY scope),'[]') FROM jsonb_array_elements_text(coalesce(t.metadata->'allowed_paths','[]')) scope
 WHERE scope ~ '^packages/[A-Za-z0-9_-]+/\*\*$' AND scope !~* '(^|/)(secrets?|credentials?|supabase|n8n|deploy|vercel)(/|\.|-)'
 AND EXISTS(SELECT 1 FROM control.task_requirements WHERE task_id=t.task_id)
 AND NOT EXISTS(SELECT 1 FROM control.task_requirements link JOIN control.requirements req USING(suit_slug,requirement_id) WHERE link.task_id=t.task_id AND req.status NOT IN('approved','implemented'))
 AND EXISTS(SELECT 1 FROM control.projects p CROSS JOIN LATERAL jsonb_array_elements_text(p.allowed_publication_paths) boundary WHERE p.project_id=t.project_id AND regexp_replace(scope,'/\*\*$','') LIKE rtrim(boundary,'/')||'/%'))) ORDER BY t.sequence,t.task_id) INTO items
 FROM control.tasks t WHERE t.project_id=r.project_id AND t.workstream_slug=r.workstream_slug AND t.suit_slug=r.suit_slug AND t.status NOT IN('complete','cancelled')
 AND (EXISTS(SELECT 1 FROM control.dot_task_scope_authorities f WHERE f.run_id=p_run AND f.task_id=t.task_id AND f.scope_fingerprint=control.dot_scope_fingerprint(t.task_id))
 OR (NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=p_run) AND EXISTS(SELECT 1 FROM control.bounded_verification_plans b WHERE b.run_id=p_run AND b.task_id=t.task_id)));
 IF items IS NULL OR jsonb_array_length(items)>r.max_tasks-r.completed_tasks THEN RETURN NULL;END IF;
 item:=jsonb_build_object('run_id',p_run,'action','unattended-queue-release','reason','bounded_queue_owner_authorization','max_tasks',r.max_tasks,'run_revision',r.run_revision,
 'controller_fingerprint',r.controller_fingerprint,'project_fingerprint',(SELECT md5(allowed_publication_paths::text) FROM control.projects WHERE project_id=r.project_id),'tasks',items,
 'requested_authorization','Authorize exactly this frozen task queue for implementation and trusted-PASS Draft publication; resolve only listed ordinary shared-package scopes. Assign standard-five only to the listed tasks with no prior execution. Preserve started-task policies, all history and the existing run limit. Block unknown/protected/security-sensitive work, hosted SQL, merge and deploy. Park blocked/exhausted tasks without credit; continue independent eligible tasks.');
 RETURN item||jsonb_build_object('gate_fingerprint',md5(item::text),'gate_id',md5(item::text)::uuid,'bs22_path','/form/building-suit-operator-gates');
END $$;
ALTER FUNCTION control.operator_gate_offers(uuid) RENAME TO operator_gate_offers_before_unattended_queue;
CREATE FUNCTION control.operator_gate_offers(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE offers jsonb; item jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(value),'[]') INTO offers FROM jsonb_array_elements(control.operator_gate_offers_before_unattended_queue(p_run)) value
 WHERE NOT(value->>'action' IN('ordinary-publication','task-shared-package-scope','product-retry-extension') AND control.unattended_queue_task_current(p_run,value->>'task_id'));
 item:=control.unattended_queue_offer(p_run);
 IF item IS NOT NULL AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=item->>'gate_fingerprint') THEN
 -- The single queue approval includes bounded publication; suppress the narrower duplicate offer.
 SELECT coalesce(jsonb_agg(value),'[]') INTO offers FROM jsonb_array_elements(offers) value WHERE value->>'action'<>'bounded-run-release';
 offers:=offers||jsonb_build_array(item);END IF;
 RETURN offers;
END $$;
ALTER FUNCTION control.resolve_authenticated_operator_gate(uuid,uuid,text,text) RENAME TO resolve_authenticated_operator_gate_before_unattended_queue;
CREATE FUNCTION control.resolve_authenticated_operator_gate(p_actor uuid,p_run uuid,p_gate text,p_response text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; ev control.operator_authority_events%ROWTYPE; t jsonb; ids jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.operator_actors WHERE actor_id=p_actor AND enabled) THEN RAISE EXCEPTION 'registered_authenticated_operator_required';END IF;
 IF p_response NOT IN('approve','reject','revoke') THEN RAISE EXCEPTION 'typed_operator_response_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('operator-gate:'||p_run::text,0));
 PERFORM 1 FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO ev FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response=p_response;
 IF FOUND AND ev.action='unattended-queue-release' THEN RETURN to_jsonb(ev)||jsonb_build_object('ok',true,'replayed',true,'resolution_id',ev.event_id);END IF;
 IF p_response='revoke' THEN SELECT offer INTO item FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve';
 ELSE SELECT value INTO item FROM jsonb_array_elements(control.operator_gate_offers(p_run)) WHERE value->>'gate_fingerprint'=p_gate;END IF;
 IF item->>'action' IS DISTINCT FROM 'unattended-queue-release' THEN RETURN control.resolve_authenticated_operator_gate_before_unattended_queue(p_actor,p_run,p_gate,p_response);END IF;
 IF p_response<>'revoke' AND EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate) THEN RAISE EXCEPTION 'operator_gate_already_decided';END IF;
 IF p_response='revoke' AND EXISTS(SELECT 1 FROM control.runtime_operations WHERE workflow_run_id=p_run AND status IN('pending','running','settled')) THEN RAISE EXCEPTION 'queue_operation_in_flight_reconciliation_required';END IF;
 INSERT INTO control.operator_authority_events(run_id,gate_fingerprint,action,response,actor_id,offer) VALUES(p_run,p_gate,'unattended-queue-release',p_response,p_actor,item) RETURNING * INTO ev;
 IF p_response='approve' THEN
 SELECT jsonb_agg(value->>'task_id') INTO ids FROM jsonb_array_elements(item->'tasks');
 PERFORM control.authorize_ordinary_bounded_run(p_run,ids,'Authenticated bounded queue authority event '||ev.event_id);
 FOR t IN SELECT value FROM jsonb_array_elements(item->'tasks') LOOP
 PERFORM 1 FROM control.tasks WHERE task_id=t->>'task_id' FOR UPDATE;
 IF (t->>'assign_five')::boolean THEN
 IF EXISTS(SELECT 1 FROM control.executions WHERE task_id=t->>'task_id') THEN RAISE EXCEPTION 'future_policy_change_requires_unstarted_task';END IF;
 UPDATE control.tasks SET retry_policy_id='standard-five' WHERE task_id=t->>'task_id';
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(t->>'task_id','future_task_five_attempts_authorized','human',jsonb_build_object('authority_event',ev.event_id,'previous_policy',t->'previous_policy','new_policy',t->'effective_policy','execution_history_preserved',true));
 END IF;
 END LOOP;
 END IF;
 INSERT INTO control.audit_events(project_id,workstream_slug,action,source,new_value) SELECT project_id,workstream_slug,'unattended_queue_'||p_response,'human',to_jsonb(ev) FROM control.workflow_runs WHERE run_id=p_run;
 PERFORM control.enqueue_supervisor_wake(p_run);
 RETURN to_jsonb(ev)||jsonb_build_object('ok',true,'resolution_id',ev.event_id);
END $$;

ALTER FUNCTION control.reconcile_ordinary_run_task(uuid,text) RENAME TO reconcile_ordinary_run_task_before_unattended_queue;
CREATE FUNCTION control.reconcile_ordinary_run_task(p_run uuid,p_task text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; scopes jsonb; old jsonb;
BEGIN
 IF control.unattended_queue_grant(p_run) IS NULL AND EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND action='unattended-queue-release') THEN RAISE EXCEPTION 'queue_authority_inactive';END IF;
 IF control.unattended_queue_task_current(p_run,p_task) THEN
 SELECT value INTO item FROM jsonb_array_elements(control.unattended_queue_grant(p_run)->'tasks') WHERE value->>'task_id'=p_task;
 scopes:=item->'shared_scopes';SELECT coalesce(metadata->'publication_resolved_scopes','[]') INTO old FROM control.tasks WHERE task_id=p_task;
 IF NOT old @> scopes THEN
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(old||scopes))) WHERE task_id=p_task;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'queue_shared_scope_derived','supervisor',jsonb_build_object('run_id',p_run,'authority_event',control.unattended_queue_grant(p_run)->'event_id','approved_scopes',scopes,'no_new_human_response',true));
 END IF;
 END IF;
 RETURN control.reconcile_ordinary_run_task_before_unattended_queue(p_run,p_task);
END $$;
-- Reconciliation errors belong to their task, including an already blocked current task.
ALTER FUNCTION control.reconcile_ordinary_run_publication(uuid) RENAME TO reconcile_ordinary_run_publication_before_unattended_queue;
CREATE FUNCTION control.reconcile_ordinary_run_publication(p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE target text; outcomes jsonb:='[]'; result jsonb;
BEGIN
 IF control.unattended_queue_grant(p_run) IS NULL THEN
 IF EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND action='unattended-queue-release') THEN RETURN jsonb_build_object('run_id',p_run,'gated',true,'reason','queue_authority_inactive');END IF;
 RETURN control.reconcile_ordinary_run_publication_before_unattended_queue(p_run);END IF;
 FOR target IN SELECT value->>'task_id' FROM jsonb_array_elements(control.unattended_queue_grant(p_run)->'tasks') WHERE EXISTS(SELECT 1 FROM control.tasks WHERE task_id=value->>'task_id' AND status NOT IN('complete','cancelled')) LOOP
 BEGIN result:=control.reconcile_ordinary_run_task(p_run,target);EXCEPTION WHEN OTHERS THEN result:=jsonb_build_object('task_id',target,'gated',true,'reason',SQLERRM);END;outcomes:=outcomes||jsonb_build_array(result);END LOOP;
 RETURN jsonb_build_object('run_id',p_run,'tasks',outcomes);
END $$;

ALTER FUNCTION control.current_run_publication_authority(text) RENAME TO current_run_publication_authority_before_unattended_queue;
CREATE FUNCTION control.current_run_publication_authority(p_task text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE receipt jsonb; owning_run uuid;
BEGIN
 receipt:=control.current_run_publication_authority_before_unattended_queue(p_task);
 SELECT run_id INTO owning_run FROM control.workflow_runs WHERE current_task_id=p_task AND status IN('running','failed') ORDER BY started_at DESC LIMIT 1;
 IF owning_run IS NOT NULL AND EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=owning_run AND action='unattended-queue-release') THEN
 IF NOT control.unattended_queue_task_current(owning_run,p_task) THEN RETURN jsonb_build_object('authorized',false,'run_id',owning_run,'reason','queue_authority_inactive_or_stale');END IF;
 RETURN receipt||jsonb_build_object('unattended_queue_authority',true,'queue_authority_event',control.unattended_queue_grant(owning_run)->'event_id');END IF;
 RETURN receipt;
END $$;

-- A parked task remains blocked, with its original lifecycle status and evidence.
CREATE TABLE control.unattended_queue_waits(run_id uuid NOT NULL REFERENCES control.workflow_runs,task_id text NOT NULL REFERENCES control.tasks,
 prior_status text NOT NULL,reason text NOT NULL,input_fingerprint text NOT NULL,exhausted boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),resumed_at timestamptz,PRIMARY KEY(run_id,task_id));
ALTER TABLE control.unattended_queue_waits OWNER TO bs_control_migration_owner;
ALTER TABLE control.unattended_queue_waits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.unattended_queue_waits FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_runtime_executor,bs_control_operator,bs_control_observer,bs_control_verifier;
CREATE FUNCTION control.queue_task_input_fingerprint(p_task text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT md5(jsonb_build_object('scope',control.dot_scope_fingerprint(p_task),'requirements',control.task_scope_requirement_fingerprint(p_task),
 'verification',(SELECT max(verification_run_id) FROM control.verification_runs v JOIN control.executions e ON e.execution_id=v.execution_id WHERE e.task_id=p_task),
 'generation',(SELECT input_generation FROM control.task_admission_generations WHERE task_id=p_task),
 'classification',control.current_lifecycle_failure(p_task),
 'reviews',(SELECT jsonb_agg(jsonb_build_array(v.verification_id,review.check_fingerprint,review.evidence) ORDER BY v.verification_id) FROM control.verification_failure_reviews review JOIN control.verification_results v USING(verification_id) JOIN control.executions e ON e.execution_id=v.execution_id WHERE e.task_id=p_task),
 'recovery',(SELECT jsonb_build_array(status,next_action,error_code,condition) FROM control.recovery_states WHERE current_task_id=p_task ORDER BY updated_at DESC LIMIT 1),
 'dependencies',(SELECT jsonb_agg(jsonb_build_array(d.depends_on_task_id,t.status) ORDER BY d.depends_on_task_id) FROM control.task_dependencies d JOIN control.tasks t ON t.task_id=d.depends_on_task_id WHERE d.task_id=p_task),
 'decisions',(SELECT jsonb_agg(jsonb_build_array(d.decision_id,d.status) ORDER BY d.decision_id) FROM control.task_decisions link JOIN control.decisions d USING(suit_slug,decision_id) WHERE link.task_id=p_task))::text);
$$;
CREATE FUNCTION control.park_unattended_queue_task(p_run uuid,p_task text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; s control.recovery_states%ROWTYPE; exhausted boolean;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 IF r.current_task_id IS DISTINCT FROM p_task OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(control.unattended_queue_grant(p_run)->'tasks') item WHERE item->>'task_id'=p_task) OR t.status NOT IN('failed','passed','in_progress','verification','blocked') THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM control.runtime_operations WHERE task_id=p_task AND status<>'consumed') OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=p_task AND status IN('queued','running')) THEN RETURN false;END IF;
 SELECT * INTO s FROM control.recovery_states WHERE current_task_id=p_task AND status='active' ORDER BY updated_at DESC LIMIT 1;
 IF NOT FOUND OR s.next_action IS NULL THEN RETURN false;END IF;
 exhausted:=s.error_code='retry_budget_exhausted' AND (control.product_retry_accounting(p_task)->>'consumed')::integer>=(control.resolved_retry_policy(p_task)->>'max_attempts')::integer;
 IF s.next_action NOT IN('wait-operator','wait-decision','safety-stop','wait-external') OR s.error_code IN('execution_in_flight','runtime_operation_in_flight','supervisor_lease_active','supervisor_lease_contended','retry_audit_required') THEN RETURN false;END IF;
 INSERT INTO control.unattended_queue_waits(run_id,task_id,prior_status,reason,input_fingerprint,exhausted) VALUES(p_run,p_task,t.status,s.error_code,control.queue_task_input_fingerprint(p_task),exhausted)
 ON CONFLICT(run_id,task_id) DO UPDATE SET prior_status=excluded.prior_status,reason=excluded.reason,input_fingerprint=excluded.input_fingerprint,exhausted=excluded.exhausted,resumed_at=NULL;
 UPDATE control.tasks SET status='blocked' WHERE task_id=p_task;
 UPDATE control.workflow_runs SET current_task_id=NULL,controller_lease_token=NULL,controller_lease_expires_at=NULL,run_revision=run_revision+1 WHERE run_id=p_run;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(p_task,CASE WHEN exhausted THEN 'queue_task_attempts_exhausted' ELSE 'queue_task_parked' END,t.status,'blocked','supervisor',jsonb_build_object('run_id',p_run,'reason',s.error_code,'completion_credit',false,'attempts_preserved',true));
 RETURN true;
END $$;
ALTER FUNCTION control.acquire_workflow_run_task(uuid,text,text,text,text) RENAME TO acquire_workflow_run_task_before_unattended_queue;
CREATE FUNCTION control.acquire_workflow_run_task(p_run uuid,p_protocol text,p_controller text,p_lease text,p_source text DEFAULT 'n8n') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; parked control.unattended_queue_waits%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF control.unattended_queue_grant(p_run) IS NULL THEN
 IF EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND action='unattended-queue-release') THEN RETURN jsonb_build_object('acquired',false,'reason','queue_authority_inactive');END IF;
 RETURN control.acquire_workflow_run_task_before_unattended_queue(p_run,p_protocol,p_controller,p_lease,p_source);END IF;
 IF p_protocol IS DISTINCT FROM r.controller_protocol OR p_controller IS DISTINCT FROM r.controller_fingerprint OR coalesce(p_lease,'')='' OR (r.controller_lease_expires_at>now() AND r.controller_lease_token IS DISTINCT FROM p_lease) THEN RETURN jsonb_build_object('acquired',false,'reason','controller_or_lease_mismatch');END IF;
 IF r.current_task_id IS NOT NULL AND NOT control.unattended_queue_task_current(p_run,r.current_task_id) THEN
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||r.current_task_id,p_idempotency_key=>'queue-stale:'||p_run||':'||control.queue_task_input_fingerprint(r.current_task_id),p_failure_class=>'operator-wait',p_error_code=>'queue_task_authority_stale',p_next_action=>'wait-operator',p_recoverable=>false,p_source=>'runner',p_project_id=>r.project_id,p_workstream_slug=>r.workstream_slug,p_workflow_run_id=>p_run,p_current_task_id=>r.current_task_id);
 RETURN jsonb_build_object('acquired',false,'reason','queue_task_authority_stale','task_id',r.current_task_id);END IF;
 IF r.current_task_id IS NULL THEN
 SELECT w.* INTO parked FROM control.unattended_queue_waits w JOIN control.tasks t USING(task_id) WHERE w.run_id=p_run AND w.resumed_at IS NULL AND NOT w.exhausted AND t.status='blocked'
 AND (w.input_fingerprint IS DISTINCT FROM control.queue_task_input_fingerprint(w.task_id) OR EXISTS(SELECT 1 FROM control.recovery_states s WHERE s.current_task_id=w.task_id AND s.status='active' AND s.next_action='wait-external' AND s.next_wake_at<=now() AND s.failure_class IN('publication-reconciliation','transient-infrastructure','verification-infrastructure','external-wait','repository-state','flaky-verification'))) AND control.unattended_queue_task_current(p_run,w.task_id)
 AND control.task_publication_authority_is_current(w.task_id) AND control.task_hard_dependencies_complete(w.task_id) AND control.task_blocking_decisions_clear(w.task_id)
 ORDER BY w.created_at LIMIT 1 FOR UPDATE OF w,t;
 IF FOUND THEN
 UPDATE control.tasks SET status=parked.prior_status WHERE task_id=parked.task_id;
 UPDATE control.unattended_queue_waits SET resumed_at=now() WHERE run_id=p_run AND task_id=parked.task_id;
 UPDATE control.workflow_runs SET current_task_id=parked.task_id,run_revision=run_revision+1 WHERE run_id=p_run;
 END IF;
 END IF;
 result:=control.acquire_workflow_run_task_before_unattended_queue(p_run,p_protocol,p_controller,p_lease,p_source);
 IF result->>'task_id' IS NOT NULL AND NOT control.unattended_queue_task_current(p_run,result->>'task_id') THEN RAISE EXCEPTION 'queue_task_authority_stale';END IF;
 IF result->>'acquired'='false' AND r.current_task_id IS NOT NULL THEN
 IF result->>'reason' IN('ordinary_claim_missing_or_stale','ordinary_task_not_resumable') THEN
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||r.current_task_id,p_idempotency_key=>'queue-admission:'||p_run||':'||control.queue_task_input_fingerprint(r.current_task_id),p_failure_class=>'operator-wait',p_error_code=>result->>'reason',p_next_action=>'wait-operator',p_recoverable=>false,p_source=>'runner',p_project_id=>r.project_id,p_workstream_slug=>r.workstream_slug,p_workflow_run_id=>p_run,p_current_task_id=>r.current_task_id);END IF;
 result:=result||jsonb_build_object('task_id',r.current_task_id);END IF;
 IF result->>'acquired'='false' AND result->>'reason'='no_admitted_task' THEN RETURN result||jsonb_build_object('reason','queue_idle','state','IDLE','next_wake_at',(SELECT min(s.next_wake_at) FROM control.unattended_queue_waits w JOIN control.recovery_states s ON s.current_task_id=w.task_id WHERE w.run_id=p_run AND w.resumed_at IS NULL AND NOT w.exhausted AND s.status='active' AND s.next_action='wait-external' AND s.next_wake_at>now() AND s.failure_class IN('publication-reconciliation','transient-infrastructure','verification-infrastructure','external-wait','repository-state','flaky-verification') AND control.unattended_queue_task_current(p_run,w.task_id)));END IF;
 RETURN result;
END $$;
-- Exclude unauthorised candidates before claim, rather than selecting then rejecting.
DO $$ DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.claim_next_task(text,text)'::regprocedure);
 definition:=replace(definition,'AND control.task_publication_authority_is_current(task.task_id)',
 'AND control.task_publication_authority_is_current(task.task_id) AND (active_run.run_id IS NULL OR NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=active_run.run_id) OR EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=active_run.run_id AND task_id=task.task_id)) AND (NOT EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=active_run.run_id AND action=''unattended-queue-release'') OR control.unattended_queue_task_current(active_run.run_id,task.task_id))');
 EXECUTE definition;
END $$;

DO $$ DECLARE f regprocedure;BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p WHERE p.pronamespace='control'::regnamespace AND p.proname IN(
 'current_run_publication_authority','current_run_publication_authority_before_unattended_queue','unattended_queue_grant','unattended_queue_task_current','unattended_queue_offer','operator_gate_offers','operator_gate_offers_before_unattended_queue',
 'resolve_authenticated_operator_gate','resolve_authenticated_operator_gate_before_unattended_queue','reconcile_ordinary_run_task','reconcile_ordinary_run_task_before_unattended_queue',
 'reconcile_ordinary_run_publication','reconcile_ordinary_run_publication_before_unattended_queue','queue_task_input_fingerprint','park_unattended_queue_task','acquire_workflow_run_task','acquire_workflow_run_task_before_unattended_queue') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',f);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_runtime_executor,bs_control_operator,bs_control_observer,bs_control_verifier',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION control.operator_gate_offers(uuid),control.unattended_queue_offer(uuid) TO bs_control_operator,bs_control_observer,bs_control_executor;
GRANT EXECUTE ON FUNCTION control.resolve_authenticated_operator_gate(uuid,uuid,text,text) TO bs_control_operator;
GRANT EXECUTE ON FUNCTION control.current_run_publication_authority(text) TO bs_control_executor;
GRANT EXECUTE ON FUNCTION control.unattended_queue_task_current(uuid,text),control.park_unattended_queue_task(uuid,text),control.acquire_workflow_run_task(uuid,text,text,text,text),control.reconcile_ordinary_run_publication(uuid),control.reconcile_ordinary_run_task(uuid,text) TO bs_runtime_executor;
COMMIT;
