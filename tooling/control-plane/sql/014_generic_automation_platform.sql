BEGIN;

-- Generic control-plane registry. Existing Suit rows remain the compatibility
-- source for historical requirements/decisions while workstreams provide the
-- project-independent dispatch boundary.
CREATE TABLE IF NOT EXISTS control.retry_policies (
  policy_id text PRIMARY KEY CHECK (policy_id ~ '^[a-z][a-z0-9-]*$'),
  display_name text NOT NULL,
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 20),
  attempt_profiles jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(attempt_profiles) = 'array'),
  CHECK (jsonb_array_length(attempt_profiles) = max_attempts),
  CHECK (NOT jsonb_path_exists(
    attempt_profiles,
    '$[*] ? (@ != "fast" && @ != "standard" && @ != "deep" && @ != "review")'
  ))
);

CREATE TABLE IF NOT EXISTS control.projects (
  project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  display_name text NOT NULL,
  repository_path text NOT NULL,
  github_repository text NOT NULL,
  integration_branch text NOT NULL DEFAULT 'stg',
  production_branch text NOT NULL DEFAULT 'main',
  local_repository_root text NOT NULL,
  worktree_root text NOT NULL,
  application_paths jsonb NOT NULL DEFAULT '{}'::jsonb,
  stack_strategy jsonb NOT NULL DEFAULT '{"type":"stacked-pr"}'::jsonb,
  allowed_publication_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  local_database_strategy jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  codex_enabled boolean NOT NULL DEFAULT true,
  default_model_profile text NOT NULL DEFAULT 'standard'
    CHECK (default_model_profile IN ('no_ai','fast','standard','deep','review')),
  retry_policy_id text REFERENCES control.retry_policies(policy_id),
  concurrency_policy jsonb NOT NULL DEFAULT '{"max_parallel":3,"serialize_workstreams":true,"max_run_tasks":20}'::jsonb,
  n8n_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  environment_routing jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control.workstreams (
  project_id uuid NOT NULL REFERENCES control.projects(project_id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  display_name text NOT NULL,
  stack_key text NOT NULL CHECK (stack_key ~ '^[a-z][a-z0-9-]*$'),
  application_path text,
  suit_slug text UNIQUE REFERENCES control.suits(slug) ON DELETE SET NULL,
  retry_policy_id text REFERENCES control.retry_policies(policy_id),
  model_profile text CHECK (model_profile IS NULL OR model_profile IN ('no_ai','fast','standard','deep','review')),
  concurrency_policy jsonb NOT NULL DEFAULT '{"serialized":true}'::jsonb,
  verification_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  publication_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, slug),
  UNIQUE (project_id, stack_key)
);

CREATE TABLE IF NOT EXISTS control.platform_settings (
  setting_key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO control.retry_policies (policy_id, display_name, max_attempts, attempt_profiles)
VALUES
  ('standard-five', 'Standard five attempts', 5, '["standard","standard","standard","standard","deep"]'),
  ('cheap-three', 'Cheap three attempts', 3, '["fast","standard","standard"]'),
  ('critical-five', 'Critical five attempts', 5, '["standard","standard","deep","deep","deep"]'),
  ('deep-only', 'Deep only', 3, '["deep","deep","deep"]'),
  ('legacy-fast-five', 'Legacy fast routing', 5, '["fast","fast","standard","standard","deep"]'),
  ('legacy-deep-five', 'Legacy deep routing', 5, '["deep","deep","deep","deep","deep"]'),
  ('legacy-review-five', 'Legacy review routing', 5, '["review","review","review","review","review"]')
ON CONFLICT (policy_id) DO NOTHING;

INSERT INTO control.platform_settings (setting_key, value)
VALUES ('global_retry_policy', '"standard-five"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO control.projects (
  slug, display_name, repository_path, github_repository,
  integration_branch, production_branch, local_repository_root, worktree_root,
  application_paths, allowed_publication_paths, retry_policy_id, active,
  n8n_metadata, environment_routing, metadata
)
VALUES (
  'building-suit', 'Building Suit', 'Building-Suit/building-suit-monorepo',
  'Building-Suit/building-suit-monorepo', 'stg', 'main',
  '.', '.local/worktrees',
  '{"ledger-suit":"apps/ledger-suit","shop-suit":"apps/shop-suit","inventory-suit":"apps/inventory-suit"}',
  '["apps/","packages/","tooling/","docs/"]', 'standard-five', true,
  '{"adapter":"optional","legacy_command":"bs-agent"}',
  '{"control_database":"environment"}',
  '{"compatibility":"control.suits is retained"}'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO control.workstreams (
  project_id, slug, display_name, stack_key, application_path, suit_slug
)
SELECT p.project_id, s.slug, s.display_name, s.stack_key, s.app_path, s.slug
FROM control.projects p
CROSS JOIN control.suits s
WHERE p.slug = 'building-suit'
ON CONFLICT (project_id, slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  stack_key = EXCLUDED.stack_key,
  application_path = EXCLUDED.application_path,
  suit_slug = EXCLUDED.suit_slug;

ALTER TABLE control.tasks
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES control.projects(project_id),
  ADD COLUMN IF NOT EXISTS workstream_slug text,
  ADD COLUMN IF NOT EXISTS retry_policy_id text REFERENCES control.retry_policies(policy_id),
  ADD COLUMN IF NOT EXISTS engine_stage text NOT NULL DEFAULT 'pending';

UPDATE control.tasks t
SET project_id = w.project_id,
    workstream_slug = w.slug,
    retry_policy_id = CASE t.model_profile
      WHEN 'fast' THEN 'legacy-fast-five'
      WHEN 'deep' THEN 'legacy-deep-five'
      WHEN 'review' THEN 'legacy-review-five'
      ELSE 'standard-five'
    END
FROM control.workstreams w
WHERE w.suit_slug = t.suit_slug
  AND (t.project_id IS NULL OR t.workstream_slug IS NULL OR t.retry_policy_id IS NULL);

ALTER TABLE control.tasks DROP CONSTRAINT IF EXISTS tasks_project_workstream_fkey;
ALTER TABLE control.tasks ADD CONSTRAINT tasks_project_workstream_fkey
  FOREIGN KEY (project_id, workstream_slug)
  REFERENCES control.workstreams(project_id, slug);

ALTER TABLE control.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE control.tasks ADD CONSTRAINT tasks_status_check CHECK (
  status IN ('planned','ready','blocked','in_progress','verification','failed','passed','complete','cancelled')
);

ALTER TABLE control.executions
  ADD COLUMN IF NOT EXISTS resolved_retry_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_path text,
  ADD COLUMN IF NOT EXISTS usage jsonb,
  ADD COLUMN IF NOT EXISTS engine_stage text NOT NULL DEFAULT 'implementation';

ALTER TABLE control.verification_results
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS elapsed_ms bigint;

ALTER TABLE control.verification_results DROP CONSTRAINT IF EXISTS verification_results_status_check;
ALTER TABLE control.verification_results ADD CONSTRAINT verification_results_status_check CHECK (
  status IN ('queued','running','pass','fail','skipped','not_run')
);

CREATE TABLE IF NOT EXISTS control.verification_runs (
  verification_run_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  execution_id bigint NOT NULL REFERENCES control.executions(execution_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','passed','failed','cancelled')),
  source text NOT NULL DEFAULT 'runner',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE control.verification_results
  ADD COLUMN IF NOT EXISTS verification_run_id bigint REFERENCES control.verification_runs(verification_run_id) ON DELETE CASCADE;

INSERT INTO control.verification_runs(execution_id,status,source,started_at,finished_at,metadata)
SELECT DISTINCT v.execution_id,
  CASE WHEN EXISTS (SELECT 1 FROM control.verification_results x WHERE x.execution_id=v.execution_id AND x.status IN('fail','not_run')) THEN 'failed' ELSE 'passed' END,
  'migration',min(COALESCE(v.started_at,v.created_at)),max(COALESCE(v.finished_at,v.created_at)),
  '{"backfilled":true}'::jsonb
FROM control.verification_results v
WHERE v.verification_run_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM control.verification_runs r WHERE r.execution_id=v.execution_id AND r.metadata->>'backfilled'='true')
GROUP BY v.execution_id;

UPDATE control.verification_results v
SET verification_run_id=r.verification_run_id,
    queued_at=COALESCE(v.queued_at,v.started_at,v.created_at),
    elapsed_ms=COALESCE(v.elapsed_ms,(v.metadata->>'elapsed_ms')::bigint)
FROM control.verification_runs r
WHERE v.execution_id=r.execution_id AND v.verification_run_id IS NULL AND r.metadata->>'backfilled'='true';

DROP INDEX IF EXISTS control.verification_execution_check_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS verification_run_check_uidx
  ON control.verification_results(verification_run_id,check_name)
  WHERE verification_run_id IS NOT NULL;

CREATE OR REPLACE FUNCTION control.start_verification_run(
  p_task_id text, p_execution_id bigint, p_source text DEFAULT 'runner', p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE task_status text; DECLARE execution_task text; DECLARE execution_status text; DECLARE new_id bigint; DECLARE existing_id bigint;
BEGIN
  SELECT status INTO task_status FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %',p_task_id; END IF;
  SELECT task_id,status INTO execution_task,execution_status FROM control.executions WHERE execution_id=p_execution_id;
  IF NOT FOUND OR execution_task<>p_task_id OR execution_status<>'succeeded' THEN
    RAISE EXCEPTION 'Execution % is not a succeeded execution for task %',p_execution_id,p_task_id;
  END IF;
  IF task_status NOT IN ('in_progress','verification') THEN
    RAISE EXCEPTION 'Task % cannot verify from %',p_task_id,task_status;
  END IF;
  SELECT verification_run_id INTO existing_id FROM control.verification_runs
  WHERE execution_id=p_execution_id AND status='running' ORDER BY verification_run_id DESC LIMIT 1;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  UPDATE control.tasks SET status='verification',engine_stage='verification' WHERE task_id=p_task_id;
  UPDATE control.executions SET engine_stage='verification' WHERE execution_id=p_execution_id;
  INSERT INTO control.verification_runs(execution_id,status,source,metadata)
  VALUES(p_execution_id,'running',p_source,COALESCE(p_metadata,'{}')) RETURNING verification_run_id INTO new_id;
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(p_task_id,'verification_started',task_status,'verification',p_source,jsonb_build_object('execution_id',p_execution_id,'verification_run_id',new_id));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION control.queue_verification_check(
  p_run_id bigint,p_check_name text,p_command text,p_required boolean DEFAULT true
)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE new_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM control.verification_runs WHERE verification_run_id=p_run_id AND status='running') THEN
    RAISE EXCEPTION 'Verification run % is not running',p_run_id;
  END IF;
  INSERT INTO control.verification_results(verification_run_id,execution_id,check_name,command,status,metadata,queued_at)
  SELECT p_run_id,execution_id,p_check_name,p_command,'queued',jsonb_build_object('required',p_required),now()
  FROM control.verification_runs WHERE verification_run_id=p_run_id
  ON CONFLICT(verification_run_id,check_name) WHERE verification_run_id IS NOT NULL
  DO UPDATE SET command=EXCLUDED.command,status='queued',metadata=EXCLUDED.metadata,queued_at=now(),started_at=NULL,finished_at=NULL,exit_code=NULL,summary=NULL,log_path=NULL,elapsed_ms=NULL
  RETURNING verification_id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION control.update_verification_check(
  p_run_id bigint,p_check_name text,p_status text,p_exit_code integer DEFAULT NULL,p_summary text DEFAULT NULL,
  p_log_path text DEFAULT NULL,p_elapsed_ms bigint DEFAULT NULL,p_command text DEFAULT NULL,p_required boolean DEFAULT true
)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE new_id bigint;
BEGIN
  IF p_status NOT IN ('running','pass','fail','skipped','not_run') THEN RAISE EXCEPTION 'Unsupported check status: %',p_status; END IF;
  INSERT INTO control.verification_results(verification_run_id,execution_id,check_name,command,status,exit_code,summary,log_path,metadata,queued_at,started_at,finished_at,elapsed_ms)
  SELECT p_run_id,execution_id,p_check_name,p_command,p_status,p_exit_code,p_summary,p_log_path,jsonb_build_object('required',p_required),now(),
    CASE WHEN p_status='running' THEN now() ELSE now() END,
    CASE WHEN p_status='running' THEN NULL ELSE now() END,p_elapsed_ms
  FROM control.verification_runs WHERE verification_run_id=p_run_id AND status='running'
  ON CONFLICT(verification_run_id,check_name) WHERE verification_run_id IS NOT NULL
  DO UPDATE SET command=COALESCE(EXCLUDED.command,control.verification_results.command),status=EXCLUDED.status,
    exit_code=EXCLUDED.exit_code,summary=EXCLUDED.summary,log_path=EXCLUDED.log_path,metadata=EXCLUDED.metadata,
    started_at=COALESCE(control.verification_results.started_at,now()),
    finished_at=CASE WHEN EXCLUDED.status='running' THEN NULL ELSE now() END,elapsed_ms=EXCLUDED.elapsed_ms
  RETURNING verification_id INTO new_id;
  IF new_id IS NULL THEN RAISE EXCEPTION 'Verification run % is not running',p_run_id; END IF;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION control.finish_verification_run(p_task_id text,p_run_id bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE owning_execution bigint; DECLARE failed_count integer; DECLARE pending_count integer; DECLARE final_status text;
BEGIN
  SELECT execution_id INTO owning_execution FROM control.verification_runs WHERE verification_run_id=p_run_id AND status='running' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification run % is not running',p_run_id; END IF;
  SELECT count(*) FILTER(WHERE status IN('fail','not_run')),count(*) FILTER(WHERE status IN('queued','running'))
  INTO failed_count,pending_count FROM control.verification_results WHERE verification_run_id=p_run_id;
  IF pending_count>0 THEN RAISE EXCEPTION 'Verification run % still has % pending checks',p_run_id,pending_count; END IF;
  IF NOT EXISTS(SELECT 1 FROM control.verification_results WHERE verification_run_id=p_run_id) THEN
    RAISE EXCEPTION 'Verification run % has no checks',p_run_id;
  END IF;
  final_status:=CASE WHEN failed_count=0 THEN 'passed' ELSE 'failed' END;
  UPDATE control.verification_runs SET status=final_status,finished_at=now() WHERE verification_run_id=p_run_id;
  UPDATE control.tasks SET status=CASE WHEN final_status='passed' THEN 'passed' ELSE 'failed' END,
    engine_stage=CASE WHEN final_status='passed' THEN 'publication' ELSE 'verification_failed' END WHERE task_id=p_task_id;
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(p_task_id,'verification_finished','verification',CASE WHEN final_status='passed' THEN 'passed' ELSE 'failed' END,'runner',
    jsonb_build_object('execution_id',owning_execution,'verification_run_id',p_run_id,'failed',failed_count));
  RETURN jsonb_build_object('passed',final_status='passed','task_status',CASE WHEN final_status='passed' THEN 'passed' ELSE 'failed' END,
    'verification_run_id',p_run_id,'failed',failed_count);
END;
$$;

ALTER TABLE control.workflow_runs
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES control.projects(project_id),
  ADD COLUMN IF NOT EXISTS workstream_slug text,
  ADD COLUMN IF NOT EXISTS current_task_id text REFERENCES control.tasks(task_id);

UPDATE control.workflow_runs r
SET project_id = w.project_id,
    workstream_slug = w.slug
FROM control.workstreams w
WHERE w.suit_slug = r.suit_slug
  AND (r.project_id IS NULL OR r.workstream_slug IS NULL);

ALTER TABLE control.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_max_tasks_check;

CREATE TABLE IF NOT EXISTS control.audit_events (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid REFERENCES control.projects(project_id) ON DELETE SET NULL,
  workstream_slug text,
  task_id text REFERENCES control.tasks(task_id) ON DELETE SET NULL,
  execution_id bigint REFERENCES control.executions(execution_id) ON DELETE SET NULL,
  action text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  actor text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_task_idx
  ON control.audit_events (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS control.failures (
  failure_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid REFERENCES control.projects(project_id) ON DELETE SET NULL,
  workstream_slug text,
  task_id text REFERENCES control.tasks(task_id) ON DELETE CASCADE,
  execution_id bigint REFERENCES control.executions(execution_id) ON DELETE SET NULL,
  attempt integer,
  stage text NOT NULL,
  error_code text,
  summary text NOT NULL,
  raw_error text,
  retry_available boolean NOT NULL DEFAULT false,
  next_profile text,
  human_intervention_required boolean NOT NULL DEFAULT false,
  legal_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS failures_open_idx
  ON control.failures (created_at DESC) WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION control.validate_retry_policy(
  p_max_attempts integer,
  p_attempt_profiles jsonb
)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_max_attempts < 1 OR p_max_attempts > 20 THEN
    RAISE EXCEPTION 'max_attempts must be between 1 and 20';
  END IF;
  IF jsonb_typeof(p_attempt_profiles) <> 'array'
     OR jsonb_array_length(p_attempt_profiles) <> p_max_attempts THEN
    RAISE EXCEPTION 'attempt profile count must equal max_attempts';
  END IF;
  IF jsonb_path_exists(p_attempt_profiles,
    '$[*] ? (@ != "fast" && @ != "standard" && @ != "deep" && @ != "review")') THEN
    RAISE EXCEPTION 'attempt_profiles contains an unsupported model profile';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION control.resolved_retry_policy(p_task_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH resolved AS (
    SELECT COALESCE(
      t.retry_policy_id,
      w.retry_policy_id,
      p.retry_policy_id,
      trim(both '"' from ps.value::text)
    ) AS policy_id,
    CASE
      WHEN t.retry_policy_id IS NOT NULL THEN 'task'
      WHEN w.retry_policy_id IS NOT NULL THEN 'workstream'
      WHEN p.retry_policy_id IS NOT NULL THEN 'project'
      ELSE 'global'
    END AS inherited_from
    FROM control.tasks t
    LEFT JOIN control.workstreams w
      ON w.project_id = t.project_id AND w.slug = t.workstream_slug
    LEFT JOIN control.projects p ON p.project_id = t.project_id
    LEFT JOIN control.platform_settings ps ON ps.setting_key = 'global_retry_policy'
    WHERE t.task_id = p_task_id
  )
  SELECT jsonb_build_object(
    'policy_id', rp.policy_id,
    'max_attempts', rp.max_attempts,
    'attempt_profiles', rp.attempt_profiles,
    'inherited_from', resolved.inherited_from
  )
  FROM resolved
  JOIN control.retry_policies rp ON rp.policy_id = resolved.policy_id
  WHERE rp.active = true;
$$;

CREATE OR REPLACE FUNCTION control.retry_profile_for_attempt(p_task_id text, p_attempt integer)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE policy jsonb;
BEGIN
  policy := control.resolved_retry_policy(p_task_id);
  IF policy IS NULL THEN RAISE EXCEPTION 'No active retry policy resolves for task %', p_task_id; END IF;
  IF p_attempt < 1 OR p_attempt > (policy->>'max_attempts')::integer THEN
    RAISE EXCEPTION 'Attempt % is outside policy %', p_attempt, policy->>'policy_id';
  END IF;
  RETURN policy->'attempt_profiles'->>(p_attempt - 1);
END;
$$;

CREATE OR REPLACE FUNCTION control.transition_task(
  p_task_id text, p_to_status text, p_source text, p_reason text DEFAULT NULL,
  p_expected_status text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE current_row control.tasks%ROWTYPE;
DECLARE allowed boolean := false;
BEGIN
  SELECT * INTO current_row FROM control.tasks WHERE task_id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %', p_task_id; END IF;
  IF p_expected_status IS NOT NULL AND current_row.status <> p_expected_status THEN
    RAISE EXCEPTION 'Task % is %, expected %', p_task_id, current_row.status, p_expected_status;
  END IF;
  allowed := CASE current_row.status
    WHEN 'planned' THEN p_to_status IN ('ready','in_progress','blocked','cancelled')
    WHEN 'ready' THEN p_to_status IN ('in_progress','blocked','cancelled')
    WHEN 'blocked' THEN p_to_status IN ('planned','ready','cancelled')
    WHEN 'in_progress' THEN p_to_status IN ('verification','failed','blocked','cancelled')
    WHEN 'verification' THEN p_to_status IN ('passed','failed','blocked','cancelled')
    WHEN 'failed' THEN p_to_status IN ('in_progress','verification','cancelled')
    WHEN 'passed' THEN p_to_status IN ('verification','complete','cancelled')
    WHEN 'complete' THEN false
    WHEN 'cancelled' THEN false
    ELSE false END;
  IF NOT allowed THEN RAISE EXCEPTION 'Illegal task transition: % -> %', current_row.status, p_to_status; END IF;
  UPDATE control.tasks SET status = p_to_status WHERE task_id = p_task_id;
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES (p_task_id,'task_transition',current_row.status,p_to_status,p_source,
    jsonb_build_object('reason',p_reason,'metadata',COALESCE(p_metadata,'{}'::jsonb)));
  INSERT INTO control.audit_events(project_id,workstream_slug,task_id,action,source,old_value,new_value,reason,metadata)
  VALUES (current_row.project_id,current_row.workstream_slug,p_task_id,'task_transition',p_source,
    jsonb_build_object('status',current_row.status),jsonb_build_object('status',p_to_status),p_reason,COALESCE(p_metadata,'{}'::jsonb));
  RETURN jsonb_build_object('task_id',p_task_id,'from_status',current_row.status,'to_status',p_to_status);
END;
$$;

CREATE OR REPLACE FUNCTION control.reopen_verification(p_task_id text, p_source text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE e control.executions%ROWTYPE;
DECLARE previous_status text;
BEGIN
  SELECT status INTO previous_status FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF previous_status NOT IN ('failed','passed') THEN
    RAISE EXCEPTION 'Task % cannot reopen verification from %', p_task_id, previous_status;
  END IF;
  SELECT * INTO e FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC LIMIT 1;
  IF NOT FOUND OR e.status <> 'succeeded' THEN
    RAISE EXCEPTION 'Latest execution must have succeeded';
  END IF;
  UPDATE control.tasks SET status='verification', engine_stage='verification' WHERE task_id=p_task_id;
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(p_task_id,'verification_reopened',previous_status,'verification',p_source,
    jsonb_build_object('execution_id',e.execution_id,'reason',p_reason));
  INSERT INTO control.audit_events(project_id,workstream_slug,task_id,execution_id,action,source,reason)
  SELECT project_id,workstream_slug,task_id,e.execution_id,'verification_reopened',p_source,p_reason
  FROM control.tasks WHERE task_id=p_task_id;
  RETURN jsonb_build_object('task_id',p_task_id,'execution_id',e.execution_id,'status','verification');
END;
$$;

CREATE OR REPLACE FUNCTION control.cancel_task(p_task_id text, p_source text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE old_status text;
BEGIN
  SELECT status INTO old_status FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %', p_task_id; END IF;
  IF old_status IN ('complete','cancelled') THEN RAISE EXCEPTION 'Task % cannot be cancelled from %',p_task_id,old_status; END IF;
  UPDATE control.tasks SET status='cancelled',engine_stage='cancelled' WHERE task_id=p_task_id;
  UPDATE control.executions SET status='cancelled',finished_at=now()
    WHERE task_id=p_task_id AND status IN ('queued','running');
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(p_task_id,'task_cancelled',old_status,'cancelled',p_source,jsonb_build_object('reason',p_reason));
  RETURN jsonb_build_object('task_id',p_task_id,'from_status',old_status,'status','cancelled');
END;
$$;

CREATE OR REPLACE VIEW control.ready_tasks AS
SELECT t.* FROM control.tasks t
WHERE t.status IN ('planned','ready')
AND NOT EXISTS (
  SELECT 1 FROM control.tasks active
  WHERE active.project_id=t.project_id AND active.workstream_slug=t.workstream_slug
    AND active.task_id<>t.task_id
    AND COALESCE((
      SELECT (w.concurrency_policy->>'serialized')::boolean
      FROM control.workstreams w
      WHERE w.project_id=t.project_id AND w.slug=t.workstream_slug
    ),true)
    AND active.status IN ('in_progress','verification','passed','failed')
)
AND NOT EXISTS (
  SELECT 1 FROM control.task_dependencies d JOIN control.tasks parent ON parent.task_id=d.depends_on_task_id
  WHERE d.task_id=t.task_id AND d.dependency_type='hard' AND parent.status<>'complete'
)
AND NOT EXISTS (
  SELECT 1 FROM control.task_decisions td JOIN control.decisions d
    ON d.suit_slug=td.suit_slug AND d.decision_id=td.decision_id
  WHERE td.task_id=t.task_id AND td.blocking=true AND d.status<>'approved'
);

CREATE OR REPLACE FUNCTION control.generic_task_packet(p_task_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT control.task_packet(p_task_id) || jsonb_build_object(
    'project', to_jsonb(p) - 'metadata',
    'workstream', to_jsonb(w) - 'metadata',
    'retry_policy', control.resolved_retry_policy(t.task_id),
    'preparation', t.metadata->'preparation'
  )
  FROM control.tasks t
  LEFT JOIN control.projects p ON p.project_id=t.project_id
  LEFT JOIN control.workstreams w ON w.project_id=t.project_id AND w.slug=t.workstream_slug
  WHERE t.task_id=p_task_id;
$$;

CREATE OR REPLACE FUNCTION control.start_workflow_run(p_suit_slug text,p_max_tasks integer)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE existing_run control.workflow_runs%ROWTYPE; DECLARE new_run control.workflow_runs%ROWTYPE;
DECLARE workstream control.workstreams%ROWTYPE; DECLARE safety_bound integer;
BEGIN
  SELECT w.* INTO workstream FROM control.workstreams w WHERE w.suit_slug=p_suit_slug AND w.active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or inactive workstream: %',p_suit_slug; END IF;
  SELECT COALESCE((p.concurrency_policy->>'max_run_tasks')::integer,20) INTO safety_bound
  FROM control.projects p WHERE p.project_id=workstream.project_id AND p.active=true;
  IF safety_bound IS NULL THEN RAISE EXCEPTION 'Owning project is inactive'; END IF;
  IF p_max_tasks<1 OR p_max_tasks>safety_bound THEN
    RAISE EXCEPTION 'max_tasks must be between 1 and project safety bound %',safety_bound;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('automation-run:'||workstream.project_id::text||':'||workstream.slug,0));
  SELECT * INTO existing_run FROM control.workflow_runs WHERE suit_slug=p_suit_slug AND status='running' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('started',false,'reason','run_already_active','run_id',existing_run.run_id,'max_tasks',existing_run.max_tasks,'completed_tasks',existing_run.completed_tasks); END IF;
  INSERT INTO control.workflow_runs(suit_slug,project_id,workstream_slug,max_tasks)
  VALUES(p_suit_slug,workstream.project_id,workstream.slug,p_max_tasks) RETURNING * INTO new_run;
  INSERT INTO control.audit_events(project_id,workstream_slug,action,source,new_value)
  VALUES(workstream.project_id,workstream.slug,'workflow_run_started','runner',to_jsonb(new_run));
  RETURN jsonb_build_object('started',true,'run_id',new_run.run_id,'project_id',new_run.project_id,'workstream_slug',new_run.workstream_slug,
    'max_tasks',new_run.max_tasks,'completed_tasks',0,'stop_requested',false,'status','running','should_continue',true);
END;
$$;

DROP TRIGGER IF EXISTS retry_policies_set_updated_at ON control.retry_policies;
CREATE TRIGGER retry_policies_set_updated_at BEFORE UPDATE ON control.retry_policies
FOR EACH ROW EXECUTE FUNCTION control.set_updated_at();
DROP TRIGGER IF EXISTS projects_set_updated_at ON control.projects;
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON control.projects
FOR EACH ROW EXECUTE FUNCTION control.set_updated_at();
DROP TRIGGER IF EXISTS workstreams_set_updated_at ON control.workstreams;
CREATE TRIGGER workstreams_set_updated_at BEFORE UPDATE ON control.workstreams
FOR EACH ROW EXECUTE FUNCTION control.set_updated_at();

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bs_control_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA control TO bs_control_app;
    GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA control TO bs_control_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA control TO bs_control_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bs_dashboard_reader') THEN
    GRANT SELECT ON ALL TABLES IN SCHEMA control TO bs_dashboard_reader;
  END IF;
END
$do$;

COMMIT;
