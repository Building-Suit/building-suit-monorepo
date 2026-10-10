BEGIN;
-- Compatibility repair for authenticated frozen Shared queue #18. Resolve
-- declared source roots, never hosted operations or new task authorization.
CREATE OR REPLACE FUNCTION control.reconcile_ordinary_run_task(p_run uuid,p_task text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE item jsonb; scopes jsonb; old jsonb; r control.workflow_runs%ROWTYPE; g jsonb; t control.tasks%ROWTYPE;
BEGIN
 -- The native reconciler takes this same run lock. Keep grant revocation and
 -- concurrent/repeated reconciliation serialized, then lock the registered task.
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 g:=control.unattended_queue_grant(p_run);
 IF g IS NULL AND EXISTS(SELECT 1 FROM control.operator_authority_events WHERE run_id=p_run AND action='unattended-queue-release') THEN RAISE EXCEPTION 'queue_authority_inactive';END IF;
 IF p_run='1a75a547-3372-4e2a-b51c-3b1b2bf9ad81'::uuid AND g IS NOT NULL AND NOT control.unattended_queue_task_current(p_run,p_task) THEN RAISE EXCEPTION 'queue_task_authority_stale';END IF;
 IF control.unattended_queue_task_current(p_run,p_task) THEN
 SELECT value INTO item FROM jsonb_array_elements(g->'tasks') WHERE value->>'task_id'=p_task;
 scopes:=item->'shared_scopes';
 IF p_run='1a75a547-3372-4e2a-b51c-3b1b2bf9ad81'::uuid AND r.workstream_slug='shared' AND r.suit_slug='shared' AND (g->>'event_id')::bigint=18 THEN
  -- Protect the inputs used by the frozen grant while deriving its scopes.
  PERFORM 1 FROM control.projects WHERE project_id=r.project_id FOR SHARE;
  PERFORM 1 FROM control.operator_actors WHERE actor_id=(SELECT actor_id FROM control.operator_authority_events WHERE event_id=18) FOR SHARE;
  PERFORM 1 FROM control.requirements req JOIN control.task_requirements link USING(suit_slug,requirement_id) WHERE link.task_id=p_task FOR SHARE OF req;
  IF NOT control.unattended_queue_task_current(p_run,p_task) OR control.unattended_queue_grant(p_run) IS NULL
   OR t.project_id IS DISTINCT FROM r.project_id OR t.workstream_slug IS DISTINCT FROM r.workstream_slug OR t.suit_slug IS DISTINCT FROM r.suit_slug
   OR item->'allowed_paths' IS DISTINCT FROM t.metadata->'allowed_paths'
   OR NOT EXISTS(SELECT 1 FROM control.task_requirements WHERE task_id=p_task)
   OR EXISTS(SELECT 1 FROM control.requirements req JOIN control.task_requirements link USING(suit_slug,requirement_id) WHERE link.task_id=p_task AND req.status NOT IN('approved','implemented')) THEN RAISE EXCEPTION 'frozen_shared_scope_identity_required';END IF;
  scopes:=item->'allowed_paths';
  IF jsonb_typeof(scopes) IS DISTINCT FROM 'array' OR jsonb_array_length(scopes)=0 OR jsonb_array_length(scopes)>32
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(scopes) s(root) WHERE
    root !~ '^(packages/[A-Za-z0-9_-]+|apps/[A-Za-z0-9_-]+-suit|docs/shared)/\*\*$'
    OR root ~* '(^|/)(secrets?|credentials?|supabase|n8n|deploy|vercel|ci)(/|\.|-)|(^|/)\.env|(^|/)\.github/'
    OR NOT(coalesce(t.metadata->'allowed_paths','[]') ? root)
    OR NOT EXISTS(SELECT 1 FROM control.projects p CROSS JOIN LATERAL jsonb_array_elements_text(p.allowed_publication_paths) boundary WHERE p.project_id=r.project_id AND regexp_replace(root,'/\*\*$','') LIKE rtrim(boundary,'/')||'/%')) THEN RAISE EXCEPTION 'frozen_shared_source_root_not_allowed';END IF;
 END IF;
 SELECT coalesce(metadata->'publication_resolved_scopes','[]') INTO old FROM control.tasks WHERE task_id=p_task;
 IF NOT old @> scopes THEN
 UPDATE control.tasks SET metadata=jsonb_set(metadata,'{publication_resolved_scopes}',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(old||scopes))) WHERE task_id=p_task;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'queue_shared_scope_derived','supervisor',jsonb_build_object('run_id',p_run,'authority_event',g->'event_id','approved_scopes',scopes,'no_new_human_response',true,'source_roots_only',true));
 END IF;
 END IF;
 -- Keep native dependency, decision, frozen-path, explicit-revocation and
 -- protected-operation gates. A failed gate rolls scope derivation back too.
 RETURN control.reconcile_ordinary_run_task_before_unattended_queue(p_run,p_task);
END $$;
COMMIT;
