BEGIN;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_operator') THEN CREATE ROLE bs_control_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_observer') THEN CREATE ROLE bs_control_observer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;END IF;
END $$;
GRANT USAGE ON SCHEMA control TO bs_control_operator,bs_control_observer;
CREATE TABLE control.operator_actors(actor_id uuid PRIMARY KEY,identity_provider text NOT NULL CHECK(identity_provider='local-n8n'),enabled boolean NOT NULL DEFAULT true,registered_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE control.operator_authority_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 run_id uuid NOT NULL REFERENCES control.workflow_runs,task_id text REFERENCES control.tasks,
 gate_fingerprint text NOT NULL CHECK(gate_fingerprint ~ '^[a-f0-9]{32}$'),
 action text NOT NULL,response text NOT NULL CHECK(response IN('approve','reject','revoke')),
 actor_id uuid NOT NULL REFERENCES control.operator_actors,offer jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(run_id,gate_fingerprint,response)
);
CREATE TABLE control.operator_invocation_extensions(
 grant_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL UNIQUE REFERENCES control.operator_authority_events,
 run_id uuid NOT NULL REFERENCES control.workflow_runs,task_id text REFERENCES control.tasks,
 incident_id uuid REFERENCES control.dot_incidents,
 kind text NOT NULL CHECK(kind IN('product-retry-extension','incident-investigation-extension')),
 granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,consumed_at timestamptz,
 execution_id bigint REFERENCES control.executions,invocation_id bigint REFERENCES control.dot_model_invocations,
 CHECK((kind='product-retry-extension' AND task_id IS NOT NULL AND incident_id IS NULL) OR (kind='incident-investigation-extension' AND incident_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_unused_operator_extension ON control.operator_invocation_extensions(run_id,coalesce(task_id,''),kind) WHERE consumed_at IS NULL AND revoked_at IS NULL;
ALTER TABLE control.operator_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.operator_authority_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.operator_invocation_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY operator_events_read ON control.operator_authority_events FOR SELECT TO bs_control_app,bs_control_observer USING(true);
CREATE POLICY operator_extensions_read ON control.operator_invocation_extensions FOR SELECT TO bs_control_app,bs_control_observer USING(true);
REVOKE ALL ON control.operator_actors,control.operator_authority_events,control.operator_invocation_extensions FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_operator,bs_control_observer;
GRANT SELECT ON control.operator_authority_events,control.operator_invocation_extensions TO bs_control_app,bs_control_observer;
ALTER FUNCTION control.operator_gate_offers(uuid) RENAME TO operator_gate_offers_publication_v1;
CREATE FUNCTION control.operator_gate_offers(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; j control.dot_recovery_jobs%ROWTYPE; s control.recovery_states%ROWTYPE; d record; item jsonb; offers jsonb; b jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run;
 IF NOT FOUND OR NOT control.run_is_actionable(r.status,r.current_task_id,r.finished_at) THEN RETURN '[]';END IF;
 offers:=control.operator_gate_offers_publication_v1(p_run);
 -- Every offer binds current bounded authority and the specific subject generation.
 -- Exact prevalidated bounded scope can be released before the first claim.
 IF EXISTS(SELECT 1 FROM control.bounded_verification_plans WHERE run_id=p_run) AND NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run) AND NOT r.stop_requested AND NOT r.maintenance_requested THEN
 item:=jsonb_build_object('run_id',p_run,'task_id',r.current_task_id,'action','bounded-run-release','reason','prevalidated_bounded_run_authorization_required','run_revision',r.run_revision,'max_tasks',r.max_tasks,'controller_fingerprint',r.controller_fingerprint,'task_ids',(SELECT jsonb_agg(task_id ORDER BY ordinal) FROM control.bounded_verification_plans WHERE run_id=p_run),'frozen_plan_versions',(SELECT jsonb_agg(plan_fingerprint ORDER BY ordinal) FROM control.bounded_verification_plans WHERE run_id=p_run),'requested_authorization','Release exactly this existing prevalidated bounded task set for ordinary draft publication. Preserve task set, limits and every protected-path gate; no merge, deployment or hosted product migration.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END IF;

 IF r.stop_requested OR r.maintenance_requested THEN
 item:=jsonb_build_object('run_id',p_run,'task_id',r.current_task_id,'action','maintenance-hold-release','reason',CASE WHEN r.stop_requested THEN 'stop_requested' ELSE 'maintenance_requested' END,'run_revision',r.run_revision,'stop_requested',r.stop_requested,'maintenance_requested',r.maintenance_requested,'max_tasks',r.max_tasks,'requested_authorization','Release this existing run hold; preserve task set, history and limits.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END IF;
 FOR j IN SELECT * FROM control.dot_recovery_jobs WHERE run_id=p_run AND task_id IS NOT DISTINCT FROM r.current_task_id AND status='human-gate' LOOP
 IF j.evidence->>'gate_kind'='incident-investigation-extension' OR j.evidence->>'reason'='incident_investigation_budget_exhausted' THEN
 item:=jsonb_build_object('run_id',p_run,'task_id',j.task_id,'incident_id',j.incident_id,'action','incident-investigation-extension','reason','incident_investigation_budget_exhausted','generation',(SELECT count(*) FROM control.dot_model_invocations WHERE incident_id=j.incident_id),'prior_extensions',(SELECT count(*) FROM control.operator_invocation_extensions WHERE incident_id=j.incident_id),'max_tasks',r.max_tasks,'requested_authorization','Authorize one additional incident investigation invocation, bounded to 45 minutes, on this exact incident.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 ELSIF j.evidence->>'gate_kind'='incident-acknowledgement' AND j.evidence->>'safe_resolution'='reconcile-same-run' THEN
 item:=jsonb_build_object('run_id',p_run,'task_id',j.task_id,'incident_id',j.incident_id,'action','incident-human-resolution','reason',j.evidence->>'reason','generation',j.updated_at,'max_tasks',r.max_tasks,'requested_authorization','Acknowledge the documented incident and reconcile the same bounded run. No new source or authority.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END IF;
 END LOOP;
 SELECT * INTO s FROM control.recovery_states WHERE current_task_id=r.current_task_id AND status='active' ORDER BY updated_at DESC LIMIT 1;
 IF s.error_code='retry_budget_exhausted' THEN
 b:=control.product_retry_accounting(r.current_task_id);
 IF (b->>'consumed')::integer >= (control.resolved_retry_policy(r.current_task_id)->>'max_attempts')::integer AND b#>>'{classifications,-1,charged}'='true' THEN
 item:=jsonb_build_object('run_id',p_run,'task_id',r.current_task_id,'action','product-retry-extension','reason',s.error_code,'generation',b,'prior_extensions',(SELECT count(*) FROM control.operator_invocation_extensions WHERE run_id=p_run AND task_id=r.current_task_id AND kind='product-retry-extension'),'max_tasks',r.max_tasks,'requested_authorization','Authorize exactly one additional reviewed product repair for this task, using the review model profile.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END IF;
 END IF;
 IF s.next_action='wait-operator' AND s.condition->>'gate_kind'='external-evidence' AND EXISTS(
 SELECT 1 FROM control.verification_results c JOIN control.verification_runs v USING(verification_run_id) JOIN control.executions e ON e.execution_id=v.execution_id
 WHERE e.task_id=r.current_task_id AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id) AND c.status='pass' AND c.trusted_receipt IS NOT NULL AND c.verification_id=(s.condition->>'verification_id')::bigint) THEN
 item:=jsonb_build_object('run_id',p_run,'task_id',r.current_task_id,'action','external-evidence-acknowledgement','reason',s.error_code,'verification_id',s.condition->>'verification_id','generation',s.version,'max_tasks',r.max_tasks,'requested_authorization','Acknowledge this already collected trusted external evidence; do not create or waive evidence.');
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END IF;
 -- A decision release may refer to the next pending admitted task on an idle run.
 IF r.current_task_id IS NULL THEN
 FOR d IN SELECT decision.*,t.task_id FROM control.dot_task_scope_authorities a JOIN control.tasks t USING(task_id) JOIN control.task_decisions link USING(task_id) JOIN control.decisions decision ON decision.suit_slug=link.suit_slug AND decision.decision_id=link.decision_id WHERE a.run_id=p_run AND link.blocking AND t.status IN('planned','ready') AND decision.status IN('open','blocked','pending') AND decision.metadata->>'gate_kind' IN('owner_start','bounded_scope_release') LOOP
 item:=jsonb_build_object('run_id',p_run,'task_id',d.task_id,'action','registered-decision','reason','decision:'||d.decision_id,'decision_id',d.decision_id,'decision_suit',d.suit_slug,'decision_updated_at',d.updated_at,'run_revision',r.run_revision,'max_tasks',r.max_tasks,'scope_fingerprint',control.dot_scope_fingerprint(d.task_id),'requested_authorization',d.decision_text);
 offers:=offers||jsonb_build_array(item||jsonb_build_object('gate_fingerprint',md5(item::text)));
 END LOOP;
 END IF;
 RETURN (SELECT coalesce(jsonb_agg(value||jsonb_build_object('gate_id',(value->>'gate_fingerprint')::uuid,'bs22_path','/form/building-suit-operator-gates')),'[]') FROM jsonb_array_elements(offers) WHERE NOT EXISTS(SELECT 1 FROM control.operator_authority_events ev WHERE ev.run_id=p_run AND ev.gate_fingerprint=value->>'gate_fingerprint' AND ev.response IN('approve','reject') AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events rev WHERE rev.run_id=ev.run_id AND rev.gate_fingerprint=ev.gate_fingerprint AND rev.response='revoke')));
END $$;
ALTER FUNCTION control.resolve_operator_task_gate(uuid,text,text,text) RENAME TO resolve_operator_task_gate_unattributed_v1;
REVOKE ALL ON FUNCTION control.resolve_operator_task_gate_unattributed_v1(uuid,text,text,text),control.operator_gate_offers_publication_v1(uuid) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_operator;
-- Anonymous legacy transport is retired even for callers retaining its name.
CREATE FUNCTION control.resolve_operator_task_gate(uuid,text,text,text) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'authenticated_operator_capability_required';END $$;
REVOKE ALL ON FUNCTION control.resolve_operator_task_gate(uuid,text,text,text) FROM PUBLIC,anon,authenticated,bs_control_app;
CREATE FUNCTION control.resolve_authenticated_operator_gate(p_actor uuid,p_run uuid,p_gate text,p_response text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; ev control.operator_authority_events%ROWTYPE; prior control.operator_authority_events%ROWTYPE; legacy jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.operator_actors WHERE actor_id=p_actor AND enabled) THEN RAISE EXCEPTION 'registered_authenticated_operator_required';END IF;
 IF p_response NOT IN('approve','reject','revoke') THEN RAISE EXCEPTION 'typed_operator_response_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('operator-gate:'||p_run::text,0));
 PERFORM 1 FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO prior FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response=p_response;
 IF FOUND THEN RETURN to_jsonb(prior)||jsonb_build_object('ok',true,'replayed',true,'resolution_id',prior.event_id);END IF;
 IF p_response='revoke' THEN
 SELECT offer INTO item FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve';
 IF item IS NULL THEN RAISE EXCEPTION 'approved_operator_gate_required';END IF;
 IF EXISTS(SELECT 1 FROM control.operator_invocation_extensions WHERE event_id=(SELECT event_id FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve') AND consumed_at IS NOT NULL) THEN RAISE EXCEPTION 'consumed_authority_cannot_be_revoked';END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate) THEN RAISE EXCEPTION 'operator_gate_already_decided';END IF;
 SELECT value INTO item FROM jsonb_array_elements(control.operator_gate_offers(p_run)) WHERE value->>'gate_fingerprint'=p_gate;
 IF item IS NULL THEN RAISE EXCEPTION 'operator_gate_stale_or_unsupported';END IF;
 END IF;
 INSERT INTO control.operator_authority_events(run_id,task_id,gate_fingerprint,action,response,actor_id,offer) VALUES(p_run,item->>'task_id',p_gate,item->>'action',p_response,p_actor,item) RETURNING * INTO ev;
 IF p_response='approve' THEN
 CASE item->>'action'
 WHEN 'ordinary-publication','protected-publication' THEN
 legacy:=control.resolve_operator_task_gate_unattributed_v1(p_run,p_gate,p_response,'Authenticated local n8n actor '||p_actor||'; authority event '||ev.event_id);
 WHEN 'bounded-run-release' THEN
 PERFORM control.authorize_ordinary_bounded_run(p_run,item->'task_ids','Authenticated local n8n actor '||p_actor||'; exact bounded authority event '||ev.event_id);
 WHEN 'registered-decision' THEN
 UPDATE control.decisions SET status='approved',decided_at=now(),updated_at=now(),source='human-operator-gate',metadata=metadata||jsonb_build_object('authenticated_operator_event',ev.event_id) WHERE suit_slug=item->>'decision_suit' AND decision_id=item->>'decision_id' AND updated_at=(item->>'decision_updated_at')::timestamptz;
 IF NOT FOUND THEN RAISE EXCEPTION 'operator_decision_generation_changed';END IF;
 WHEN 'maintenance-hold-release' THEN
 UPDATE control.workflow_runs SET stop_requested=false,maintenance_requested=false,run_revision=run_revision+1 WHERE run_id=p_run;
 WHEN 'incident-investigation-extension','product-retry-extension' THEN
 INSERT INTO control.operator_invocation_extensions(event_id,run_id,task_id,incident_id,kind) VALUES(ev.event_id,p_run,item->>'task_id',nullif(item->>'incident_id','')::uuid,item->>'action');
 IF item->>'action'='incident-investigation-extension' THEN UPDATE control.dot_recovery_jobs SET status='queued',next_check_at=now(),updated_at=now() WHERE incident_id=(item->>'incident_id')::uuid; UPDATE control.dot_incidents SET status='open' WHERE incident_id=(item->>'incident_id')::uuid;
 ELSE UPDATE control.recovery_states SET error_code='operator_one_product_retry_granted',next_action='retry',recoverable=true,version=version+1 WHERE current_task_id=item->>'task_id' AND status='active';END IF;
 WHEN 'incident-human-resolution' THEN
 UPDATE control.dot_recovery_jobs SET status='queued',next_check_at=now(),updated_at=now() WHERE incident_id=(item->>'incident_id')::uuid;
 WHEN 'external-evidence-acknowledgement' THEN
 UPDATE control.recovery_states SET status='resolved',resolved_at=now(),version=version+1 WHERE current_task_id=item->>'task_id' AND status='active' AND condition->>'verification_id'=item->>'verification_id';
 ELSE RAISE EXCEPTION 'unsupported_operator_action';
 END CASE;
 ELSIF p_response='revoke' THEN
 UPDATE control.operator_invocation_extensions SET revoked_at=now() WHERE event_id=(SELECT event_id FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve') AND consumed_at IS NULL;
 END IF;
 PERFORM pg_notify('bs_dot_wake',jsonb_build_object('run_id',p_run,'reason','operator_gate_'||p_response,'event_id',ev.event_id)::text);
 RETURN to_jsonb(ev)||jsonb_build_object('ok',true,'resolution_id',ev.event_id);
END $$;
REVOKE ALL ON FUNCTION control.resolve_authenticated_operator_gate(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_observer,bs_control_verifier;
GRANT EXECUTE ON FUNCTION control.resolve_authenticated_operator_gate(uuid,uuid,text,text) TO bs_control_operator;
REVOKE ALL ON FUNCTION control.operator_gate_offers(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.operator_gate_offers(uuid) TO bs_control_app,bs_control_observer,bs_control_operator;
CREATE OR REPLACE FUNCTION control.authorize_ordinary_bounded_run(p_run uuid,p_tasks jsonb,p_evidence text) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; task_name text; t control.tasks%ROWTYPE; frozen jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT jsonb_agg(task_id ORDER BY ordinal) INTO frozen FROM control.bounded_verification_plans WHERE run_id=p_run;
 IF r.run_id IS NULL OR r.status<>'running' OR r.stop_requested OR r.maintenance_requested OR r.admitted_repair_id IS NOT NULL OR coalesce(r.controller_fingerprint,'')='' OR btrim(coalesce(p_evidence,''))='' OR jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tasks)<1 OR jsonb_array_length(p_tasks)>r.max_tasks-r.completed_tasks OR (r.current_task_id IS NOT NULL AND NOT(p_tasks ? r.current_task_id)) OR (r.current_task_id IS NULL AND p_tasks IS DISTINCT FROM frozen) OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_tasks))<>jsonb_array_length(p_tasks) THEN RAISE EXCEPTION 'Exact existing native bounded-run authorization required';END IF;
 IF EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Revoked grant cannot be silently restored';END IF;
 INSERT INTO control.run_ordinary_publication_authorizations(run_id,project_id,workstream_slug,max_tasks,repair_id,controller_fingerprint,audit_evidence) VALUES(r.run_id,r.project_id,r.workstream_slug,r.max_tasks,NULL,r.controller_fingerprint,p_evidence) ON CONFLICT(run_id) DO NOTHING;
 FOR task_name IN SELECT value FROM jsonb_array_elements_text(p_tasks) LOOP
 SELECT * INTO t FROM control.tasks WHERE task_id=task_name;
 IF NOT FOUND OR t.project_id IS DISTINCT FROM r.project_id OR t.workstream_slug IS DISTINCT FROM r.workstream_slug OR t.status IN('complete','cancelled') THEN RAISE EXCEPTION 'Task outside authorized run scope';END IF;
 INSERT INTO control.dot_task_scope_authorities(run_id,task_id,required_paths,scope_fingerprint,audit_evidence) VALUES(r.run_id,t.task_id,'null',control.dot_scope_fingerprint(t.task_id),p_evidence) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(coalesce(r.current_task_id,p_tasks->>0),'bounded_run_ordinary_publication_authorized','human',jsonb_build_object('run_id',r.run_id,'tasks',p_tasks,'audit_evidence',p_evidence,'no_merge',true,'no_deployment',true));
 RETURN jsonb_build_object('authorized',true,'run_id',r.run_id,'tasks',p_tasks);
END $$;
-- Internal legacy publication transition uses its original snapshot; the new
-- authenticated event must not hide the offer during the same transaction.
DO $$BEGIN
 EXECUTE replace(pg_get_functiondef('control.resolve_operator_task_gate_unattributed_v1(uuid,text,text,text)'::regprocedure),'control.operator_gate_offers(p_run)','control.operator_gate_offers_publication_v1(p_run)');
 EXECUTE replace(pg_get_functiondef('control.current_run_publication_authority(text)'::regprocedure),$find$a.response='approve'$find$, $replacement$a.response='approve' AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events revoked WHERE revoked.run_id=a.run_id AND revoked.gate_fingerprint=a.gate_fingerprint AND revoked.response='revoke')$replacement$);
 EXECUTE replace(pg_get_functiondef('control.current_protected_publication_authority(text)'::regprocedure),$find$receipt.response='approve'$find$, $replacement$receipt.response='approve' AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events revoked WHERE revoked.run_id=receipt.run_id AND revoked.gate_fingerprint=receipt.gate_fingerprint AND revoked.response='revoke')$replacement$);
END $$;
COMMIT;
