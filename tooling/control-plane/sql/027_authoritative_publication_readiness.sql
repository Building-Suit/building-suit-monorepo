BEGIN;

CREATE TABLE IF NOT EXISTS control.publication_readiness_contracts (
  contract_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL UNIQUE REFERENCES control.tasks(task_id) ON DELETE CASCADE,
  contract_version integer NOT NULL DEFAULT 1 CHECK (contract_version = 1),
  task_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(task_paths) = 'array'),
  source_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_paths) = 'array'),
  workstream_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(workstream_paths) = 'array'),
  project_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(project_paths) = 'array'),
  required_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_paths) = 'array'),
  unresolved_scopes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(unresolved_scopes) = 'array'),
  requirement_evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(requirement_evidence) = 'object'),
  source text NOT NULL,
  contract_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control.publication_preexecution_authorizations (
  authorization_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL REFERENCES control.tasks(task_id) ON DELETE CASCADE,
  contract_id bigint NOT NULL REFERENCES control.publication_readiness_contracts(contract_id) ON DELETE RESTRICT,
  authorization_kind text NOT NULL CHECK (authorization_kind IN ('ordinary','protected')),
  authorized_paths jsonb NOT NULL CHECK (jsonb_typeof(authorized_paths) = 'array' AND jsonb_array_length(authorized_paths) > 0),
  audit_evidence text NOT NULL CHECK (length(btrim(audit_evidence)) >= 8),
  content_risk_validation jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content_risk_validation) = 'object'),
  idempotency_key text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source = 'human'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE OR REPLACE FUNCTION control.refresh_publication_readiness_contract(
  p_task_id text,
  p_source text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  task_row control.tasks%ROWTYPE;
  project_row control.projects%ROWTYPE;
  workstream_row control.workstreams%ROWTYPE;
  task_paths jsonb;
  source_paths jsonb;
  workstream_paths jsonb;
  project_paths jsonb;
  registered_paths jsonb;
  resolved_scopes jsonb;
  required_paths jsonb;
  unresolved_scopes jsonb;
  evidence jsonb;
  fingerprint text;
  contract_row control.publication_readiness_contracts%ROWTYPE;
BEGIN
  SELECT * INTO task_row FROM control.tasks WHERE task_id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %', p_task_id; END IF;
  SELECT * INTO project_row FROM control.projects WHERE project_id = task_row.project_id;
  SELECT * INTO workstream_row FROM control.workstreams
    WHERE project_id = task_row.project_id AND slug = task_row.workstream_slug;

  task_paths := CASE WHEN jsonb_typeof(task_row.metadata->'allowed_paths') = 'array'
    THEN task_row.metadata->'allowed_paths' ELSE '[]'::jsonb END;
  source_paths := CASE WHEN jsonb_typeof(task_row.metadata->'source_allowed_paths') = 'array'
    THEN task_row.metadata->'source_allowed_paths' ELSE '[]'::jsonb END;
  SELECT COALESCE(jsonb_agg(path ORDER BY path),'[]'::jsonb) INTO registered_paths
  FROM (
    SELECT DISTINCT value AS path FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(task_row.metadata->'publication_exact_paths')='array'
        THEN task_row.metadata->'publication_exact_paths' ELSE '[]'::jsonb END
    )
    UNION
    SELECT DISTINCT value FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(task_row.metadata->'publication_acceptance_paths')='array'
        THEN task_row.metadata->'publication_acceptance_paths' ELSE '[]'::jsonb END
    )
    UNION
    SELECT DISTINCT value FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(task_row.metadata->'publication_scaffold_paths')='array'
        THEN task_row.metadata->'publication_scaffold_paths' ELSE '[]'::jsonb END
    )
    UNION
    SELECT DISTINCT path.value
    FROM control.task_requirements link
    JOIN control.requirements requirement
      ON requirement.suit_slug=link.suit_slug AND requirement.requirement_id=link.requirement_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(requirement.metadata->'publication_exact_paths')='array'
        THEN requirement.metadata->'publication_exact_paths' ELSE '[]'::jsonb END
    ) path
    WHERE link.task_id=p_task_id AND requirement.status IN ('approved','implemented')
    UNION
    SELECT DISTINCT path.value
    FROM control.task_decisions link
    JOIN control.decisions decision
      ON decision.suit_slug=link.suit_slug AND decision.decision_id=link.decision_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(decision.metadata->'publication_exact_paths')='array'
        THEN decision.metadata->'publication_exact_paths' ELSE '[]'::jsonb END
    ) path
    WHERE link.task_id=p_task_id AND decision.status='approved'
  ) trusted_paths;
  resolved_scopes := CASE WHEN jsonb_typeof(task_row.metadata->'publication_resolved_scopes') = 'array'
    THEN task_row.metadata->'publication_resolved_scopes' ELSE '[]'::jsonb END;
  evidence := CASE WHEN jsonb_typeof(task_row.metadata->'publication_requirement_evidence') = 'object'
    THEN task_row.metadata->'publication_requirement_evidence' ELSE '{}'::jsonb END
    || jsonb_build_object(
      'registered_project_workstream', project_row.project_id IS NOT NULL AND workstream_row.slug IS NOT NULL,
      'trusted_contract_sources', jsonb_build_array(
        'approved-task-paths','source-allowed-paths','approved-requirement-metadata',
        'approved-decision-metadata','approved-acceptance-paths','registered-scaffold-paths',
        'operator-approved-task-data'
      ),
      'worker_output_used', false
    );
  workstream_paths := CASE WHEN workstream_row.slug IS NULL OR workstream_row.application_path IS NULL THEN '[]'::jsonb
    ELSE jsonb_build_array(rtrim(workstream_row.application_path, '/') || '/') END;
  project_paths := COALESCE(project_row.allowed_publication_paths, '[]'::jsonb);

  SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb) INTO required_paths
  FROM (
    SELECT DISTINCT value AS path FROM jsonb_array_elements_text(task_paths)
      WHERE value !~ '[*?\[\{]'
    UNION
    SELECT DISTINCT value AS path FROM jsonb_array_elements_text(source_paths)
      WHERE value !~ '[*?\[\{]'
    UNION
    SELECT DISTINCT value AS path FROM jsonb_array_elements_text(registered_paths)
  ) exact;

  SELECT COALESCE(jsonb_agg(path ORDER BY path), '[]'::jsonb) INTO unresolved_scopes
  FROM (
    SELECT DISTINCT value AS path
    FROM (
      SELECT value FROM jsonb_array_elements_text(task_paths)
      UNION ALL
      SELECT value FROM jsonb_array_elements_text(source_paths)
    ) declared
    WHERE value ~ '[*?\[\{]'
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(resolved_scopes) resolved WHERE resolved = value)
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(task_paths) approved
        WHERE approved !~ '[*?\[\{]'
          AND (
            regexp_replace(value, '[*?\[\{].*$', '') = rtrim(approved, '/')
            OR regexp_replace(value, '[*?\[\{].*$', '') LIKE rtrim(approved, '/') || '/%'
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(workstream_paths) workstream
        WHERE regexp_replace(value, '[*?\[\{].*$', '') LIKE rtrim(workstream, '/') || '%'
      )
  ) unresolved;
  IF project_row.project_id IS NULL OR workstream_row.slug IS NULL THEN
    unresolved_scopes := unresolved_scopes || jsonb_build_array('<missing-registered-project-workstream>');
  END IF;

  fingerprint := md5(jsonb_build_object(
    'task_id', p_task_id, 'task_paths', task_paths, 'source_paths', source_paths,
    'workstream_paths', workstream_paths, 'project_paths', project_paths,
    'required_paths', required_paths, 'unresolved_scopes', unresolved_scopes,
    'requirement_evidence', evidence
  )::text);

  INSERT INTO control.publication_readiness_contracts(
    task_id, task_paths, source_paths, workstream_paths, project_paths,
    required_paths, unresolved_scopes, requirement_evidence, source, contract_fingerprint
  ) VALUES (
    p_task_id, task_paths, source_paths, workstream_paths, project_paths,
    required_paths, unresolved_scopes, evidence, p_source, fingerprint
  )
  ON CONFLICT (task_id) DO UPDATE SET
    task_paths = EXCLUDED.task_paths,
    source_paths = EXCLUDED.source_paths,
    workstream_paths = EXCLUDED.workstream_paths,
    project_paths = EXCLUDED.project_paths,
    required_paths = EXCLUDED.required_paths,
    unresolved_scopes = EXCLUDED.unresolved_scopes,
    requirement_evidence = EXCLUDED.requirement_evidence,
    source = EXCLUDED.source,
    contract_fingerprint = EXCLUDED.contract_fingerprint,
    updated_at = now()
  WHERE control.publication_readiness_contracts.contract_fingerprint IS DISTINCT FROM EXCLUDED.contract_fingerprint
  RETURNING * INTO contract_row;

  IF contract_row.contract_id IS NULL THEN
    SELECT * INTO contract_row FROM control.publication_readiness_contracts WHERE task_id=p_task_id;
  END IF;

  RETURN to_jsonb(contract_row);
END;
$$;

CREATE OR REPLACE FUNCTION control.create_task_with_publication_contract(
  p_project_slug text,
  p_workstream_slug text,
  p_task_id text,
  p_sequence integer,
  p_priority integer,
  p_title text,
  p_description text,
  p_task_type text,
  p_risk_level text,
  p_model_profile text,
  p_acceptance_criteria jsonb,
  p_verification_plan jsonb,
  p_retry_policy_id text,
  p_metadata jsonb
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE created control.tasks%ROWTYPE;
DECLARE contract jsonb;
BEGIN
  INSERT INTO control.tasks(
    task_id,suit_slug,project_id,workstream_slug,sequence,priority,title,description,
    task_type,risk_level,model_profile,status,acceptance_criteria,verification_plan,
    retry_policy_id,metadata
  )
  SELECT p_task_id,workstream.suit_slug,project.project_id,workstream.slug,
    p_sequence,p_priority,p_title,p_description,p_task_type,p_risk_level,
    p_model_profile,'planned',p_acceptance_criteria,p_verification_plan,
    p_retry_policy_id,p_metadata
  FROM control.projects project
  JOIN control.workstreams workstream USING(project_id)
  WHERE project.slug=p_project_slug AND workstream.slug=p_workstream_slug
    AND project.active=true AND workstream.active=true
  RETURNING * INTO created;
  IF created.task_id IS NULL THEN RAISE EXCEPTION 'Active project/workstream not found'; END IF;
  contract:=control.refresh_publication_readiness_contract(created.task_id,'task-create');
  RETURN to_jsonb(created)||jsonb_build_object('publication_contract',contract);
END;
$$;

/*
 * Structural root files are an explicit registered Building Suit project
 * boundary. This does not authorize any task to change them; exact task-level
 * authorization is still required. Runtime output can never widen this list.
 */
WITH target AS (
  SELECT project_id, allowed_publication_paths AS old_paths
  FROM control.projects WHERE slug = 'building-suit' FOR UPDATE
), expanded AS (
  SELECT project_id, old_paths, COALESCE((
    SELECT jsonb_agg(path ORDER BY path)
    FROM (
      SELECT DISTINCT value AS path FROM jsonb_array_elements_text(old_paths)
      UNION SELECT unnest(ARRAY[
        'AGENTS.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json',
        'supabase/environments/'
      ])
    ) paths
  ), '[]'::jsonb) AS new_paths FROM target
), changed AS (
  UPDATE control.projects project SET allowed_publication_paths = expanded.new_paths
  FROM expanded WHERE project.project_id = expanded.project_id
    AND expanded.old_paths IS DISTINCT FROM expanded.new_paths
  RETURNING project.project_id, expanded.old_paths, expanded.new_paths
)
INSERT INTO control.audit_events(project_id,action,source,old_value,new_value,metadata)
SELECT project_id,'project_publication_boundary_amended','migration',
  jsonb_build_object('allowed_publication_paths',old_paths),
  jsonb_build_object('allowed_publication_paths',new_paths),
  '{"migration":"027_authoritative_publication_readiness","authority":"approved_structural_project_configuration","does_not_authorize_tasks":true}'::jsonb
FROM changed;

/*
 * SAS-M1-BOOT-001 is recovered only from its approved bootstrap contract and
 * registered workspace, environment-template and app-owned Supabase scaffold
 * contracts. No git diff or worker-produced path is consulted. Execution 245
 * and verification run 264 are intentionally untouched.
 */
UPDATE control.tasks AS task
SET metadata = task.metadata || jsonb_build_object(
  'publication_exact_paths', (SELECT jsonb_agg(path ORDER BY path) FROM (
    SELECT DISTINCT value AS path FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(task.metadata->'publication_exact_paths')='array'
        THEN task.metadata->'publication_exact_paths' ELSE '[]'::jsonb END
    )
    UNION
    SELECT value AS path FROM jsonb_array_elements_text('[
    "AGENTS.md",
    "apps/super-admin-suit/.env.example",
    "apps/super-admin-suit/.env.production.example",
    "apps/super-admin-suit/.env.staging.example",
    "apps/super-admin-suit/supabase/config.toml",
    "apps/super-admin-suit/supabase/migrations/.gitkeep",
    "apps/super-admin-suit/supabase/seed.sql",
    "apps/super-admin-suit/vercel.json",
    "docs/agent-workflows.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "supabase/environments/super-admin-suit/.env.production.example",
    "supabase/environments/super-admin-suit/.env.staging.example",
    "tooling/database/tests/environment.test.mjs",
    "tooling/git/dev-worktrees.mjs",
    "tooling/git/dev.mjs",
    "tooling/git/tests/dev-worktrees.test.mjs",
    "turbo.json"
  ]'::jsonb)
  ) paths),
  'publication_resolved_scopes', (SELECT jsonb_agg(path ORDER BY path) FROM (
    SELECT DISTINCT value AS path FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(task.metadata->'publication_resolved_scopes')='array'
        THEN task.metadata->'publication_resolved_scopes' ELSE '[]'::jsonb END
    )
    UNION SELECT unnest(ARRAY['apps/super-admin-suit/**','tooling/**'])
  ) paths),
  'publication_requirement_evidence', (
    CASE WHEN jsonb_typeof(task.metadata->'publication_requirement_evidence')='object'
      THEN task.metadata->'publication_requirement_evidence' ELSE '{}'::jsonb END
  ) || jsonb_build_object(
    'source', 'approved-task-requirements-and-registered-scaffold-contracts',
    'task_contract', 'SAS-M1-BOOT-001',
    'categories', jsonb_build_array(
      'environment-templates','app-owned-supabase-scaffold',
      'workspace-tooling-registration','structural-configuration'
    ),
    'worker_output_used', false,
    'preserve_execution_id', 245,
    'preserve_verification_run_id', 264
  )
)
WHERE task_id = 'SAS-M1-BOOT-001';

SELECT control.refresh_publication_readiness_contract(task.task_id, 'historical-backfill')
FROM control.tasks task
WHERE task.status IN ('planned','ready','in_progress','verification','passed','blocked','failed','complete');

INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value,metadata)
SELECT task.project_id, task.workstream_slug, task.task_id,
  'publication_readiness_backfilled','migration',to_jsonb(contract),
  jsonb_build_object(
    'migration','027_authoritative_publication_readiness',
    'trusted_sources_only',true,
    'worker_output_used',false,
    'historical_status_preserved',task.status,
    'execution_count_preserved',(SELECT count(*) FROM control.executions execution WHERE execution.task_id=task.task_id),
    'verification_run_count_preserved',(SELECT count(*) FROM control.verification_runs run JOIN control.executions execution USING(execution_id) WHERE execution.task_id=task.task_id)
  )
FROM control.tasks task
JOIN control.publication_readiness_contracts contract USING(task_id)
WHERE task.status IN ('planned','ready','in_progress','verification','passed','blocked','failed','complete')
  AND NOT EXISTS (
    SELECT 1 FROM control.audit_events audit
    WHERE audit.task_id=task.task_id AND audit.action='publication_readiness_backfilled'
      AND audit.metadata->>'migration'='027_authoritative_publication_readiness'
  );

INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value,metadata)
SELECT task.project_id,task.workstream_slug,task.task_id,
  'publication_readiness_scanned','migration',to_jsonb(contract),
  '{"migration":"027_authoritative_publication_readiness","before_implementation":true,"worker_output_used":false}'::jsonb
FROM control.tasks task
JOIN control.publication_readiness_contracts contract USING(task_id)
WHERE task.task_id='SS-SA-BRIDGE-001'
  AND NOT EXISTS (
    SELECT 1 FROM control.audit_events audit
    WHERE audit.task_id=task.task_id AND audit.action='publication_readiness_scanned'
      AND audit.metadata->>'migration'='027_authoritative_publication_readiness'
  );

CREATE OR REPLACE FUNCTION control.authorize_preexecution_publication_paths(
  p_task_id text,
  p_paths jsonb,
  p_idempotency_key text,
  p_audit_evidence text,
  p_source text DEFAULT 'human'
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE contract_row control.publication_readiness_contracts%ROWTYPE;
DECLARE task_row control.tasks%ROWTYPE;
DECLARE project_paths jsonb;
DECLARE normalized jsonb;
DECLARE authorization_row control.publication_preexecution_authorizations%ROWTYPE;
BEGIN
  IF p_source <> 'human' THEN RAISE EXCEPTION 'Pre-execution publication authorization requires a human source'; END IF;
  IF jsonb_typeof(p_paths)<>'array' OR length(btrim(p_audit_evidence))<8 THEN
    RAISE EXCEPTION 'Exact paths and audit evidence are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('publication-readiness:'||p_task_id,0));
  SELECT * INTO task_row FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF NOT FOUND OR task_row.status NOT IN ('planned','ready','in_progress','verification','passed','blocked','failed') THEN
    RAISE EXCEPTION 'Task is not eligible for pre-execution publication authorization';
  END IF;
  SELECT * INTO contract_row FROM control.publication_readiness_contracts WHERE task_id=p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task has no authoritative publication contract'; END IF;
  SELECT allowed_publication_paths INTO project_paths FROM control.projects WHERE project_id=task_row.project_id;
  SELECT COALESCE(jsonb_agg(value ORDER BY value),'[]'::jsonb) INTO normalized
  FROM (SELECT DISTINCT value FROM jsonb_array_elements_text(p_paths)) paths;
  SELECT * INTO authorization_row FROM control.publication_preexecution_authorizations
    WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF authorization_row.task_id<>p_task_id OR authorization_row.authorization_kind<>'ordinary'
      OR authorization_row.authorized_paths<>normalized OR authorization_row.audit_evidence<>p_audit_evidence THEN
      RAISE EXCEPTION 'Pre-execution authorization idempotency key conflicts with prior input';
    END IF;
    RETURN to_jsonb(authorization_row)||'{"idempotent":true}'::jsonb;
  END IF;
  IF jsonb_array_length(normalized)=0 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(normalized) path(value)
    WHERE value='' OR value LIKE '/%' OR value ~ '(^|/)\.\.(/|$)' OR value ~ '[*?\[\{]'
      OR value ~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)'
      OR NOT (contract_row.required_paths ? value)
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(project_paths) boundary(prefix)
        WHERE value=rtrim(prefix,'/') OR value LIKE rtrim(prefix,'/')||'/%')
  ) THEN RAISE EXCEPTION 'Ordinary authorization requires exact approved non-protected paths inside the project boundary'; END IF;
  INSERT INTO control.publication_preexecution_authorizations(
    task_id,contract_id,authorization_kind,authorized_paths,audit_evidence,idempotency_key,source
  ) VALUES (p_task_id,contract_row.contract_id,'ordinary',normalized,p_audit_evidence,p_idempotency_key,p_source)
  RETURNING * INTO authorization_row;
  INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value,metadata)
  VALUES(task_row.project_id,task_row.workstream_slug,p_task_id,'preexecution_publication_paths_authorized',p_source,
    to_jsonb(authorization_row),jsonb_build_object('contract_fingerprint',contract_row.contract_fingerprint));
  RETURN to_jsonb(authorization_row)||'{"idempotent":false}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION control.authorize_protected_publication_paths(
  p_task_id text,
  p_paths jsonb,
  p_idempotency_key text,
  p_audit_evidence text,
  p_content_risk_validation jsonb,
  p_source text DEFAULT 'human'
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE contract_row control.publication_readiness_contracts%ROWTYPE;
DECLARE task_row control.tasks%ROWTYPE;
DECLARE project_paths jsonb;
DECLARE normalized jsonb;
DECLARE authorization_row control.publication_preexecution_authorizations%ROWTYPE;
BEGIN
  IF p_source <> 'human' THEN RAISE EXCEPTION 'Protected publication authorization requires a human source'; END IF;
  IF jsonb_typeof(p_paths)<>'array' OR length(btrim(p_audit_evidence))<8 THEN
    RAISE EXCEPTION 'Exact paths and audit evidence are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('publication-readiness:'||p_task_id,0));
  SELECT * INTO task_row FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF NOT FOUND OR task_row.status NOT IN ('planned','ready','in_progress','verification','passed','blocked','failed') THEN
    RAISE EXCEPTION 'Task is not eligible for protected publication authorization';
  END IF;
  SELECT * INTO contract_row FROM control.publication_readiness_contracts WHERE task_id=p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task has no authoritative publication contract'; END IF;
  SELECT allowed_publication_paths INTO project_paths FROM control.projects WHERE project_id=task_row.project_id;
  SELECT COALESCE(jsonb_agg(value ORDER BY value),'[]'::jsonb) INTO normalized
  FROM (SELECT DISTINCT value FROM jsonb_array_elements_text(p_paths)) paths;
  SELECT * INTO authorization_row FROM control.publication_preexecution_authorizations
    WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF authorization_row.task_id<>p_task_id OR authorization_row.authorization_kind<>'protected'
      OR authorization_row.authorized_paths<>normalized OR authorization_row.audit_evidence<>p_audit_evidence
      OR authorization_row.content_risk_validation<>p_content_risk_validation THEN
      RAISE EXCEPTION 'Protected authorization idempotency key conflicts with prior input';
    END IF;
    RETURN to_jsonb(authorization_row)||'{"idempotent":true}'::jsonb;
  END IF;
  IF jsonb_typeof(p_content_risk_validation)<>'object' OR jsonb_array_length(normalized)=0 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(normalized) path(value)
    WHERE value='' OR value LIKE '/%' OR value LIKE '%/' OR value ~ '(^|/)\.\.(/|$)' OR value ~ '[*?\[\{]'
      OR value !~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)'
      OR NOT (contract_row.required_paths ? value)
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(project_paths) boundary(prefix)
        WHERE value=rtrim(prefix,'/') OR value LIKE rtrim(prefix,'/')||'/%')
      OR COALESCE(p_content_risk_validation->value->>'status','') <> 'passed'
      OR NOT (COALESCE(p_content_risk_validation->value->'checks','[]'::jsonb) @> jsonb_build_array(
        CASE
          WHEN value ~ '(^|/)\.env([./]|$)' THEN 'no-secrets-review'
          WHEN value ~ '(^|/)supabase/migrations/' THEN 'database-change-review'
          WHEN value ~ '(^|/)supabase/(config\.toml$|seed\.sql$)' THEN 'supabase-config-review'
          WHEN value ~* '(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/' THEN 'workflow-risk-review'
          WHEN value ~* '(^|/)(vercel|deploy)(/|\.|-)' THEN 'deployment-risk-review'
          ELSE 'protected-content-review'
        END
      ))
  ) THEN RAISE EXCEPTION 'Protected authorization requires exact approved paths, audit evidence, and passed content/risk validation'; END IF;
  INSERT INTO control.publication_preexecution_authorizations(
    task_id,contract_id,authorization_kind,authorized_paths,audit_evidence,content_risk_validation,idempotency_key,source
  ) VALUES (p_task_id,contract_row.contract_id,'protected',normalized,p_audit_evidence,p_content_risk_validation,p_idempotency_key,p_source)
  RETURNING * INTO authorization_row;
  INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,new_value,metadata)
  VALUES(task_row.project_id,task_row.workstream_slug,p_task_id,'protected_publication_paths_authorized',p_source,
    to_jsonb(authorization_row),jsonb_build_object('contract_fingerprint',contract_row.contract_fingerprint));
  RETURN to_jsonb(authorization_row)||'{"idempotent":false}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION control.generic_task_packet(p_task_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH packet AS (SELECT control.task_packet(p_task_id) AS value)
  SELECT packet.value || jsonb_build_object(
    'task', packet.value->'task' || jsonb_build_object(
      'verification_mode', control.resolved_verification_mode(t.task_id),
      'parent_satisfaction', t.metadata->'parent_satisfaction',
      'allowed_paths', COALESCE(t.metadata->'allowed_paths', '[]'::jsonb)
    ),
    'project', to_jsonb(p) - 'metadata',
    'workstream', to_jsonb(w) - 'metadata',
    'retry_policy', control.resolved_retry_policy(t.task_id),
    'preparation', t.metadata->'preparation',
    'publication_recovery', control.current_task_recovery_condition(t.task_id),
    'publication_boundaries', jsonb_build_object(
      'task_paths', COALESCE(t.metadata->'allowed_paths', '[]'::jsonb),
      'source_paths', COALESCE(t.metadata->'source_allowed_paths', '[]'::jsonb),
      'workstream_paths', CASE WHEN w.application_path IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(rtrim(w.application_path,'/')||'/') END,
      'project_paths', COALESCE(p.allowed_publication_paths, '[]'::jsonb)
    ),
    'publication_contract', COALESCE((SELECT to_jsonb(c) FROM control.publication_readiness_contracts c WHERE c.task_id=t.task_id),'null'::jsonb),
    'publication_authorizations', jsonb_build_object(
      'ordinary', COALESCE((
        SELECT jsonb_agg(value ORDER BY authorization_id)
        FROM (
          SELECT a.authorization_id,to_jsonb(a) AS value
          FROM control.publication_preexecution_authorizations a
          WHERE a.task_id=t.task_id AND a.authorization_kind='ordinary' AND a.revoked_at IS NULL
          UNION ALL
          SELECT 1000000000000+a.authorization_id,
            to_jsonb(a)||jsonb_build_object('authorization_kind','ordinary','authorized_paths',a.requested_paths,'legacy_cp_res_010',true)
          FROM control.publication_scope_authorizations a WHERE a.task_id=t.task_id
        ) ordinary_authorizations
      ),'[]'::jsonb),
      'protected', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.authorization_id) FROM control.publication_preexecution_authorizations a WHERE a.task_id=t.task_id AND a.authorization_kind='protected' AND a.revoked_at IS NULL),'[]'::jsonb)
    )
  )
  FROM control.tasks t CROSS JOIN packet
  LEFT JOIN control.projects p ON p.project_id=t.project_id
  LEFT JOIN control.workstreams w ON w.project_id=t.project_id AND w.slug=t.workstream_slug
  WHERE t.task_id=p_task_id;
$$;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bs_control_app') THEN
    GRANT SELECT,INSERT,UPDATE ON control.publication_readiness_contracts TO bs_control_app;
    GRANT SELECT,INSERT ON control.publication_preexecution_authorizations TO bs_control_app;
    GRANT USAGE,SELECT ON SEQUENCE control.publication_readiness_contracts_contract_id_seq TO bs_control_app;
    GRANT USAGE,SELECT ON SEQUENCE control.publication_preexecution_authorizations_authorization_id_seq TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.refresh_publication_readiness_contract(text,text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.create_task_with_publication_contract(text,text,text,integer,integer,text,text,text,text,text,jsonb,jsonb,text,jsonb) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.authorize_preexecution_publication_paths(text,jsonb,text,text,text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.authorize_protected_publication_paths(text,jsonb,text,text,jsonb,text) TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.generic_task_packet(text) TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
