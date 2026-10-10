BEGIN;
-- Independent, additive capability on schema 105. No unattended publication,
-- protected SQL, provider configuration, retry budget or financial schema changes.
DO $$ BEGIN
 IF to_regprocedure('control.legacy_verification_materialization_needed(bigint,bigint)') IS NULL
 THEN RAISE EXCEPTION 'schema_105_required'; END IF;
END $$;
CREATE TABLE control.task_shared_package_authorizations (
 authorization_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id bigint NOT NULL UNIQUE REFERENCES control.operator_authority_events(event_id),
 run_id uuid NOT NULL REFERENCES control.workflow_runs(run_id),
 task_id text NOT NULL REFERENCES control.tasks(task_id),
 approved_scopes jsonb NOT NULL CHECK(jsonb_typeof(approved_scopes)='array'),
 previous_resolved_scopes jsonb NOT NULL CHECK(jsonb_typeof(previous_resolved_scopes)='array'),
 scope_fingerprint text NOT NULL,
 requirement_fingerprint text NOT NULL,
 project_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
CREATE UNIQUE INDEX one_active_task_shared_package_authority ON control.task_shared_package_authorizations(run_id,task_id) WHERE revoked_at IS NULL;
ALTER TABLE control.task_shared_package_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.task_shared_package_authorizations OWNER TO bs_control_migration_owner;
REVOKE ALL ON control.task_shared_package_authorizations FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_runtime_executor,bs_control_operator,bs_control_observer,bs_control_verifier;
GRANT SELECT ON control.task_shared_package_authorizations TO bs_control_executor,bs_control_observer,bs_control_verifier;
CREATE POLICY task_shared_scope_read ON control.task_shared_package_authorizations FOR SELECT TO bs_control_executor,bs_control_observer,bs_control_verifier USING(true);

CREATE FUNCTION control.task_scope_requirement_fingerprint(p_task text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT md5(coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.requirement_id,'status',r.status,'title',r.title,'summary',r.summary,'metadata',r.metadata) ORDER BY r.requirement_id)::text
 FROM control.requirements r JOIN control.task_requirements t USING(suit_slug,requirement_id) WHERE t.task_id=p_task),'[]'));
$$;
CREATE FUNCTION control.task_shared_package_offer(p_run uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; t control.tasks%ROWTYPE; c control.publication_readiness_contracts%ROWTYPE; scopes jsonb; item jsonb; frozen text;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run;
 IF r.status IS DISTINCT FROM 'running' OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks OR r.admitted_repair_id IS NOT NULL THEN RETURN NULL;END IF;
 IF r.current_task_id IS NOT NULL THEN SELECT * INTO t FROM control.tasks WHERE task_id=r.current_task_id;
 ELSE SELECT task.* INTO t FROM control.tasks task JOIN control.dot_task_scope_authorities f USING(task_id)
 WHERE f.run_id=p_run AND task.project_id=r.project_id AND task.workstream_slug=r.workstream_slug AND task.status IN('planned','ready')
 AND control.task_hard_dependencies_complete(task.task_id) AND control.task_blocking_decisions_clear(task.task_id)
 ORDER BY task.priority,task.sequence,task.created_at LIMIT 1;END IF;
 IF t.task_id IS NULL OR t.status IN('complete','cancelled') THEN RETURN NULL;END IF;
 SELECT scope_fingerprint INTO frozen FROM control.dot_task_scope_authorities WHERE run_id=p_run AND task_id=t.task_id;
 IF frozen IS DISTINCT FROM control.dot_scope_fingerprint(t.task_id) OR NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g
 WHERE g.run_id=p_run AND g.revoked_at IS NULL AND g.max_tasks=r.max_tasks AND g.project_id=r.project_id AND g.workstream_slug=r.workstream_slug AND g.controller_fingerprint=r.controller_fingerprint) THEN RETURN NULL;END IF;
 SELECT * INTO c FROM control.publication_readiness_contracts WHERE task_id=t.task_id;
 IF NOT coalesce(c.valid,false) OR c.input_generation IS DISTINCT FROM (SELECT input_generation FROM control.task_admission_generations WHERE task_id=t.task_id)
 OR EXISTS(SELECT 1 FROM control.task_shared_package_authorizations a WHERE a.run_id=p_run AND a.task_id=t.task_id AND a.revoked_at IS NULL) THEN RETURN NULL;END IF;
 SELECT jsonb_agg(value ORDER BY value) INTO scopes FROM jsonb_array_elements_text(c.unresolved_scopes);
 -- Resolved task metadata is not authority for a replacement run. A historical
 -- task grant requires a fresh owner response bound to that new run identity.
 IF scopes IS NULL THEN SELECT approved_scopes INTO scopes FROM control.task_shared_package_authorizations WHERE task_id=t.task_id ORDER BY authorization_id DESC LIMIT 1;END IF;
 IF scopes IS NULL OR jsonb_array_length(scopes)=0 OR jsonb_array_length(scopes)>32 THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(scopes) s(path) WHERE path !~ '^packages/[A-Za-z0-9_-]+/\*\*$'
 OR path ~* '(^|/)(secrets?|credentials?|supabase|n8n|deploy|vercel)(/|\.|-)'
 OR NOT(coalesce(t.metadata->'allowed_paths','[]') ? path)
 OR NOT EXISTS(SELECT 1 FROM control.projects p CROSS JOIN LATERAL jsonb_array_elements_text(p.allowed_publication_paths) boundary
 WHERE p.project_id=t.project_id AND regexp_replace(path,'/\*\*$','') LIKE rtrim(boundary,'/')||'/%')) THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM control.task_requirements WHERE task_id=t.task_id)
 OR EXISTS(SELECT 1 FROM control.task_requirements link JOIN control.requirements req USING(suit_slug,requirement_id) WHERE link.task_id=t.task_id AND req.status NOT IN('approved','implemented')) THEN RETURN NULL;END IF;
 item:=jsonb_build_object('run_id',p_run,'task_id',t.task_id,'action','task-shared-package-scope','reason','approved_task_shared_package_owner_authorization_required',
 'approved_scopes',scopes,'scope_fingerprint',frozen,'requirement_fingerprint',control.task_scope_requirement_fingerprint(t.task_id),
 'approved_requirement_ids',(SELECT jsonb_agg(requirement_id ORDER BY requirement_id) FROM control.task_requirements WHERE task_id=t.task_id),
 'project_fingerprint',(SELECT md5(allowed_publication_paths::text) FROM control.projects WHERE project_id=t.project_id),
 'contract_id',c.contract_id,'input_generation',c.input_generation,'contract_fingerprint',c.contract_fingerprint,'run_revision',r.run_revision,'max_tasks',r.max_tasks,
 'prior_authorizations',(SELECT count(*) FROM control.task_shared_package_authorizations WHERE run_id=p_run AND task_id=t.task_id),
 'authority_scope','task-only','implementation_authorized',true,'publication_mode','verified-ordinary-draft-only',
 'protected_paths_authorized',false,'merge_authorized',false,'deployment_authorized',false,'hosted_database_changes_authorized',false,
 'requested_authorization','Authorize exactly '||scopes::text||' for '||t.task_id||' under its already approved requirements, for implementation and ordinary Draft PR publication after trusted verification PASS. Task-bound, auditable and revocable before publication starts. No protected files, merge, deployment, hosted SQL, secrets/provider changes or scope expansion.');
 RETURN item||jsonb_build_object('gate_fingerprint',md5(item::text),'gate_id',md5(item::text)::uuid,'bs22_path','/form/building-suit-operator-gates');
END $$;

ALTER FUNCTION control.operator_gate_offers(uuid) RENAME TO operator_gate_offers_before_task_shared_scope;
CREATE FUNCTION control.operator_gate_offers(p_run uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT control.operator_gate_offers_before_task_shared_scope(p_run)||CASE WHEN item IS NULL OR EXISTS(SELECT 1 FROM control.operator_authority_events ev WHERE ev.run_id=p_run AND ev.gate_fingerprint=item->>'gate_fingerprint') THEN '[]'::jsonb ELSE jsonb_build_array(item) END
 FROM (SELECT control.task_shared_package_offer(p_run) item) candidate;
$$;

ALTER FUNCTION control.resolve_authenticated_operator_gate(uuid,uuid,text,text) RENAME TO resolve_authenticated_operator_gate_before_task_shared_scope;
CREATE FUNCTION control.resolve_authenticated_operator_gate(p_actor uuid,p_run uuid,p_gate text,p_response text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; prior control.operator_authority_events%ROWTYPE; ev control.operator_authority_events%ROWTYPE; a control.task_shared_package_authorizations%ROWTYPE; t control.tasks%ROWTYPE; r control.workflow_runs%ROWTYPE; old_scopes jsonb;
BEGIN
 -- Existing authenticated BS-23 operator capability and registered actor are the
 -- owner trust boundary. Worker metadata, email and model output never confer it.
 IF NOT EXISTS(SELECT 1 FROM control.operator_actors WHERE actor_id=p_actor AND enabled) THEN RAISE EXCEPTION 'registered_authenticated_operator_required';END IF;
 IF p_response NOT IN('approve','reject','revoke') THEN RAISE EXCEPTION 'typed_operator_response_required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('operator-gate:'||p_run::text,0));
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO prior FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response=p_response;
 IF FOUND AND prior.action='task-shared-package-scope' THEN RETURN to_jsonb(prior)||jsonb_build_object('ok',true,'replayed',true,'resolution_id',prior.event_id);END IF;
 IF p_response='revoke' THEN
 SELECT offer INTO item FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve';
 ELSE SELECT value INTO item FROM jsonb_array_elements(control.operator_gate_offers(p_run)) WHERE value->>'gate_fingerprint'=p_gate;END IF;
 IF item->>'action' IS DISTINCT FROM 'task-shared-package-scope' THEN RETURN control.resolve_authenticated_operator_gate_before_task_shared_scope(p_actor,p_run,p_gate,p_response);END IF;
 SELECT * INTO t FROM control.tasks WHERE task_id=item->>'task_id' FOR UPDATE;
 IF p_response='revoke' THEN
 SELECT * INTO a FROM control.task_shared_package_authorizations WHERE run_id=p_run AND event_id=(SELECT event_id FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve') FOR UPDATE;
 IF a.authorization_id IS NULL OR a.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'active_task_scope_authority_required';END IF;
 IF EXISTS(SELECT 1 FROM control.runtime_operations WHERE task_id=t.task_id AND action='task-publish' AND status<>'consumed') THEN RAISE EXCEPTION 'publication_operation_in_flight_scope_revocation_requires_reconciliation';END IF;
 IF EXISTS(SELECT 1 FROM control.pull_requests WHERE task_id=t.task_id) OR EXISTS(SELECT 1 FROM control.task_events WHERE task_id=t.task_id AND event_type='publication_completed' AND created_at>=a.created_at) THEN RAISE EXCEPTION 'consumed_publication_authority_cannot_be_revoked';END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate) THEN RAISE EXCEPTION 'operator_gate_already_decided';END IF;
 IF control.task_shared_package_offer(p_run)->>'gate_fingerprint' IS DISTINCT FROM p_gate THEN RAISE EXCEPTION 'task_scope_offer_generation_changed';END IF;
 END IF;
 INSERT INTO control.operator_authority_events(run_id,task_id,gate_fingerprint,action,response,actor_id,offer)
 VALUES(p_run,t.task_id,p_gate,'task-shared-package-scope',p_response,p_actor,item) RETURNING * INTO ev;
 IF p_response='approve' THEN
 old_scopes:=coalesce(t.metadata->'publication_resolved_scopes','[]');
 INSERT INTO control.task_shared_package_authorizations(event_id,run_id,task_id,approved_scopes,previous_resolved_scopes,scope_fingerprint,requirement_fingerprint,project_fingerprint)
 VALUES(ev.event_id,p_run,t.task_id,item->'approved_scopes',old_scopes,item->>'scope_fingerprint',item->>'requirement_fingerprint',item->>'project_fingerprint') RETURNING * INTO a;
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(old_scopes||a.approved_scopes))) WHERE task_id=t.task_id;
 PERFORM control.refresh_publication_readiness_contract(t.task_id,'authenticated-task-shared-package-scope');
 PERFORM control.reconcile_ordinary_run_task(p_run,t.task_id);
 ELSIF p_response='revoke' THEN
 UPDATE control.task_shared_package_authorizations SET revoked_at=now() WHERE authorization_id=a.authorization_id;
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(coalesce(metadata->'publication_resolved_scopes','[]')) value
 WHERE NOT(a.approved_scopes @> jsonb_build_array(value)) OR a.previous_resolved_scopes @> jsonb_build_array(value)),'[]'::jsonb)) WHERE task_id=t.task_id;
 PERFORM control.refresh_publication_readiness_contract(t.task_id,'authenticated-task-shared-package-scope-revoked');
 END IF;
 INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value,metadata)
 VALUES(t.project_id,t.workstream_slug,t.task_id,'task_shared_package_scope_'||p_response,'human',to_jsonb(ev),jsonb_build_object('task_bound',true,'same_run',true,'scope_expanded',false,'max_tasks_preserved',r.max_tasks));
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(t.task_id,'task_shared_package_scope_'||p_response,'human',to_jsonb(ev));
 -- Task-event triggers already coalesce the durable wake using the shared
 -- state-event sequence. Authority-event IDs belong to a different sequence.
 RETURN to_jsonb(ev)||jsonb_build_object('ok',true,'resolution_id',ev.event_id,'authorization_id',a.authorization_id);
END $$;

CREATE FUNCTION control.task_shared_package_authority_current(p_task text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT NOT EXISTS(SELECT 1 FROM control.task_shared_package_authorizations WHERE task_id=p_task) OR EXISTS(
 SELECT 1 FROM control.task_shared_package_authorizations a JOIN control.operator_authority_events ev USING(event_id) JOIN control.operator_actors actor USING(actor_id) JOIN control.workflow_runs r ON r.run_id=a.run_id
 WHERE r.status='running' AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
 AND a.task_id=p_task AND a.revoked_at IS NULL AND actor.enabled
 AND a.scope_fingerprint=control.dot_scope_fingerprint(p_task) AND a.requirement_fingerprint=control.task_scope_requirement_fingerprint(p_task)
 AND a.project_fingerprint=(SELECT md5(p.allowed_publication_paths::text) FROM control.projects p JOIN control.tasks t USING(project_id) WHERE t.task_id=p_task));
$$;
ALTER FUNCTION control.task_publication_authority_is_current(text) RENAME TO task_publication_authority_before_shared_scope;
CREATE FUNCTION control.task_publication_authority_is_current(p_task text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT control.task_publication_authority_before_shared_scope(p_task) AND control.task_shared_package_authority_current(p_task);
$$;

ALTER FUNCTION control.current_run_publication_authority(text) RENAME TO current_run_publication_authority_before_task_shared_scope;
CREATE FUNCTION control.current_run_publication_authority(p_task text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE original jsonb; a control.task_shared_package_authorizations%ROWTYPE;
BEGIN
 original:=control.current_run_publication_authority_before_task_shared_scope(p_task);
 IF NOT EXISTS(SELECT 1 FROM control.task_shared_package_authorizations WHERE task_id=p_task AND run_id=(original->>'run_id')::uuid) THEN RETURN original;END IF;
 SELECT grant_row.* INTO a FROM control.task_shared_package_authorizations grant_row JOIN control.operator_authority_events ev USING(event_id) JOIN control.operator_actors actor USING(actor_id)
 WHERE grant_row.task_id=p_task AND grant_row.run_id=(original->>'run_id')::uuid AND grant_row.revoked_at IS NULL AND actor.enabled
 AND grant_row.scope_fingerprint=control.dot_scope_fingerprint(p_task) AND grant_row.requirement_fingerprint=control.task_scope_requirement_fingerprint(p_task)
 AND grant_row.project_fingerprint=(SELECT md5(p.allowed_publication_paths::text) FROM control.projects p JOIN control.tasks t USING(project_id) WHERE t.task_id=p_task);
 IF a.authorization_id IS NULL THEN RETURN original||jsonb_build_object('authorized',false,'reason','task_shared_package_scope_revoked_or_stale');END IF;
 RETURN original||jsonb_build_object('shared_package_authorization_id',a.authorization_id,'shared_package_authority_event',a.event_id);
END $$;

DO $$ DECLARE f regprocedure;BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='control' AND p.proname IN(
 'task_scope_requirement_fingerprint','task_shared_package_authority_current','task_publication_authority_before_shared_scope','task_publication_authority_is_current','task_shared_package_offer','operator_gate_offers_before_task_shared_scope','operator_gate_offers',
 'resolve_authenticated_operator_gate_before_task_shared_scope','resolve_authenticated_operator_gate',
 'current_run_publication_authority_before_task_shared_scope','current_run_publication_authority') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',f);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_runtime_executor,bs_control_operator,bs_control_observer,bs_control_verifier',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION control.operator_gate_offers(uuid) TO bs_control_executor,bs_control_observer,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.resolve_authenticated_operator_gate(uuid,uuid,text,text) TO bs_control_operator;
GRANT EXECUTE ON FUNCTION control.current_run_publication_authority(text) TO bs_control_executor;
GRANT EXECUTE ON FUNCTION control.task_publication_authority_is_current(text) TO bs_control_executor,bs_control_observer,bs_control_verifier;
COMMIT;
