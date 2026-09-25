BEGIN;

CREATE SCHEMA IF NOT EXISTS control AUTHORIZATION CURRENT_USER;

CREATE TABLE IF NOT EXISTS control.suits (
  slug text PRIMARY KEY,
  display_name text NOT NULL,
  stack_key text NOT NULL UNIQUE,
  app_path text,
  status text NOT NULL DEFAULT 'planning'
    CHECK (
      status IN (
        'planning',
        'active',
        'paused',
        'complete',
        'archived'
      )
    ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (slug ~ '^[a-z][a-z0-9-]*$'),
  CHECK (stack_key ~ '^[a-z][a-z0-9-]*$')
);

CREATE TABLE IF NOT EXISTS control.requirements (
  suit_slug text NOT NULL
    REFERENCES control.suits(slug)
    ON DELETE CASCADE,

  requirement_id text NOT NULL,
  title text NOT NULL,
  summary text,

  status text NOT NULL DEFAULT 'proposed'
    CHECK (
      status IN (
        'proposed',
        'approved',
        'implemented',
        'partial',
        'missing',
        'unverified',
        'deferred'
      )
    ),

  risk_level text NOT NULL DEFAULT 'normal'
    CHECK (
      risk_level IN (
        'low',
        'normal',
        'high',
        'critical'
      )
    ),

  source_path text,
  source_anchor text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (suit_slug, requirement_id)
);

CREATE TABLE IF NOT EXISTS control.decisions (
  suit_slug text NOT NULL
    REFERENCES control.suits(slug)
    ON DELETE CASCADE,

  decision_id text NOT NULL,
  title text NOT NULL,
  decision_text text,

  status text NOT NULL DEFAULT 'open'
    CHECK (
      status IN (
        'open',
        'approved',
        'rejected',
        'superseded'
      )
    ),

  source text,
  decided_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (suit_slug, decision_id)
);

CREATE TABLE IF NOT EXISTS control.tasks (
  task_id text PRIMARY KEY,

  suit_slug text NOT NULL
    REFERENCES control.suits(slug)
    ON DELETE CASCADE,

  sequence integer NOT NULL DEFAULT 1000,
  priority integer NOT NULL DEFAULT 100,

  title text NOT NULL,
  description text,

  task_type text NOT NULL DEFAULT 'feature'
    CHECK (
      task_type IN (
        'feature',
        'bug',
        'database',
        'docs',
        'research',
        'review',
        'release',
        'maintenance'
      )
    ),

  risk_level text NOT NULL DEFAULT 'normal'
    CHECK (
      risk_level IN (
        'low',
        'normal',
        'high',
        'critical'
      )
    ),

  model_profile text NOT NULL DEFAULT 'standard'
    CHECK (
      model_profile IN (
        'no_ai',
        'fast',
        'standard',
        'deep',
        'review'
      )
    ),

  status text NOT NULL DEFAULT 'planned'
    CHECK (
      status IN (
        'planned',
        'in_progress',
        'verification',
        'passed',
        'blocked',
        'failed',
        'complete',
        'cancelled'
      )
    ),

  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (task_id, suit_slug)
);

CREATE INDEX IF NOT EXISTS tasks_suit_status_idx
  ON control.tasks (suit_slug, status);

CREATE INDEX IF NOT EXISTS tasks_dispatch_idx
  ON control.tasks (
    status,
    priority,
    sequence,
    created_at
  );

CREATE TABLE IF NOT EXISTS control.task_requirements (
  task_id text NOT NULL,
  suit_slug text NOT NULL,
  requirement_id text NOT NULL,

  PRIMARY KEY (
    task_id,
    suit_slug,
    requirement_id
  ),

  FOREIGN KEY (task_id, suit_slug)
    REFERENCES control.tasks(task_id, suit_slug)
    ON DELETE CASCADE,

  FOREIGN KEY (suit_slug, requirement_id)
    REFERENCES control.requirements(
      suit_slug,
      requirement_id
    )
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS control.task_dependencies (
  task_id text NOT NULL
    REFERENCES control.tasks(task_id)
    ON DELETE CASCADE,

  depends_on_task_id text NOT NULL
    REFERENCES control.tasks(task_id)
    ON DELETE CASCADE,

  dependency_type text NOT NULL DEFAULT 'hard'
    CHECK (
      dependency_type IN (
        'hard',
        'soft'
      )
    ),

  PRIMARY KEY (
    task_id,
    depends_on_task_id
  ),

  CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS control.task_decisions (
  task_id text NOT NULL,
  suit_slug text NOT NULL,
  decision_id text NOT NULL,

  blocking boolean NOT NULL DEFAULT true,

  PRIMARY KEY (
    task_id,
    suit_slug,
    decision_id
  ),

  FOREIGN KEY (task_id, suit_slug)
    REFERENCES control.tasks(task_id, suit_slug)
    ON DELETE CASCADE,

  FOREIGN KEY (suit_slug, decision_id)
    REFERENCES control.decisions(
      suit_slug,
      decision_id
    )
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS control.executions (
  execution_id bigint GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  task_id text NOT NULL
    REFERENCES control.tasks(task_id)
    ON DELETE CASCADE,

  attempt integer NOT NULL
    CHECK (attempt > 0),

  model_profile text NOT NULL
    CHECK (
      model_profile IN (
        'no_ai',
        'fast',
        'standard',
        'deep',
        'review'
      )
    ),

  model_name text,

  reasoning_effort text
    CHECK (
      reasoning_effort IS NULL
      OR reasoning_effort IN (
        'none',
        'low',
        'medium',
        'high',
        'extra_high'
      )
    ),

  status text NOT NULL DEFAULT 'queued'
    CHECK (
      status IN (
        'queued',
        'running',
        'succeeded',
        'failed',
        'blocked',
        'cancelled'
      )
    ),

  worktree_path text,
  branch_name text,
  parent_branch text,
  parent_sha text,
  commit_sha text,

  prompt_bytes bigint NOT NULL DEFAULT 0
    CHECK (prompt_bytes >= 0),

  output_bytes bigint NOT NULL DEFAULT 0
    CHECK (output_bytes >= 0),

  run_log_path text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  started_at timestamptz,
  finished_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (task_id, attempt)
);

CREATE INDEX IF NOT EXISTS executions_task_idx
  ON control.executions (
    task_id,
    attempt DESC
  );

CREATE TABLE IF NOT EXISTS control.verification_results (
  verification_id bigint GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  execution_id bigint NOT NULL
    REFERENCES control.executions(execution_id)
    ON DELETE CASCADE,

  check_name text NOT NULL,
  command text,

  status text NOT NULL
    CHECK (
      status IN (
        'pass',
        'fail',
        'skipped',
        'not_run'
      )
    ),

  exit_code integer,
  summary text,
  log_path text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  started_at timestamptz,
  finished_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_execution_idx
  ON control.verification_results (
    execution_id,
    check_name
  );

CREATE TABLE IF NOT EXISTS control.pull_requests (
  pull_request_id bigint GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  task_id text
    REFERENCES control.tasks(task_id)
    ON DELETE SET NULL,

  repository text NOT NULL,
  pr_number integer NOT NULL
    CHECK (pr_number > 0),

  head_branch text NOT NULL,
  base_branch text NOT NULL,

  state text NOT NULL DEFAULT 'open'
    CHECK (
      state IN (
        'open',
        'closed',
        'merged'
      )
    ),

  is_draft boolean NOT NULL DEFAULT true,

  url text,
  head_sha text,
  merge_sha text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (repository, pr_number)
);

CREATE TABLE IF NOT EXISTS control.task_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  task_id text NOT NULL
    REFERENCES control.tasks(task_id)
    ON DELETE CASCADE,

  event_type text NOT NULL,

  from_status text,
  to_status text,

  source text NOT NULL DEFAULT 'system'
    CHECK (
      source IN (
        'system',
        'n8n',
        'runner',
        'codex',
        'github',
        'human',
        'chatgpt'
      )
    ),

  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_events_task_idx
  ON control.task_events (
    task_id,
    event_id DESC
  );

CREATE OR REPLACE FUNCTION control.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS suits_set_updated_at
  ON control.suits;

CREATE TRIGGER suits_set_updated_at
BEFORE UPDATE ON control.suits
FOR EACH ROW
EXECUTE FUNCTION control.set_updated_at();

DROP TRIGGER IF EXISTS requirements_set_updated_at
  ON control.requirements;

CREATE TRIGGER requirements_set_updated_at
BEFORE UPDATE ON control.requirements
FOR EACH ROW
EXECUTE FUNCTION control.set_updated_at();

DROP TRIGGER IF EXISTS decisions_set_updated_at
  ON control.decisions;

CREATE TRIGGER decisions_set_updated_at
BEFORE UPDATE ON control.decisions
FOR EACH ROW
EXECUTE FUNCTION control.set_updated_at();

DROP TRIGGER IF EXISTS tasks_set_updated_at
  ON control.tasks;

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON control.tasks
FOR EACH ROW
EXECUTE FUNCTION control.set_updated_at();

DROP TRIGGER IF EXISTS pull_requests_set_updated_at
  ON control.pull_requests;

CREATE TRIGGER pull_requests_set_updated_at
BEFORE UPDATE ON control.pull_requests
FOR EACH ROW
EXECUTE FUNCTION control.set_updated_at();

CREATE OR REPLACE VIEW control.ready_tasks AS
SELECT t.*
FROM control.tasks AS t
WHERE t.status = 'planned'

AND NOT EXISTS (
  SELECT 1
  FROM control.task_dependencies AS dependency
  JOIN control.tasks AS parent
    ON parent.task_id = dependency.depends_on_task_id
  WHERE dependency.task_id = t.task_id
    AND dependency.dependency_type = 'hard'
    AND parent.status NOT IN (
      'passed',
      'complete'
    )
)

AND NOT EXISTS (
  SELECT 1
  FROM control.task_decisions AS task_decision
  JOIN control.decisions AS decision
    ON decision.suit_slug = task_decision.suit_slug
   AND decision.decision_id = task_decision.decision_id
  WHERE task_decision.task_id = t.task_id
    AND task_decision.blocking = true
    AND decision.status <> 'approved'
);

CREATE OR REPLACE FUNCTION control.next_ready_task(
  p_suit_slug text DEFAULT NULL
)
RETURNS SETOF control.tasks
LANGUAGE sql
STABLE
AS $$
  SELECT ready.*
  FROM control.ready_tasks AS ready
  WHERE
    p_suit_slug IS NULL
    OR ready.suit_slug = p_suit_slug
  ORDER BY
    ready.priority ASC,
    ready.sequence ASC,
    ready.created_at ASC
  LIMIT 1;
$$;

COMMIT;
