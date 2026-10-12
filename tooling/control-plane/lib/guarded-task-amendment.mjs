import { applyReviewedChanges, fingerprint } from './upcoming-task-reconciliation.mjs'

export const AMENDMENT_ID = 'shared-shop-post-atomic-readiness-20261012-6ef2939'
const preservedTables = [
  'workflow_runs', 'executions', 'workflow_run_task_credits', 'task_events',
  'task_dependencies', 'task_decisions', 'task_requirements', 'decisions', 'requirements',
  'retry_policies', 'projects', 'suits', 'operator_gate_resolutions', 'operator_authority_events',
  'task_shared_package_authorizations', 'publication_preexecution_authorizations',
  'publication_scope_authorizations', 'run_ordinary_publication_authorizations',
  'run_task_publication_authorities', 'bounded_verification_plans', 'batch_task_admissions',
  'product_attempt_classifications', 'runtime_activation_events', 'runtime_operations', 'recovery_states',
]

export function buildAmendmentPayload({ snapshot, configuration, reconciliation, schemaGuard }) {
  if (snapshot.tasks.length !== 24 || reconciliation.changes.length !== 24 || configuration.workstreams.length !== 2) throw new Error('exact_reviewed_set_required')
  if (!reconciliation.plans.ready || schemaGuard.active_targets !== 0) throw new Error('reviewed_plan_and_idle_target_streams_required')
  const after = applyReviewedChanges(snapshot.tasks, reconciliation.changes)
  for (const [i, task] of after.entries()) {
    const old = snapshot.tasks[i]
    const editableMetadata = new Set(['allowed_paths', 'source_allowed_paths', 'readiness_reconciliation'])
    for (const key of new Set([...Object.keys(old.metadata), ...Object.keys(task.metadata)])) {
      if (!editableMetadata.has(key) && fingerprint(old.metadata[key]) !== fingerprint(task.metadata[key])) throw new Error(`protected_metadata_change:${key}`)
    }
    for (const path of old.metadata.allowed_paths ?? []) if (!task.metadata.allowed_paths.includes(path)) throw new Error('existing_scope_removed')
    for (const path of old.metadata.source_allowed_paths ?? []) if (!task.metadata.source_allowed_paths.includes(path)) throw new Error('existing_source_scope_removed')
  }
  const workstreams = configuration.workstreams.map(before => {
    const change = reconciliation.workstreams.find(w => w.slug === before.slug)
    if (!change || change.before_fingerprint !== fingerprint(before)) throw new Error('concurrent_registry_change')
    for (const command of before.verification_config.commands) {
      if (fingerprint(change.verification_config.commands.find(c => c.name === command.name)) !== fingerprint(command)) throw new Error('existing_command_changed')
    }
    return { before, after: { ...before, verification_config: change.verification_config } }
  })
  const ids = snapshot.tasks.map(t => t.task_id)
  const payload = {
    amendment_id: AMENDMENT_ID,
    source_commit: '6ef2939a1afbf7e1a37f5979d69655fd5e0060f0',
    source_thread_id: '01a0f297-ab87-77d0-9c51-15b3b6d300fa',
    tasks: snapshot.tasks.map((before, i) => ({ task_id: before.task_id, before, after: after[i] })),
    workstreams,
    dependencies: snapshot.dependencies.filter(d => ids.includes(d.task_id)),
    generations: schemaGuard.generations,
    functions: schemaGuard.functions,
    preserved_tables: preservedTables,
  }
  return { ...payload, payload_fingerprint: fingerprint(payload) }
}

export function guardedAmendmentSQL(payload, { commit = false } = {}) {
  const serialized = JSON.stringify(payload)
  if ((serialized.includes('$reviewed_payload$') || serialized.includes('$amendment$'))) throw new Error('sql_payload_delimiter_conflict')
  return `BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $amendment$
DECLARE
 p jsonb := $reviewed_payload$${serialized}$reviewed_payload$::jsonb;
 ids text[]; item jsonb; t control.tasks%ROWTYPE; w control.workstreams%ROWTYPE;
 old_value jsonb; new_value jsonb; table_name text; digest text;
 preserved jsonb := '{}'; audit_ids jsonb := '[]'; contracts jsonb := '{}';
 dependencies jsonb; expected_dependencies jsonb; generations jsonb;
 functions jsonb; task_invariants text; registry_invariants text;
 receipt jsonb; before_count integer := 0; after_count integer := 0;
 changed_tasks integer := 0; changed_registries integer := 0; audit_id bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p->>'amendment_id',0));
 SELECT array_agg(value->>'task_id' ORDER BY value->>'task_id') INTO ids FROM jsonb_array_elements(p->'tasks');
 IF cardinality(ids)<>24 OR (SELECT count(DISTINCT x) FROM unnest(ids) x)<>24
 OR jsonb_array_length(p->'workstreams')<>2 THEN RAISE EXCEPTION 'exact_reviewed_set_required';END IF;
 SELECT jsonb_object_agg(proname,md5(pg_get_functiondef(proc.oid))) INTO functions
 FROM pg_proc proc JOIN pg_namespace ns ON ns.oid=proc.pronamespace
 WHERE ns.nspname='control' AND p->'functions' ? proname;
 IF functions IS DISTINCT FROM p->'functions' THEN RAISE EXCEPTION 'control_schema_changed_reinspect_required';END IF;

 -- Lock only the two target registry rows and the exact unstarted task rows.
 -- The SAS run, execution and recovery rows are only fingerprinted, never locked or edited.
 PERFORM 1 FROM control.workstreams ws JOIN jsonb_array_elements(p->'workstreams') expected
 ON ws.project_id=(expected#>>'{before,project_id}')::uuid AND ws.slug=expected#>>'{before,slug}'
 ORDER BY ws.slug FOR UPDATE OF ws NOWAIT;
 PERFORM 1 FROM control.tasks task WHERE task.task_id=ANY(ids) ORDER BY task.task_id FOR UPDATE NOWAIT;
 IF (SELECT count(*) FROM control.tasks WHERE task_id=ANY(ids))<>24
 OR EXISTS(SELECT 1 FROM control.tasks WHERE task_id=ANY(ids) AND (status<>'planned' OR suit_slug NOT IN('shared','shop-suit')))
 OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=ANY(ids))
 OR EXISTS(SELECT 1 FROM control.bounded_verification_plans WHERE task_id=ANY(ids))
 OR EXISTS(SELECT 1 FROM control.batch_task_admissions WHERE task_id=ANY(ids))
 OR EXISTS(SELECT 1 FROM control.publication_preexecution_authorizations WHERE task_id=ANY(ids))
 OR EXISTS(SELECT 1 FROM control.run_task_publication_authorities WHERE task_id=ANY(ids))
 OR EXISTS(SELECT 1 FROM control.task_shared_package_authorizations WHERE task_id=ANY(ids))
 OR EXISTS(SELECT 1 FROM control.workflow_runs WHERE suit_slug IN('shared','shop-suit') AND finished_at IS NULL)
 OR EXISTS(SELECT 1 FROM control.tasks WHERE suit_slug IN('shared','shop-suit') AND status NOT IN('complete','cancelled') AND NOT task_id=ANY(ids))
 THEN RAISE EXCEPTION 'still_planned_unstarted_unclaimed_exact_set_required';END IF;

 SELECT coalesce(jsonb_agg(to_jsonb(dep) ORDER BY task_id,depends_on_task_id,dependency_type),'[]') INTO dependencies
 FROM control.task_dependencies dep WHERE task_id=ANY(ids);
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'task_id',value->>'depends_on_task_id',value->>'dependency_type'),'[]') INTO expected_dependencies
 FROM jsonb_array_elements(p->'dependencies');
 IF dependencies IS DISTINCT FROM expected_dependencies THEN RAISE EXCEPTION 'concurrent_dependency_change';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'tasks') LOOP
  SELECT * INTO t FROM control.tasks WHERE task_id=item->>'task_id';
  IF to_jsonb(t)=item->'before' THEN before_count:=before_count+1;
  ELSIF to_jsonb(t)-'updated_at'=(item->'after')-'updated_at' THEN after_count:=after_count+1;
  ELSE RAISE EXCEPTION 'concurrent_task_change:%',t.task_id;END IF;
 END LOOP;
 SELECT a.new_value INTO receipt FROM control.audit_events a WHERE a.action='upcoming_task_readiness_applied'
 AND a.metadata->>'amendment_id'=p->>'amendment_id' ORDER BY a.audit_id DESC LIMIT 1;
 IF after_count=24 THEN
  IF receipt IS NULL OR receipt->>'payload_fingerprint' IS DISTINCT FROM p->>'payload_fingerprint'
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'workstreams') expected LEFT JOIN control.workstreams ws
   ON ws.project_id=(expected#>>'{after,project_id}')::uuid AND ws.slug=expected#>>'{after,slug}'
   WHERE to_jsonb(ws)-'updated_at' IS DISTINCT FROM (expected->'after')-'updated_at')
  OR EXISTS(SELECT 1 FROM control.tasks WHERE task_id=ANY(ids) AND (NOT control.publication_contract_is_current(task_id) OR control.task_publication_authority_is_current(task_id) IS TRUE))
  THEN RAISE EXCEPTION 'amendment_replay_drift';END IF;
  RAISE NOTICE 'Already applied exact reviewed metadata amendment; no mutation';
  RETURN;
 END IF;
 IF before_count<>24 OR after_count<>0 OR receipt IS NOT NULL THEN RAISE EXCEPTION 'partial_or_conflicting_amendment';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'workstreams') LOOP
  SELECT * INTO w FROM control.workstreams WHERE project_id=(item#>>'{before,project_id}')::uuid AND slug=item#>>'{before,slug}';
  IF to_jsonb(w) IS DISTINCT FROM item->'before' THEN RAISE EXCEPTION 'concurrent_registry_change:%',w.slug;END IF;
 END LOOP;
 SELECT jsonb_agg(to_jsonb(g) ORDER BY task_id) INTO generations FROM control.task_admission_generations g WHERE task_id=ANY(ids);
 IF generations IS DISTINCT FROM p->'generations' THEN RAISE EXCEPTION 'concurrent_admission_generation_change';END IF;
 FOR table_name IN SELECT jsonb_array_elements_text(p->'preserved_tables') LOOP
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text)::text,''[]'')) FROM control.%I r',table_name) INTO digest;
  preserved:=preserved||jsonb_build_object(table_name,digest);
 END LOOP;
 SELECT md5(jsonb_agg(CASE WHEN task_id=ANY(ids) THEN to_jsonb(task)-ARRAY['description','priority','verification_plan','metadata','updated_at'] ELSE to_jsonb(task) END ORDER BY task_id)::text)
 INTO task_invariants FROM control.tasks task;
 SELECT md5(jsonb_agg(CASE WHEN slug IN('shared','shop-suit') AND project_id=(p#>>'{workstreams,0,before,project_id}')::uuid THEN to_jsonb(ws)-ARRAY['verification_config','updated_at'] ELSE to_jsonb(ws) END ORDER BY project_id,slug)::text)
 INTO registry_invariants FROM control.workstreams ws;
 SELECT jsonb_object_agg(task_id,to_jsonb(c)) INTO contracts FROM control.publication_readiness_contracts c WHERE task_id=ANY(ids);

 -- Registry bindings first, then Shared task packets, then dependent Shop packets.
 FOR item IN SELECT value FROM jsonb_array_elements(p->'workstreams') ORDER BY (value#>>'{before,slug}'='shared') DESC LOOP
  UPDATE control.workstreams AS target_ws SET verification_config=item#>'{after,verification_config}'
  WHERE project_id=(item#>>'{before,project_id}')::uuid AND slug=item#>>'{before,slug}' AND to_jsonb(target_ws)=item->'before'
  RETURNING to_jsonb(target_ws) INTO new_value;
  IF new_value IS NULL THEN RAISE EXCEPTION 'exact_old_registry_predicate_failed';END IF;
  INSERT INTO control.audit_events AS event(project_id,workstream_slug,action,source,actor,old_value,new_value,reason,metadata)
  VALUES((item#>>'{before,project_id}')::uuid,item#>>'{before,slug}','upcoming_verification_registry_amended','codex-authorized-task-repair',session_user,item->'before',new_value,'Post-atomic task binding repair; existing commands and policy preserved',jsonb_build_object('amendment_id',p->>'amendment_id','payload_fingerprint',p->>'payload_fingerprint','source_commit',p->>'source_commit','source_thread_id',p->>'source_thread_id'))
  RETURNING event.audit_id INTO audit_id;
  audit_ids:=audit_ids||to_jsonb(audit_id);changed_registries:=changed_registries+1;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'tasks') ORDER BY (value#>>'{before,suit_slug}'='shared') DESC,value->>'task_id' LOOP
  UPDATE control.tasks AS target_task SET description=item#>>'{after,description}',priority=(item#>>'{after,priority}')::integer,
   verification_plan=item#>'{after,verification_plan}',metadata=item#>'{after,metadata}'
  WHERE task_id=item->>'task_id' AND status='planned' AND to_jsonb(target_task)=item->'before'
  RETURNING to_jsonb(target_task) INTO new_value;
  IF new_value IS NULL THEN RAISE EXCEPTION 'exact_old_task_predicate_failed:%',item->>'task_id';END IF;
  IF new_value-'updated_at' IS DISTINCT FROM (item->'after')-'updated_at' THEN RAISE EXCEPTION 'task_after_value_mismatch';END IF;
  INSERT INTO control.audit_events AS event(project_id,workstream_slug,task_id,action,source,actor,old_value,new_value,reason,metadata)
  VALUES((item#>>'{before,project_id}')::uuid,item#>>'{before,workstream_slug}',item->>'task_id','upcoming_task_packet_amended','codex-authorized-task-repair',session_user,item->'before',new_value,'Post-atomic planned task repair; no run, retry, dependency or approval changes',jsonb_build_object('amendment_id',p->>'amendment_id','payload_fingerprint',p->>'payload_fingerprint','source_commit',p->>'source_commit','source_thread_id',p->>'source_thread_id'))
  RETURNING event.audit_id INTO audit_id;
  audit_ids:=audit_ids||to_jsonb(audit_id);changed_tasks:=changed_tasks+1;
 END LOOP;
 IF changed_tasks<>24 OR changed_registries<>2 THEN RAISE EXCEPTION 'exact_change_counts_required';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'tasks') ORDER BY value->>'task_id' LOOP
  new_value:=control.refresh_publication_readiness_contract(item->>'task_id','codex-authorized-post-atomic-readiness');
  IF NOT control.publication_contract_is_current(item->>'task_id') THEN RAISE EXCEPTION 'refreshed_contract_not_current';END IF;
  IF control.task_publication_authority_is_current(item->>'task_id') IS TRUE THEN RAISE EXCEPTION 'metadata_must_not_grant_publication_authority';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(contracts#>ARRAY[item->>'task_id','unresolved_scopes'],'[]')) old_scope
   WHERE NOT(new_value->'unresolved_scopes' ? old_scope)) THEN RAISE EXCEPTION 'existing_unresolved_scope_removed';END IF;
 END LOOP;
 FOR table_name IN SELECT jsonb_array_elements_text(p->'preserved_tables') LOOP
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text)::text,''[]'')) FROM control.%I r',table_name) INTO digest;
  IF digest IS DISTINCT FROM preserved->>table_name THEN RAISE EXCEPTION 'protected_control_history_changed:%',table_name;END IF;
 END LOOP;
 IF task_invariants IS DISTINCT FROM (SELECT md5(jsonb_agg(CASE WHEN task_id=ANY(ids) THEN to_jsonb(task)-ARRAY['description','priority','verification_plan','metadata','updated_at'] ELSE to_jsonb(task) END ORDER BY task_id)::text) FROM control.tasks task)
 OR registry_invariants IS DISTINCT FROM (SELECT md5(jsonb_agg(CASE WHEN slug IN('shared','shop-suit') AND project_id=(p#>>'{workstreams,0,before,project_id}')::uuid THEN to_jsonb(ws)-ARRAY['verification_config','updated_at'] ELSE to_jsonb(ws) END ORDER BY project_id,slug)::text) FROM control.workstreams ws)
 THEN RAISE EXCEPTION 'non_target_or_lifecycle_policy_changed';END IF;
 INSERT INTO control.audit_events AS event(project_id,action,source,actor,old_value,new_value,reason,metadata)
 VALUES((p#>>'{workstreams,0,before,project_id}')::uuid,'upcoming_task_readiness_applied','codex-authorized-task-repair',session_user,
  jsonb_build_object('preserved_checksums',preserved,'task_invariants',task_invariants,'registry_invariants',registry_invariants),
  jsonb_build_object('payload_fingerprint',p->>'payload_fingerprint','tasks_amended',changed_tasks,'registries_amended',changed_registries,'contracts_refreshed',24,'audit_ids',audit_ids,'runs_created',0,'attempts_consumed',0,'authority_grants',0,'dependencies_changed',0,'protected_history_preserved',true),
  'Explicitly authorized metadata-only repair; same-status planned rows; admission invalidation and contract refresh through existing triggers/functions; no migration/security/runtime/run operation',
  jsonb_build_object('amendment_id',p->>'amendment_id','payload_fingerprint',p->>'payload_fingerprint','source_commit',p->>'source_commit','source_thread_id',p->>'source_thread_id'));
END $amendment$;
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`
}
