BEGIN;
-- Failed runs with a current task remain recoverable. Historical failures whose
-- lifecycle ended have no recovery ownership; counters alone never close a run.
CREATE FUNCTION control.run_is_actionable(p_status text,p_current_task text,p_finished timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT p_status='running' OR (p_status='failed' AND p_current_task IS NOT NULL);
$$;
CREATE TABLE control.run_lifecycle_audits(
 run_id uuid PRIMARY KEY REFERENCES control.workflow_runs,
 classification text NOT NULL CHECK(classification IN('CLOSED','SUPERSEDED','COMPLETE')),
 reason text NOT NULL,evidence jsonb NOT NULL,audited_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.run_lifecycle_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY run_lifecycle_private ON control.run_lifecycle_audits TO bs_control_app USING(true);
REVOKE ALL ON control.run_lifecycle_audits FROM PUBLIC,anon,authenticated;
GRANT SELECT ON control.run_lifecycle_audits TO bs_control_app;
CREATE FUNCTION control.reconcile_empty_run(p_run uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; scope jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF r.run_id IS NULL OR r.status<>'running' OR r.current_task_id IS NOT NULL
 OR r.admitted_repair_id IS NOT NULL OR r.controller_lease_expires_at>now()
 OR r.maintenance_requested OR r.stop_requested THEN RETURN jsonb_build_object('closed',false,'reason','run_owned_or_gated');END IF;
 -- Frozen/admitted scopes take precedence. A native run without an explicit
 -- scope still owns its registered workstream queue, including blocked work.
 SELECT coalesce(jsonb_agg(jsonb_build_object('task_id',t.task_id,'status',t.status)),'[]') INTO scope
 FROM control.tasks t WHERE t.project_id=r.project_id AND t.workstream_slug=r.workstream_slug AND t.suit_slug=r.suit_slug
 AND (NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities a WHERE a.run_id=r.run_id)
 AND NOT EXISTS(SELECT 1 FROM control.batch_task_admissions a WHERE a.run_id=r.run_id)
 OR EXISTS(SELECT 1 FROM control.dot_task_scope_authorities a WHERE a.run_id=r.run_id AND a.task_id=t.task_id)
 OR EXISTS(SELECT 1 FROM control.batch_task_admissions a WHERE a.run_id=r.run_id AND a.task_id=t.task_id AND a.status<>'revoked'));
 -- Require registered scope evidence, not an empty registry or the arithmetic.
 IF jsonb_array_length(scope)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(scope) t WHERE t->>'status' NOT IN('complete','cancelled'))
 OR EXISTS(SELECT 1 FROM control.recovery_states s WHERE s.workflow_run_id=r.run_id AND s.status='active'
 AND (s.lease_expires_at>now() OR s.next_wake_at>now() OR s.next_action IN('wait-operator','wait-decision','safety-stop')))
 OR EXISTS(SELECT 1 FROM control.runtime_operations o WHERE o.task_id IN(SELECT t->>'task_id' FROM jsonb_array_elements(scope) t) AND o.status IN('pending','running'))
 THEN RETURN jsonb_build_object('closed',false,'reason','remaining_scope_or_live_owner');END IF;
 INSERT INTO control.run_lifecycle_audits(run_id,classification,reason,evidence)
 VALUES(r.run_id,'CLOSED','Registered intended scope already terminal; no current task, live owner, timer or remaining work',jsonb_build_object('before',to_jsonb(r),'registered_scope',scope,'completion_credit_added',false))
 ON CONFLICT DO NOTHING;
 UPDATE control.workflow_runs SET status='cancelled',finished_at=now(),updated_at=now(),run_revision=run_revision+1 WHERE run_id=r.run_id;
 RETURN jsonb_build_object('closed',true,'classification','CLOSED','run_id',r.run_id,'completion_credit_added',false);
END $$;
-- Reject terminal runs even if a stale persisted health observation says STUCK.
ALTER FUNCTION control.claim_dot_recovery(uuid,text,text,jsonb) RENAME TO claim_dot_recovery_live;
CREATE FUNCTION control.claim_dot_recovery(p_run uuid,p_fingerprint text,p_family text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF NOT coalesce(control.run_is_actionable(r.status,r.current_task_id,r.finished_at),false) THEN
 RETURN jsonb_build_object('claimed',false,'reason','terminal_run');END IF;
 RETURN control.claim_dot_recovery_live(p_run,p_fingerprint,p_family,p_evidence);
END $$;
REVOKE ALL ON FUNCTION control.claim_dot_recovery_live(uuid,text,text,jsonb),control.run_is_actionable(text,text,timestamptz),control.reconcile_empty_run(uuid),control.claim_dot_recovery(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION control.claim_dot_recovery_live(uuid,text,text,jsonb) FROM bs_control_app;
GRANT EXECUTE ON FUNCTION control.run_is_actionable(text,text,timestamptz),control.reconcile_empty_run(uuid),control.claim_dot_recovery(uuid,text,text,jsonb) TO bs_control_app;
COMMIT;
