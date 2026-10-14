BEGIN;
-- An audit is durable state-transition evidence, never a polling heartbeat.
CREATE TABLE control.retry_exhaustion_audits(
 audit_identity text PRIMARY KEY CHECK(audit_identity ~ '^[a-f0-9]{32}$'),
 task_id text NOT NULL REFERENCES control.tasks,
 recovery_state_id uuid REFERENCES control.recovery_states,
 event_id bigint NOT NULL UNIQUE REFERENCES control.task_events,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.retry_exhaustion_audits OWNER TO bs_control_migration_owner;
ALTER TABLE control.retry_exhaustion_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.retry_exhaustion_audits FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
-- Include authoritative source/attempt, latest verifier evidence and review,
-- policy and audit result; exclude recovery version, lease/heartbeat and events.
CREATE FUNCTION control.retry_audit_identity(p_task text,p_proof jsonb,p_generation uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT md5(jsonb_build_object('task',p_task,'generation',p_generation,
 'proof',p_proof-'fingerprint','policy',control.resolved_retry_policy(p_task),
 'executions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.execution_id,'attempt',e.attempt,'status',e.status,'source',e.commit_sha,'branch',e.branch_name,'worktree',e.worktree_path,'failure',control.retry_evidence_fingerprint(e.execution_id),
 'verification',(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id),
 'checks',(SELECT md5(coalesce(jsonb_agg(jsonb_build_object('id',v.verification_id,'status',v.status,'command',v.command,'exit',v.exit_code,'artifact',v.log_path,'receipt',v.trusted_receipt,'evidence',v.metadata->'failure_evidence','review',review.evidence) ORDER BY v.verification_id),'[]')::text) FROM control.verification_results v LEFT JOIN control.verification_failure_reviews review USING(verification_id) WHERE v.execution_id=e.execution_id AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id))) ORDER BY e.execution_id),'[]') FROM control.executions e WHERE e.task_id=p_task))::text);
$$;
ALTER FUNCTION control.retry_audit_identity(text,jsonb,uuid) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.retry_audit_identity(text,jsonb,uuid) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
CREATE INDEX dot_retry_audit_history_idx ON control.task_events(task_id,event_id DESC) WHERE event_type='retry_exhaustion_audited';
-- Seed only the latest still-bound reviewed generation. Preserve every old row.
-- Current verification IDs must be demonstrated in the old proof; no inferred
-- backfill across a newly completed verification/source generation.
INSERT INTO control.retry_exhaustion_audits(audit_identity,task_id,recovery_state_id,event_id,result,created_at)
SELECT control.retry_audit_identity(ev.task_id,ev.payload->'audit',s.recovery_state_id),ev.task_id,s.recovery_state_id,ev.event_id,
 jsonb_build_object('audited',true,'operator_gate',ev.payload#>>'{audit,action}'='operator-gate','accounting',control.product_retry_accounting(ev.task_id),'event_id',ev.event_id,'historical',true),ev.created_at
FROM control.recovery_states s JOIN LATERAL(SELECT * FROM control.task_events WHERE task_id=s.current_task_id AND event_type='retry_exhaustion_audited' AND payload#>>'{prior_recovery,recovery_state_id}'=s.recovery_state_id::text ORDER BY event_id DESC LIMIT 1) ev ON true
WHERE NOT EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=ev.task_id AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ev.payload#>'{audit,entries}') item WHERE (item->>'execution_id')::bigint=e.execution_id AND (item->>'attempt')::integer=e.attempt))
AND NOT EXISTS(SELECT 1 FROM control.executions e JOIN control.verification_runs v USING(execution_id) WHERE e.task_id=ev.task_id AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ev.payload#>'{audit,entries}') item CROSS JOIN LATERAL jsonb_array_elements(coalesce(item->'blocking_checks','[]')) checkrow WHERE (item->>'execution_id')::bigint=e.execution_id AND checkrow#>>'{failure_evidence,verification_run_id}'=v.verification_run_id::text))
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION control.record_retry_exhaustion_audit(p_task text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; s control.recovery_states%ROWTYPE; item jsonb; ex control.executions%ROWTYPE; budget jsonb; max_slots integer; gate boolean; prev jsonb; identity text; existing jsonb; audit_event bigint; result jsonb;
BEGIN
SELECT * INTO r FROM control.workflow_runs WHERE current_task_id=p_task ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
IF r.run_id IS NULL OR r.stop_requested OR r.maintenance_requested OR (EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=r.run_id) AND NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=r.run_id AND task_id=p_task)) THEN RETURN jsonb_build_object('audited',false,'reason','hard_run_gate');END IF;
max_slots:=(control.resolved_retry_policy(p_task)->>'max_attempts')::integer;
IF p_proof->>'version'<>'1' OR p_proof->>'all_attempts_audited'<>'true' OR (p_proof->>'max_attempts')::integer<>max_slots OR jsonb_typeof(p_proof->'entries')<>'array' THEN RAISE EXCEPTION 'Complete unchanged-policy audit required';END IF;
-- Serialize fallback, webhook and restarted callers on the existing run row.
SELECT * INTO s FROM control.recovery_states WHERE current_task_id=p_task ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
identity:=control.retry_audit_identity(p_task,p_proof,s.recovery_state_id);
SELECT a.result INTO existing FROM control.retry_exhaustion_audits a WHERE a.audit_identity=identity;
IF FOUND THEN RETURN existing||jsonb_build_object('idempotent',true);END IF;
FOR item IN SELECT value FROM jsonb_array_elements(p_proof->'entries') LOOP
SELECT * INTO ex FROM control.executions WHERE task_id=p_task AND execution_id=(item->>'execution_id')::bigint;
IF ex.execution_id IS NULL OR ex.status='running' OR ex.attempt<>(item->>'attempt')::integer OR item->>'classification' NOT IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN') THEN RAISE EXCEPTION 'Audit execution/classification mismatch';END IF;
IF item->>'classification'='PRODUCT_DEFECT' AND NOT EXISTS(
 SELECT 1 FROM control.verification_results vr JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE vr.execution_id=ex.execution_id AND vr.status='fail' AND review.evidence->>'classification'='PRODUCT_DEFECT'
 AND vr.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=ex.execution_id)
 AND review.check_fingerprint=md5(jsonb_build_array(vr.execution_id,vr.verification_run_id,vr.check_name,vr.command,vr.exit_code,vr.status,vr.log_path)::text)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(item->'blocking_checks') c WHERE c->'failure_evidence'=review.evidence)
 ) THEN RAISE EXCEPTION 'Authoritative execution-bound reviewed product evidence required';END IF;
INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
VALUES(ex.execution_id,CASE WHEN item->>'classification'='UNKNOWN' THEN 'OTHER' WHEN item->>'classification'='PUBLICATION_INFRA' THEN 'VERIFIER_INFRA' ELSE item->>'classification' END,md5(control.retry_evidence_fingerprint(ex.execution_id)||(p_proof->>'fingerprint')),'dot',item||jsonb_build_object('audited',true,'audit_version',1)) ON CONFLICT DO NOTHING;
END LOOP;
IF EXISTS(SELECT 1 FROM control.executions e WHERE e.task_id=p_task AND e.status<>'running' AND EXISTS(SELECT 1 FROM control.failures f WHERE f.execution_id=e.execution_id) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_proof->'entries') i WHERE (i->>'execution_id')::bigint=e.execution_id)) THEN RAISE EXCEPTION 'Every failed attempt must be audited';END IF;
budget:=control.product_retry_accounting(p_task);
IF (budget->>'consumed')::integer<>(p_proof->>'consumed')::integer THEN RAISE EXCEPTION 'Product accounting mismatch';END IF;
SELECT * INTO s FROM control.recovery_states WHERE current_task_id=p_task ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
-- Audit is evidence only while a worker or a different safety boundary owns the task.
IF EXISTS(SELECT 1 FROM control.executions WHERE task_id=p_task AND status='running') OR s.lease_expires_at>now() THEN RETURN jsonb_build_object('audited',true,'accounting',budget);END IF;
IF s.error_code NOT IN('retry_budget_exhausted','retry_classification_review_required','unknown_failure_outcome','retry_exhaustion_reconciled','retry_audit_investigation_required') THEN RETURN jsonb_build_object('audited',true,'accounting',budget);END IF;
-- Mutable recovery.condition and heartbeat version are not deduplication authority.
gate:=p_proof->>'action'='operator-gate' AND (budget->>'consumed')::integer>=max_slots AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_proof->'entries') i WHERE i->>'classification'='UNKNOWN');
prev:=to_jsonb(s);
IF NOT gate AND r.status='failed' THEN
 IF NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g WHERE g.run_id=r.run_id AND g.revoked_at IS NULL AND g.max_tasks=r.max_tasks AND g.repair_id IS NOT DISTINCT FROM r.admitted_repair_id) OR EXISTS(SELECT 1 FROM control.workflow_runs other WHERE other.suit_slug=r.suit_slug AND other.status='running' AND other.run_id<>r.run_id) THEN RETURN jsonb_build_object('audited',true,'reason','authority_gate');END IF;
 UPDATE control.workflow_runs SET status='running',finished_at=NULL,run_revision=run_revision+1 WHERE run_id=r.run_id;
END IF;
UPDATE control.recovery_states SET condition=condition||jsonb_build_object('exhaustion_audit',p_proof),status=CASE WHEN gate THEN 'active' ELSE 'resolved' END,error_code=CASE WHEN gate THEN 'retry_budget_exhausted' ELSE 'retry_exhaustion_reconciled' END,next_action=CASE WHEN gate THEN 'wait-operator' ELSE 'reverify' END,failure_class=CASE WHEN gate THEN 'operator-wait' ELSE 'verification-infrastructure' END,recoverable=NOT gate,resolved_at=CASE WHEN gate THEN NULL ELSE now() END,next_wake_at=CASE WHEN gate THEN NULL ELSE now() END,version=version+1,updated_at=now() WHERE recovery_state_id=s.recovery_state_id;
INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'retry_exhaustion_audited','dot',jsonb_build_object('run_id',r.run_id,'audit',p_proof,'prior_recovery',prev,'history_preserved',true,'budget_unchanged',true,'audit_identity',identity)) RETURNING event_id INTO audit_event;
result:=jsonb_build_object('audited',true,'operator_gate',gate,'accounting',budget,'event_id',audit_event,'audit_identity',identity);
INSERT INTO control.retry_exhaustion_audits(audit_identity,task_id,recovery_state_id,event_id,result) VALUES(identity,p_task,s.recovery_state_id,audit_event,result);
RETURN result;
END $$;

ALTER FUNCTION control.record_retry_exhaustion_audit(text,jsonb) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.record_retry_exhaustion_audit(text,jsonb) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.record_retry_exhaustion_audit(text,jsonb) TO bs_control_executor;
ALTER TABLE control.dot_wake_events ADD COLUMN wake_kind text NOT NULL DEFAULT 'state' CHECK(wake_kind IN('state','derived'));
ALTER TABLE control.dot_wake_events ADD COLUMN wake_identity text;
CREATE UNIQUE INDEX dot_pending_wake_identity_idx ON control.dot_wake_events(wake_identity) WHERE consumed_at IS NULL AND wake_identity IS NOT NULL;
CREATE INDEX dot_pending_state_event_idx ON control.dot_wake_events(event_id DESC) WHERE consumed_at IS NULL AND wake_kind='state';
CREATE OR REPLACE FUNCTION control.dot_signal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE v_new jsonb:=to_jsonb(NEW); v_old jsonb; v_event bigint; kind text; identity text;
BEGIN
 IF TG_TABLE_NAME='recovery_states' AND v_new->>'failure_class' IN('transient-infrastructure','publication-reconciliation') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  v_old:=to_jsonb(OLD);
  -- Ignore heartbeats and lease renewals; state transitions and evidence wake Dot.
  IF (v_new->'status',v_new->'engine_stage',v_new->'current_task_id',v_new->'completed_tasks',v_new->'next_action',v_new->'failure_class',v_new->'verification_plan',v_new->'execution_id',v_new->'commit_sha',v_new->'error_code',v_new->'failure_id')
   IS NOT DISTINCT FROM (v_old->'status',v_old->'engine_stage',v_old->'current_task_id',v_old->'completed_tasks',v_old->'next_action',v_old->'failure_class',v_old->'verification_plan',v_old->'execution_id',v_old->'commit_sha',v_old->'error_code',v_old->'failure_id') THEN RETURN NEW; END IF;
 END IF;
 kind:=CASE WHEN TG_TABLE_NAME='product_attempt_classifications' AND v_new#>>'{evidence,audited}'='true' THEN 'derived' ELSE 'state' END;
 identity:=md5(jsonb_build_array(TG_TABLE_NAME,v_new->'task_id',v_new->'execution_id',v_new->'evidence_fingerprint',v_new->'run_id',v_new->'workflow_run_id',v_new->'status',v_new->'engine_stage',v_new->'current_task_id',v_new->'completed_tasks',v_new->'next_action',v_new->'failure_class',v_new->'verification_plan',v_new->'execution_id',v_new->'commit_sha',v_new->'error_code',v_new->'failure_id',v_new->'verification_run_id',v_new->'attempt',v_new->'recovery_state_id',v_new->'pull_request_id',v_new->'state')::text);
 INSERT INTO control.dot_wake_events(origin,payload,wake_kind,wake_identity) VALUES(TG_TABLE_NAME,jsonb_build_object('run_id',coalesce(v_new->>'run_id',v_new->>'workflow_run_id'),'task_id',coalesce(v_new->>'task_id',v_new->>'current_task_id'),'execution_id',v_new->>'execution_id','status',v_new->>'status'),kind,identity)
 -- Advance the identifier on a repeated authoritative transition. Coalescing
 -- must never let an old scan watermark acknowledge a later A->B->A change.
 ON CONFLICT(wake_identity) WHERE consumed_at IS NULL AND wake_identity IS NOT NULL
 DO UPDATE SET event_id=DEFAULT,payload=excluded.payload,created_at=now() RETURNING event_id INTO v_event;
 IF v_event IS NULL OR kind='derived' THEN RETURN NEW;END IF;
 PERFORM pg_notify('bs_dot_wake',jsonb_build_object('event_id',v_event)::text);
 RETURN NEW;
END $$;

ALTER FUNCTION control.dot_signal() OWNER TO bs_control_migration_owner;
-- Raw/duplicate webhook deliveries do not justify a global scan. The 110s
-- bound leaves the existing two-minute periodic safety fallback intact.
CREATE FUNCTION control.dot_watch_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT NOT EXISTS(SELECT 1 FROM control.dot_cycles WHERE started_at>now()-interval '110 seconds')
 OR EXISTS(SELECT 1 FROM control.dot_wake_events WHERE consumed_at IS NULL AND wake_kind='state' AND coalesce(payload->>'event_type','') NOT IN('retry_exhaustion_audited'));
$$;
ALTER FUNCTION control.dot_watch_ready() OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.dot_watch_ready() FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.dot_watch_ready() TO bs_control_executor;
COMMIT;
