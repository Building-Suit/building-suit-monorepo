BEGIN;
CREATE OR REPLACE FUNCTION control.reconcile_strict_verification_binding(p_task text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE t control.tasks%ROWTYPE; e control.executions%ROWTYPE; checks jsonb; old_config jsonb; cmd jsonb;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 SELECT * INTO e FROM control.executions WHERE task_id=p_task ORDER BY attempt DESC,execution_id DESC LIMIT 1;
 IF t.status<>'failed' OR e.status NOT IN('succeeded','failed') OR p_proof->>'execution_id' IS DISTINCT FROM e.execution_id::text
 OR p_proof->>'command' IS DISTINCT FROM 'node tooling/checks/suit-template-boundaries.mjs --require-strict'
 OR p_proof->>'runner_path' IS DISTINCT FROM 'tooling/checks/suit-template-boundaries.mjs'
 OR coalesce(p_proof->>'runner_sha256','') !~ '^[0-9a-f]{64}$'
 OR NOT(t.verification_plan ? (p_proof->>'command'))
 OR p_proof->>'verification_run_id' IS DISTINCT FROM (SELECT max(verification_run_id)::text FROM control.verification_runs WHERE execution_id=e.execution_id)
 THEN RAISE EXCEPTION 'Exact existing strict executable proof required';END IF;
 SELECT jsonb_agg(to_jsonb(v)) INTO checks FROM control.verification_results v
 WHERE verification_run_id=(p_proof->>'verification_run_id')::bigint AND coalesce(v.metadata->>'required','true')<>'false' AND status IN('fail','not_run','unavailable');
 IF checks IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE c->>'status'<>'not_run' OR c#>>'{metadata,selection_reason}' IS DISTINCT FROM 'missing_strict_boundary_runner') THEN RAISE EXCEPTION 'Demonstrated product failure cannot be reclassified';END IF;
 SELECT verification_config INTO old_config FROM control.workstreams WHERE project_id=t.project_id AND slug=t.workstream_slug;
 cmd:='{"name":"strict-suit-template-boundaries","program":"node","args":["tooling/checks/suit-template-boundaries.mjs","--require-strict"],"required":true}';
 IF old_config#>>'{legacy_plan_mappings,node tooling/checks/suit-template-boundaries.mjs --require-strict,kind}' IS DISTINCT FROM 'command' OR NOT(old_config->'commands' @> jsonb_build_array(cmd)) THEN
 UPDATE control.workstreams SET verification_config=jsonb_set(jsonb_set(coalesce(verification_config,'{}'),'{commands}',
 (SELECT coalesce(jsonb_agg(c),'[]') FROM jsonb_array_elements(coalesce(verification_config->'commands','[]')) c WHERE c->>'name'<>'strict-suit-template-boundaries')||jsonb_build_array(cmd)),
 '{legacy_plan_mappings}',coalesce(verification_config->'legacy_plan_mappings','{}')||jsonb_build_object(p_proof->>'command',jsonb_build_object('version',2,'kind','command','command','strict-suit-template-boundaries')))
 WHERE project_id=t.project_id AND slug=t.workstream_slug;
 END IF;
 INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
 VALUES(e.execution_id,'CONFIGURATION',control.retry_evidence_fingerprint(e.execution_id)||':strict-binding:'||(p_proof->>'runner_sha256'),'dot',jsonb_build_object('binding_reconciled',true,'proof',p_proof,'checks',checks)) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM control.task_events WHERE task_id=p_task AND event_type='executable_verification_binding_reconciled' AND payload->>'execution_id'=e.execution_id::text) THEN
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'executable_verification_binding_reconciled','dot',jsonb_build_object('execution_id',e.execution_id,'proof',p_proof,'prior_verification_config',old_config,'history_preserved',true));END IF;
 RETURN jsonb_build_object('reconciled',true,'execution_id',e.execution_id,'classification','CONFIGURATION');
END $$;
REVOKE ALL ON FUNCTION control.reconcile_strict_verification_binding(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reconcile_strict_verification_binding(text,jsonb) TO bs_control_app;

-- Native bounded runs also support an operator-owned ordinary draft grant.
ALTER TABLE control.run_ordinary_publication_authorizations ALTER COLUMN repair_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION control.authorize_ordinary_bounded_run(p_run uuid,p_tasks jsonb,p_evidence text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; task_name text; t control.tasks%ROWTYPE;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF r.run_id IS NULL OR r.status<>'running' OR r.stop_requested OR r.maintenance_requested
 OR r.admitted_repair_id IS NOT NULL OR btrim(coalesce(p_evidence,''))='' OR jsonb_typeof(p_tasks)<>'array'
 OR jsonb_array_length(p_tasks)>r.max_tasks-r.completed_tasks OR NOT(p_tasks ? r.current_task_id)
 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_tasks))<>jsonb_array_length(p_tasks)
 THEN RAISE EXCEPTION 'Exact existing native bounded-run authorization required';END IF;
 IF EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Revoked grant cannot be silently restored';END IF;
 INSERT INTO control.run_ordinary_publication_authorizations(run_id,project_id,workstream_slug,max_tasks,repair_id,controller_fingerprint,audit_evidence)
 VALUES(r.run_id,r.project_id,r.workstream_slug,r.max_tasks,NULL,r.controller_fingerprint,p_evidence) ON CONFLICT(run_id) DO NOTHING;
 FOR task_name IN SELECT value FROM jsonb_array_elements_text(p_tasks) LOOP
 SELECT * INTO t FROM control.tasks WHERE task_id=task_name;
 IF t.project_id IS DISTINCT FROM r.project_id OR t.workstream_slug IS DISTINCT FROM r.workstream_slug OR t.status IN('complete','cancelled') THEN RAISE EXCEPTION 'Task outside authorized run scope';END IF;
 INSERT INTO control.dot_task_scope_authorities(run_id,task_id,required_paths,scope_fingerprint,audit_evidence)
 VALUES(r.run_id,t.task_id,'null',control.dot_scope_fingerprint(t.task_id),p_evidence) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(r.current_task_id,'bounded_run_ordinary_publication_authorized','human',jsonb_build_object('run_id',r.run_id,'tasks',p_tasks,'audit_evidence',p_evidence,'no_merge',true,'no_deployment',true));
 RETURN jsonb_build_object('authorized',true,'run_id',r.run_id,'tasks',p_tasks);
END $$;
REVOKE ALL ON FUNCTION control.authorize_ordinary_bounded_run(uuid,jsonb,text) FROM PUBLIC,bs_control_app;

CREATE OR REPLACE FUNCTION control.reconcile_ordinary_run_task(p_run uuid,p_task text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; g control.run_ordinary_publication_authorizations%ROWTYPE; f control.dot_task_scope_authorities%ROWTYPE; c control.publication_readiness_contracts%ROWTYPE;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO g FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run;
 IF g.run_id IS NULL THEN RETURN jsonb_build_object('authorized',false);END IF;
 IF r.status<>'running' OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks
 OR g.revoked_at IS NOT NULL OR g.project_id<>r.project_id OR g.workstream_slug<>r.workstream_slug OR g.max_tasks<>r.max_tasks
 OR g.repair_id IS DISTINCT FROM r.admitted_repair_id OR g.controller_fingerprint<>r.controller_fingerprint THEN RAISE EXCEPTION 'Bounded run gate';END IF;
 IF r.admitted_repair_id IS NOT NULL THEN RAISE EXCEPTION 'Native run required';END IF;
 IF p_task IS NULL THEN RETURN jsonb_build_object('authorized',true,'waiting_for_acquisition',true);END IF;
 SELECT * INTO f FROM control.dot_task_scope_authorities WHERE run_id=r.run_id AND task_id=p_task;
 IF f.task_id IS NULL OR f.scope_fingerprint IS DISTINCT FROM control.dot_scope_fingerprint(p_task) THEN RAISE EXCEPTION 'Frozen task scope changed or unauthorized task';END IF;
 PERFORM control.refresh_publication_readiness_contract(p_task,'dot-run-scoped-ordinary-reconciliation');
 SELECT * INTO c FROM control.publication_readiness_contracts WHERE task_id=p_task;
 IF NOT c.valid OR jsonb_array_length(c.unresolved_scopes)>0 OR NOT control.task_hard_dependencies_complete(p_task) OR NOT control.task_blocking_decisions_clear(p_task)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(c.required_paths) p WHERE p ~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)')
 THEN RAISE EXCEPTION 'Ordinary publication contract or protected-path gate';END IF;
 IF f.required_paths<>'null'::jsonb AND f.required_paths IS DISTINCT FROM c.required_paths THEN RAISE EXCEPTION 'Frozen required paths changed';END IF;
 IF f.required_paths='null'::jsonb THEN UPDATE control.dot_task_scope_authorities SET required_paths=c.required_paths WHERE run_id=p_run AND task_id=p_task;END IF;
 IF EXISTS(SELECT 1 FROM control.publication_preexecution_authorizations WHERE idempotency_key='dot:'||p_run||':'||p_task||':'||c.input_generation AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Explicit task authority revoked';END IF;
 IF jsonb_array_length(c.required_paths)>0 THEN
 INSERT INTO control.publication_preexecution_authorizations(task_id,contract_id,authorization_kind,authorized_paths,audit_evidence,content_risk_validation,idempotency_key,source)
 VALUES(p_task,c.contract_id,'ordinary',c.required_paths,g.audit_evidence,jsonb_build_object('dot_frozen_scope',true),'dot:'||p_run||':'||p_task||':'||c.input_generation,'human') ON CONFLICT(idempotency_key) DO NOTHING;
 END IF;
 INSERT INTO control.run_task_publication_authorities(run_id,task_id,input_generation,contract_fingerprint,verification_fingerprint)
 VALUES(p_run,p_task,c.input_generation,c.contract_fingerprint,control.verification_contract_fingerprint(p_task))
 ON CONFLICT(run_id,task_id) DO UPDATE SET input_generation=excluded.input_generation,contract_fingerprint=excluded.contract_fingerprint,verification_fingerprint=excluded.verification_fingerprint;
 RETURN jsonb_build_object('authorized',true,'run_id',p_run,'task_id',p_task);
END $$;
REVOKE ALL ON FUNCTION control.reconcile_ordinary_run_task(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reconcile_ordinary_run_task(uuid,text) TO bs_control_app;
CREATE OR REPLACE FUNCTION control.current_run_publication_authority(p_task_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
 SELECT COALESCE((
 SELECT jsonb_build_object('authorized',true,'mode','ordinary-draft','run_id',r.run_id,
  'task_id',a.task_id,'input_generation',a.input_generation,'contract_fingerprint',a.contract_fingerprint,
  'verification_fingerprint',a.verification_fingerprint,'audit_evidence',g.audit_evidence)
 FROM control.workflow_runs r
 JOIN control.run_ordinary_publication_authorizations g USING(run_id)
 JOIN control.run_task_publication_authorities a USING(run_id)
 JOIN control.tasks t ON t.task_id=a.task_id
 JOIN control.workstreams w ON w.project_id=t.project_id AND w.slug=t.workstream_slug
 LEFT JOIN control.batch_task_admissions b ON b.run_id=r.run_id AND b.task_id=a.task_id AND b.repair_id=r.admitted_repair_id
 JOIN control.publication_readiness_contracts c ON c.task_id=a.task_id
 JOIN control.task_admission_generations i ON i.task_id=a.task_id
 WHERE r.current_task_id=p_task_id AND a.task_id=p_task_id AND r.status='running'
  AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
  AND g.revoked_at IS NULL AND g.project_id=r.project_id AND g.workstream_slug=r.workstream_slug
  AND t.project_id=r.project_id AND t.workstream_slug=r.workstream_slug
  AND g.max_tasks=r.max_tasks AND g.repair_id IS NOT DISTINCT FROM r.admitted_repair_id
  AND g.controller_fingerprint=r.controller_fingerprint
  AND w.publication_config->>'merge_authorized'='false'
  AND w.publication_config->>'deployment_authorized'='false'
  AND w.publication_config->>'hosted_database_changes_authorized'='false'
  AND COALESCE(t.metadata->>'merge_authorization_required','false')='false'
  AND COALESCE(t.metadata->>'deployment_authorization_required','false')='false'
  AND c.valid AND c.input_generation=i.input_generation
  AND a.input_generation=i.input_generation
  AND a.contract_fingerprint=c.contract_fingerprint
  AND a.verification_fingerprint=control.verification_contract_fingerprint(a.task_id)
  AND ((r.admitted_repair_id IS NOT NULL AND b.status='claimed' AND b.input_generation=i.input_generation AND b.contract_fingerprint=c.contract_fingerprint AND b.verification_fingerprint=a.verification_fingerprint) OR (r.admitted_repair_id IS NULL AND EXISTS(SELECT 1 FROM control.dot_task_scope_authorities frozen WHERE frozen.run_id=r.run_id AND frozen.task_id=p_task_id AND frozen.scope_fingerprint=control.dot_scope_fingerprint(p_task_id) AND frozen.required_paths=c.required_paths)))
  AND control.task_publication_authority_is_current(a.task_id)
  AND control.task_hard_dependencies_complete(a.task_id) AND control.task_blocking_decisions_clear(a.task_id)
 LIMIT 1),' {"authorized":false}'::jsonb);
$function$;

CREATE OR REPLACE FUNCTION control.reconcile_ordinary_run_publication(p_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; target text; result jsonb; outcomes jsonb:='[]';
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run;
 IF NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run AND revoked_at IS NULL) THEN RETURN jsonb_build_object('authorized',false);END IF;
 IF r.admitted_repair_id IS NOT NULL THEN RETURN control.refresh_dot_admission(p_run);END IF;
 FOR target IN SELECT f.task_id FROM control.dot_task_scope_authorities f JOIN control.tasks t USING(task_id) WHERE f.run_id=p_run AND t.status NOT IN('complete','cancelled') ORDER BY t.sequence LOOP
 BEGIN
 result:=control.reconcile_ordinary_run_task(p_run,target);outcomes:=outcomes||jsonb_build_array(result);
 EXCEPTION WHEN OTHERS THEN
 IF target=r.current_task_id THEN RAISE;END IF;
 outcomes:=outcomes||jsonb_build_array(jsonb_build_object('task_id',target,'gated',true,'reason',SQLERRM));
 END;
 END LOOP;
 RETURN jsonb_build_object('authorized',true,'run_id',p_run,'tasks',outcomes);
END $$;
REVOKE ALL ON FUNCTION control.reconcile_ordinary_run_publication(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reconcile_ordinary_run_publication(uuid) TO bs_control_app;
-- Keep native dependency/readiness selection, but reject acquisition outside the
-- operator's frozen task set before that transaction can reserve any execution.
ALTER FUNCTION control.acquire_workflow_run_task(uuid,text,text,text,text) RENAME TO acquire_workflow_run_task_scope_v1;
CREATE OR REPLACE FUNCTION control.acquire_workflow_run_task(p_run uuid,p_protocol text,p_controller text,p_lease text,p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE result jsonb;
BEGIN
 result:=control.acquire_workflow_run_task_scope_v1(p_run,p_protocol,p_controller,p_lease,p_source);
 IF result->>'task_id' IS NOT NULL AND EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run)
 AND NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE run_id=p_run AND task_id=result->>'task_id') THEN RAISE EXCEPTION 'Acquisition outside frozen bounded-run scope';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION control.acquire_workflow_run_task_scope_v1(uuid,text,text,text,text) FROM PUBLIC,bs_control_app;
REVOKE ALL ON FUNCTION control.acquire_workflow_run_task(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.acquire_workflow_run_task(uuid,text,text,text,text) TO bs_control_app;
COMMIT;
