BEGIN;
-- Dot is an automation actor, never a fabricated human approval.
ALTER TABLE control.task_events DROP CONSTRAINT task_events_source_check;
ALTER TABLE control.task_events ADD CONSTRAINT task_events_source_check CHECK(source IN('system','n8n','runner','supervisor','codex','github','human','chatgpt','dot'));
-- A Shared-only policy. Other foundation-three consumers and all recorded
-- execution snapshots remain untouched.
INSERT INTO control.retry_policies(policy_id,display_name,max_attempts,attempt_profiles,metadata)
VALUES('shared-foundation-five','Shared foundation: five product slots',5,
 '["standard","standard","deep","deep","review"]',
 '{"source":"human","product_budget":5,"non_product_same_attempt_recovery":true}')
ON CONFLICT(policy_id) DO UPDATE SET max_attempts=5,attempt_profiles=excluded.attempt_profiles,active=true;
UPDATE control.workstreams SET retry_policy_id='shared-foundation-five'
 WHERE slug='shared' AND retry_policy_id='foundation-three';
UPDATE control.tasks SET retry_policy_id='shared-foundation-five'
 WHERE workstream_slug='shared' AND retry_policy_id='foundation-three' AND status NOT IN('complete','cancelled');
-- Resolve future imported Shared foundation tasks too, even when an old handoff
-- explicitly carries foundation-three. Preserve the handoff and history.
CREATE OR REPLACE FUNCTION control.resolved_retry_policy(p_task_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH resolved AS (
 SELECT t.workstream_slug,coalesce(t.retry_policy_id,w.retry_policy_id,p.retry_policy_id,trim(both '"' from ps.value::text)) AS policy_id,
 CASE WHEN t.retry_policy_id IS NOT NULL THEN 'task' WHEN w.retry_policy_id IS NOT NULL THEN 'workstream'
 WHEN p.retry_policy_id IS NOT NULL THEN 'project' ELSE 'global' END AS inherited_from
 FROM control.tasks t LEFT JOIN control.workstreams w ON w.project_id=t.project_id AND w.slug=t.workstream_slug
 LEFT JOIN control.projects p ON p.project_id=t.project_id LEFT JOIN control.platform_settings ps ON ps.setting_key='global_retry_policy'
 WHERE t.task_id=p_task_id)
 SELECT jsonb_build_object('policy_id',rp.policy_id,'max_attempts',rp.max_attempts,'attempt_profiles',rp.attempt_profiles,'inherited_from',resolved.inherited_from)
 FROM resolved JOIN control.retry_policies rp ON rp.policy_id=CASE
 WHEN resolved.workstream_slug='shared' AND resolved.policy_id='foundation-three' THEN 'shared-foundation-five' ELSE resolved.policy_id END WHERE rp.active;
$$;
CREATE OR REPLACE FUNCTION control.retry_evidence_fingerprint(p_execution bigint) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT md5(jsonb_build_object('execution',e.execution_id,'probe',e.metadata->'verification_probe_failures','failure',f.failure_id,'checks',coalesce(f.metadata->'checks',f.metadata#>'{verification_probe,checks}'))::text)
 FROM control.executions e LEFT JOIN LATERAL (SELECT * FROM control.failures WHERE execution_id=e.execution_id AND stage IN('verification','implementation') ORDER BY failure_id DESC LIMIT 1) f ON true WHERE e.execution_id=p_execution;
$$;
-- Append-only corrections are separate from immutable execution/failure records.
CREATE TABLE control.product_attempt_classifications (
 classification_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 execution_id bigint NOT NULL REFERENCES control.executions(execution_id),
 classification text NOT NULL CHECK(classification IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','OTHER')),
 evidence_fingerprint text NOT NULL,
 source text NOT NULL CHECK(source IN('human','dot')),
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object' AND evidence<>'{}'::jsonb),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(execution_id,evidence_fingerprint,source)
);
ALTER TABLE control.product_attempt_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_attempt_service_read ON control.product_attempt_classifications FOR SELECT TO bs_control_app USING(true);
CREATE OR REPLACE FUNCTION control.product_retry_accounting(p_task text) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH entries AS (
 SELECT e.execution_id,e.attempt,e.status,coalesce(c.classification,'OTHER') AS classification,c.source,
 c.evidence,c.classification_id,
 coalesce(c.classification NOT IN('VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE'),true) AS charged
 FROM control.executions e LEFT JOIN LATERAL (
 SELECT * FROM control.product_attempt_classifications a WHERE a.execution_id=e.execution_id
 ORDER BY classification_id DESC LIMIT 1) c ON true WHERE e.task_id=p_task)
 SELECT jsonb_build_object('consumed',count(*) FILTER(WHERE charged),'genuine_product',count(*) FILTER(WHERE classification='PRODUCT_DEFECT'),
 'all_product',coalesce(bool_and(classification='PRODUCT_DEFECT'),false),'classifications',coalesce(jsonb_agg(to_jsonb(entries) ORDER BY attempt),'[]'::jsonb)) FROM entries;
$$;
CREATE OR REPLACE FUNCTION control.audit_product_attempts(p_task text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE e record; checks jsonb; blocking jsonb; cls text;
BEGIN
 IF control.resolved_retry_policy(p_task)->>'policy_id' IS DISTINCT FROM 'shared-foundation-five' THEN RETURN NULL; END IF;
 FOR e IN SELECT * FROM control.executions WHERE task_id=p_task AND status IN('failed','succeeded','blocked','cancelled') ORDER BY attempt LOOP
  IF EXISTS(SELECT 1 FROM control.product_attempt_classifications WHERE execution_id=e.execution_id AND evidence_fingerprint=control.retry_evidence_fingerprint(e.execution_id)) THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task AND status='failed') THEN CONTINUE; END IF;
  checks:=e.metadata->'verification_probe_failures';
  IF checks IS NULL OR jsonb_array_length(checks)=0 THEN
   SELECT jsonb_agg(jsonb_build_object('status',v.status,'failure_class',v.metadata->>'failure_class','selection_reason',v.metadata->>'selection_reason','required',coalesce(v.metadata->'required','true'::jsonb))) INTO checks
   FROM control.verification_results v WHERE v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id);
  END IF;
  -- Full persisted probe receipts retain selection_reason, unlike summaries.
  IF EXISTS(SELECT 1 FROM control.failures f WHERE f.execution_id=e.execution_id AND jsonb_typeof(f.metadata#>'{verification_probe,checks}')='array') THEN
   SELECT f.metadata#>'{verification_probe,checks}' INTO checks FROM control.failures f WHERE f.execution_id=e.execution_id AND jsonb_typeof(f.metadata#>'{verification_probe,checks}')='array' ORDER BY failure_id DESC LIMIT 1;
  END IF;
  SELECT coalesce(jsonb_agg(c),'[]'::jsonb) INTO blocking FROM jsonb_array_elements(coalesce(checks,'[]'::jsonb)) c
   WHERE coalesce(c->>'required','true')<>'false' AND c->>'status' IN('fail','not_run','unavailable');
  cls:='OTHER';
  IF jsonb_array_length(blocking)>0 THEN
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE NOT coalesce((
    c->>'status'='not_run' AND c->>'selection_reason' IN('generator_disposable_fixture_runner_not_registered','missing_generated_fixture_boundary_runner','browser_configuration_discovery_failed','verification_plan_entry_unenforced')
    OR coalesce(c->>'failure_class','') IN('verification-configuration','CONFIGURATION')),false)) THEN cls:='CONFIGURATION';
   ELSIF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE coalesce(c->>'failure_class','') NOT IN('verification-infrastructure','verification-lifecycle','flaky-verification','VERIFIER_INFRA')) THEN cls:='VERIFIER_INFRA';
   ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE c->>'status'='fail' AND c->>'failure_class' IN('verification-product-defect','PRODUCT_DEFECT')) THEN cls:='PRODUCT_DEFECT';
   END IF;
  ELSE
   IF e.status='succeeded' AND NOT EXISTS(SELECT 1 FROM control.failures WHERE execution_id=e.execution_id) THEN CONTINUE; END IF;
   SELECT CASE f.failure_class WHEN 'transient-infrastructure' THEN 'TRANSIENT_INFRASTRUCTURE' WHEN 'repository-state' THEN 'REPOSITORY_WORKTREE' ELSE 'OTHER' END INTO cls
   FROM control.failures f WHERE f.execution_id=e.execution_id ORDER BY failure_id DESC LIMIT 1;
   cls:=coalesce(cls,'OTHER');
  END IF;
  INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
  VALUES(e.execution_id,cls,control.retry_evidence_fingerprint(e.execution_id),'dot',jsonb_build_object('checks',blocking,'basis','persisted structured evidence; unknown stays guarded')) ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN control.product_retry_accounting(p_task);
END $$;
-- Budget and routing use chargeable slots, while physical ordinals stay unique.
ALTER FUNCTION control.start_retry_execution(text,integer,text,text,text) RENAME TO start_retry_execution_physical_v1;
CREATE OR REPLACE FUNCTION control.start_retry_execution(p_task_id text,p_max_attempts integer,p_model_profile text,p_model_name text,p_reasoning_effort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE policy jsonb; budget jsonb; previous control.executions%ROWTYPE; slot integer; new_id bigint;
BEGIN
 PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
 policy:=control.resolved_retry_policy(p_task_id);
 IF policy->>'policy_id' IS DISTINCT FROM 'shared-foundation-five' THEN
  RETURN control.start_retry_execution_physical_v1(p_task_id,p_max_attempts,p_model_profile,p_model_name,p_reasoning_effort);
 END IF;
 IF p_max_attempts IS DISTINCT FROM (policy->>'max_attempts')::integer OR p_max_attempts<>5 THEN RAISE EXCEPTION 'Configured Shared product budget must remain five'; END IF;
 budget:=control.audit_product_attempts(p_task_id);slot:=(budget->>'consumed')::integer+1;
 IF slot>5 THEN RETURN jsonb_build_object('allowed',false,'reason','retry_limit_reached','max_attempts',5,'accounting',budget); END IF;
 IF (budget#>>'{classifications,-1,classification}') IS DISTINCT FROM 'PRODUCT_DEFECT' THEN RAISE EXCEPTION 'Non-product or unknown failure must recover on the same execution'; END IF;
 IF p_model_profile IS DISTINCT FROM policy->'attempt_profiles'->>(slot-1)
 OR p_model_name IS DISTINCT FROM (CASE WHEN slot=5 THEN 'gpt-6-astra' ELSE 'gpt-6.1-sol' END)
 OR p_reasoning_effort IS DISTINCT FROM (CASE WHEN slot<=2 THEN 'medium' ELSE 'high' END) THEN RAISE EXCEPTION 'Incorrect Shared product slot routing'; END IF;
 SELECT * INTO previous FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC LIMIT 1;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task_id AND status='failed') OR previous.status='running' THEN RAISE EXCEPTION 'Latest settled failed task required'; END IF;
 UPDATE control.tasks SET status='in_progress' WHERE task_id=p_task_id;
 INSERT INTO control.executions(task_id,attempt,model_profile,model_name,reasoning_effort,status,worktree_path,branch_name,parent_branch,parent_sha,started_at,resolved_retry_policy)
 VALUES(p_task_id,previous.attempt+1,p_model_profile,p_model_name,p_reasoning_effort,'running',previous.worktree_path,previous.branch_name,previous.parent_branch,previous.parent_sha,now(),policy)
 RETURNING execution_id INTO new_id;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
 VALUES(p_task_id,'retry_started','failed','in_progress','runner',jsonb_build_object('execution_id',new_id,'previous_execution_id',previous.execution_id,'attempt',previous.attempt+1,
 'product_slot',slot,'max_attempts',5,'accounting',budget,'model_profile',p_model_profile,'model_name',p_model_name,'reasoning_effort',p_reasoning_effort));
 RETURN jsonb_build_object('allowed',true,'execution_id',new_id,'attempt',previous.attempt+1,'previous_execution_id',previous.execution_id,'previous_attempt',previous.attempt,
 'worktree_path',previous.worktree_path,'branch_name',previous.branch_name,'parent_branch',previous.parent_branch,'parent_sha',previous.parent_sha,'product_slot',slot,'max_attempts',5);
END $$;
REVOKE ALL ON FUNCTION control.start_retry_execution_physical_v1(text,integer,text,text,text) FROM PUBLIC,bs_control_app;
-- Only a prior exhaustion stop may reopen an existing authorized run. Never
-- reopen cancellations, revocations, operator holds, live owners or other stops.
CREATE OR REPLACE FUNCTION control.reconcile_shared_retry_exhaustion(p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; s control.recovery_states%ROWTYPE; b jsonb; cls text;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF r.run_id IS NULL OR r.status NOT IN('failed','running') OR r.workstream_slug<>'shared' OR r.current_task_id IS NULL
 OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks THEN RETURN jsonb_build_object('resumed',false,'reason','run_gate'); END IF;
 IF EXISTS(SELECT 1 FROM control.workflow_runs other WHERE other.suit_slug=r.suit_slug AND other.status='running' AND other.run_id<>r.run_id) THEN RETURN jsonb_build_object('resumed',false,'reason','another_run_active'); END IF;
 SELECT * INTO s FROM control.recovery_states WHERE resume_identity='task:'||r.current_task_id FOR UPDATE;
 IF s.error_code IS DISTINCT FROM 'retry_budget_exhausted' OR s.next_action<>'safety-stop'
 OR control.resolved_retry_policy(r.current_task_id)->>'policy_id' IS DISTINCT FROM 'shared-foundation-five'
 OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=r.current_task_id AND status='failed')
 OR (r.controller_lease_expires_at>now()) OR (s.lease_expires_at>now())
 OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=r.current_task_id AND status IN('running','queued'))
 THEN RETURN jsonb_build_object('resumed',false,'reason','exhaustion_gate'); END IF;
 IF NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g WHERE g.run_id=r.run_id AND g.revoked_at IS NULL
 AND g.project_id=r.project_id AND g.workstream_slug=r.workstream_slug AND g.max_tasks=r.max_tasks
 AND g.repair_id=r.admitted_repair_id AND g.controller_fingerprint=r.controller_fingerprint)
 THEN RETURN jsonb_build_object('resumed',false,'reason','bounded_authority_missing'); END IF;
 b:=control.audit_product_attempts(r.current_task_id);cls:=b#>>'{classifications,-1,classification}';
 IF cls='OTHER' THEN RETURN jsonb_build_object('resumed',false,'reason','classification_review_required','accounting',b); END IF;
 IF (b->>'consumed')::integer>=5 THEN RETURN jsonb_build_object('resumed',false,'reason',CASE WHEN (b->>'all_product')::boolean THEN 'retry_budget_exhausted' ELSE 'classification_review_required' END,'accounting',b); END IF;
 PERFORM control.refresh_dot_admission(r.run_id);
 UPDATE control.workflow_runs SET status='running',finished_at=NULL,run_revision=run_revision+1 WHERE run_id=r.run_id;
 UPDATE control.recovery_states SET status='resolved',next_action=CASE WHEN cls='PRODUCT_DEFECT' THEN 'retry' ELSE 'reverify' END,
 error_code='retry_exhaustion_reconciled',recoverable=true,next_wake_at=now(),resolved_at=now(),version=version+1,updated_at=now() WHERE recovery_state_id=s.recovery_state_id;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(r.current_task_id,'retry_exhaustion_reconciled','dot',
 jsonb_build_object('run_id',r.run_id,'prior_run_status',r.status,'prior_recovery',to_jsonb(s),'policy',control.resolved_retry_policy(r.current_task_id),'accounting',b,'history_preserved',true));
 RETURN jsonb_build_object('resumed',true,'run_id',r.run_id,'accounting',b);
END $$;
REVOKE ALL ON control.product_attempt_classifications FROM PUBLIC,bs_control_app;
GRANT SELECT ON control.product_attempt_classifications TO bs_control_app;
REVOKE ALL ON SEQUENCE control.product_attempt_classifications_classification_id_seq FROM PUBLIC,bs_control_app;
REVOKE ALL ON FUNCTION control.retry_evidence_fingerprint(bigint),control.product_retry_accounting(text),control.start_retry_execution(text,integer,text,text,text),control.audit_product_attempts(text),control.reconcile_shared_retry_exhaustion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.retry_evidence_fingerprint(bigint) TO bs_control_app;
GRANT EXECUTE ON FUNCTION control.product_retry_accounting(text),control.audit_product_attempts(text),control.reconcile_shared_retry_exhaustion(uuid),control.start_retry_execution(text,integer,text,text,text) TO bs_control_app;
COMMIT;
