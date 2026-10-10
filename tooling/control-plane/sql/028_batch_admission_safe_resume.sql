BEGIN;

ALTER TABLE control.publication_readiness_contracts
  ADD COLUMN IF NOT EXISTS input_generation bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidation_reason text;

-- Create every type and column before any SQL-language function is parsed.
-- This ordering is required both for a clean 001..028 migration and for a
-- production-shaped 027 -> 028 upgrade with check_function_bodies enabled.
CREATE TABLE IF NOT EXISTS control.batch_repair_generations (
  repair_id text PRIMARY KEY,
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  registry_patch jsonb NOT NULL CHECK (jsonb_typeof(registry_patch)='object'),
  controller_proof jsonb NOT NULL CHECK (jsonb_typeof(controller_proof)='object'),
  status text NOT NULL CHECK(status IN('prepared','applied','revoked')),
  idempotency_key text NOT NULL UNIQUE,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  revoked_at timestamptz
);

ALTER TABLE control.batch_repair_generations
  ADD COLUMN IF NOT EXISTS after_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE control.workflow_runs
  ADD COLUMN IF NOT EXISTS maintenance_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS run_revision bigint NOT NULL DEFAULT 1 CHECK(run_revision > 0),
  ADD COLUMN IF NOT EXISTS admitted_repair_id text REFERENCES control.batch_repair_generations(repair_id),
  ADD COLUMN IF NOT EXISTS controller_protocol text,
  ADD COLUMN IF NOT EXISTS controller_fingerprint text,
  ADD COLUMN IF NOT EXISTS controller_lease_token text,
  ADD COLUMN IF NOT EXISTS controller_lease_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS control.batch_task_admissions (
  repair_id text NOT NULL REFERENCES control.batch_repair_generations(repair_id) ON DELETE RESTRICT,
  task_id text NOT NULL REFERENCES control.tasks(task_id) ON DELETE RESTRICT,
  run_id uuid NOT NULL REFERENCES control.workflow_runs(run_id) ON DELETE RESTRICT,
  ordinal integer NOT NULL CHECK(ordinal > 0),
  input_generation bigint NOT NULL,
  contract_fingerprint text NOT NULL,
  verification_fingerprint text NOT NULL,
  status text NOT NULL CHECK(status IN('blocked','admitted','claimed','completed','revoked')),
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(blockers)='array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(repair_id,task_id),
  UNIQUE(repair_id,run_id,ordinal)
);

CREATE TABLE IF NOT EXISTS control.workflow_run_task_credits (
  run_id uuid NOT NULL REFERENCES control.workflow_runs(run_id) ON DELETE RESTRICT,
  task_id text NOT NULL REFERENCES control.tasks(task_id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  credited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,task_id)
);

CREATE TABLE IF NOT EXISTS control.task_admission_generations (
  task_id text PRIMARY KEY REFERENCES control.tasks(task_id) ON DELETE CASCADE,
  input_generation bigint NOT NULL DEFAULT 1 CHECK (input_generation > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO control.task_admission_generations(task_id)
SELECT task_id FROM control.tasks
ON CONFLICT (task_id) DO NOTHING;

CREATE OR REPLACE FUNCTION control.invalidate_task_admissions(
  p_task_ids text[],
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE v_task_id text;
DECLARE changed integer := 0;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Admission invalidation reason is required';
  END IF;

  FOR v_task_id IN SELECT DISTINCT value FROM unnest(p_task_ids) value WHERE value IS NOT NULL ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('task-admission:' || v_task_id, 0));
    INSERT INTO control.task_admission_generations AS generation(task_id,input_generation,updated_at)
    VALUES(v_task_id,1,now())
    ON CONFLICT(task_id) DO UPDATE
      SET input_generation=generation.input_generation+1,
          updated_at=now();
    UPDATE control.publication_readiness_contracts AS contract
    SET valid=false,invalidated_at=now(),invalidation_reason=p_reason
    WHERE contract.task_id=v_task_id AND contract.valid=true;
    changed := changed + 1;
  END LOOP;
  RETURN changed;
END;
$$;

-- Admission authority is the complete durable row by default. Only lifecycle
-- bookkeeping columns and the runner-owned preparation payload are excluded.
-- Consequently a newly introduced column or metadata key is authority-bearing
-- until this projection is deliberately reviewed and amended.
CREATE OR REPLACE FUNCTION control.authority_input_projection(
  p_row jsonb,
  p_runtime_columns text[] DEFAULT ARRAY['created_at','updated_at']::text[],
  p_runtime_metadata_keys text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (COALESCE(p_row,'{}'::jsonb) - p_runtime_columns - 'metadata')
    || CASE WHEN COALESCE(p_row,'{}'::jsonb) ? 'metadata'
      THEN jsonb_build_object(
        'metadata',
        CASE WHEN jsonb_typeof(p_row->'metadata')='object'
          THEN (p_row->'metadata') - p_runtime_metadata_keys
          ELSE p_row->'metadata'
        END
      )
      ELSE '{}'::jsonb
    END;
$$;

CREATE OR REPLACE FUNCTION control.invalidate_task_admission_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE ids text[];
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(
      to_jsonb(OLD), ARRAY['created_at','updated_at','status','engine_stage'], ARRAY['preparation']
    ) IS NOT DISTINCT FROM control.authority_input_projection(
      to_jsonb(NEW), ARRAY['created_at','updated_at','status','engine_stage'], ARRAY['preparation']
    ) THEN
      RETURN NEW;
    END IF;
    ids := ARRAY[CASE WHEN TG_OP='DELETE' THEN OLD.task_id ELSE NEW.task_id END];
  ELSIF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(to_jsonb(OLD))
      IS NOT DISTINCT FROM control.authority_input_projection(to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    SELECT array_agg(task_id ORDER BY task_id) INTO ids FROM control.tasks
    WHERE project_id=COALESCE(NEW.project_id,OLD.project_id)
      AND status NOT IN('complete','cancelled');
  ELSIF TG_TABLE_NAME = 'workstreams' THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(to_jsonb(OLD))
      IS NOT DISTINCT FROM control.authority_input_projection(to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    SELECT array_agg(task_id ORDER BY task_id) INTO ids FROM control.tasks
    WHERE project_id=COALESCE(NEW.project_id,OLD.project_id)
      AND workstream_slug=COALESCE(NEW.slug,OLD.slug)
      AND status NOT IN('complete','cancelled');
  ELSIF TG_TABLE_NAME = 'requirements' THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(to_jsonb(OLD))
      IS NOT DISTINCT FROM control.authority_input_projection(to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    SELECT array_agg(link.task_id ORDER BY link.task_id) INTO ids
    FROM control.task_requirements link JOIN control.tasks task USING(task_id)
    WHERE link.suit_slug=COALESCE(NEW.suit_slug,OLD.suit_slug)
      AND link.requirement_id=COALESCE(NEW.requirement_id,OLD.requirement_id)
      AND task.status NOT IN('complete','cancelled');
  ELSIF TG_TABLE_NAME = 'decisions' THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(to_jsonb(OLD))
      IS NOT DISTINCT FROM control.authority_input_projection(to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    SELECT array_agg(link.task_id ORDER BY link.task_id) INTO ids
    FROM control.task_decisions link JOIN control.tasks task USING(task_id)
    WHERE link.suit_slug=COALESCE(NEW.suit_slug,OLD.suit_slug)
      AND link.decision_id=COALESCE(NEW.decision_id,OLD.decision_id)
      AND task.status NOT IN('complete','cancelled');
  ELSIF TG_TABLE_NAME = 'suits' THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(to_jsonb(OLD))
      IS NOT DISTINCT FROM control.authority_input_projection(to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    SELECT array_agg(task_id ORDER BY task_id) INTO ids FROM control.tasks
    WHERE suit_slug=COALESCE(NEW.slug,OLD.slug)
      AND status NOT IN('complete','cancelled');
  ELSIF TG_TABLE_NAME IN ('retry_policies','platform_settings') THEN
    IF TG_OP='UPDATE' AND control.authority_input_projection(to_jsonb(OLD))
      IS NOT DISTINCT FROM control.authority_input_projection(to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
    SELECT array_agg(task_id ORDER BY task_id) INTO ids FROM control.tasks
    WHERE status NOT IN('complete','cancelled');
  ELSE
    ids := CASE TG_OP
      WHEN 'INSERT' THEN ARRAY[NEW.task_id]
      WHEN 'DELETE' THEN ARRAY[OLD.task_id]
      ELSE ARRAY[NEW.task_id,OLD.task_id]
    END;
  END IF;
  PERFORM control.invalidate_task_admissions(COALESCE(ids,ARRAY[]::text[]),TG_TABLE_NAME||':'||TG_OP);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_invalidate_admission ON control.tasks;
CREATE TRIGGER tasks_invalidate_admission
AFTER INSERT OR UPDATE ON control.tasks
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS projects_invalidate_admission ON control.projects;
CREATE TRIGGER projects_invalidate_admission
AFTER UPDATE ON control.projects
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS workstreams_invalidate_admission ON control.workstreams;
CREATE TRIGGER workstreams_invalidate_admission
AFTER UPDATE ON control.workstreams
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS requirements_invalidate_admission ON control.requirements;
CREATE TRIGGER requirements_invalidate_admission
AFTER UPDATE ON control.requirements
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS decisions_invalidate_admission ON control.decisions;
CREATE TRIGGER decisions_invalidate_admission
AFTER UPDATE ON control.decisions
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS task_requirements_invalidate_admission ON control.task_requirements;
CREATE TRIGGER task_requirements_invalidate_admission
AFTER INSERT OR UPDATE OR DELETE ON control.task_requirements
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS task_decisions_invalidate_admission ON control.task_decisions;
CREATE TRIGGER task_decisions_invalidate_admission
AFTER INSERT OR UPDATE OR DELETE ON control.task_decisions
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS task_dependencies_invalidate_admission ON control.task_dependencies;
CREATE TRIGGER task_dependencies_invalidate_admission
AFTER INSERT OR UPDATE OR DELETE ON control.task_dependencies
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS suits_invalidate_admission ON control.suits;
CREATE TRIGGER suits_invalidate_admission
AFTER UPDATE ON control.suits
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS retry_policies_invalidate_admission ON control.retry_policies;
CREATE TRIGGER retry_policies_invalidate_admission
AFTER UPDATE ON control.retry_policies
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DROP TRIGGER IF EXISTS platform_settings_invalidate_admission ON control.platform_settings;
CREATE TRIGGER platform_settings_invalidate_admission
AFTER UPDATE ON control.platform_settings
FOR EACH ROW EXECUTE FUNCTION control.invalidate_task_admission_trigger();

DO $do$
BEGIN
  IF to_regprocedure('control.refresh_publication_readiness_contract_v1(text,text)') IS NULL THEN
    ALTER FUNCTION control.refresh_publication_readiness_contract(text,text)
      RENAME TO refresh_publication_readiness_contract_v1;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION control.refresh_publication_readiness_contract(
  p_task_id text,
  p_source text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE generation bigint;
DECLARE refreshed jsonb;
DECLARE actual_unresolved jsonb;
DECLARE old_fingerprint text;
DECLARE new_fingerprint text;
BEGIN
  PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %',p_task_id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('task-admission:' || p_task_id,0));
  INSERT INTO control.task_admission_generations(task_id) VALUES(p_task_id)
  ON CONFLICT(task_id) DO NOTHING;
  SELECT input_generation INTO generation FROM control.task_admission_generations
  WHERE task_id=p_task_id FOR UPDATE;
  SELECT contract_fingerprint INTO old_fingerprint FROM control.publication_readiness_contracts
  WHERE task_id=p_task_id FOR UPDATE;
  refreshed := control.refresh_publication_readiness_contract_v1(p_task_id,p_source);
  SELECT COALESCE(jsonb_agg(scope ORDER BY scope),'[]'::jsonb) INTO actual_unresolved
  FROM (
    SELECT DISTINCT value AS scope
    FROM control.tasks task
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(task.metadata->'allowed_paths')='array' THEN task.metadata->'allowed_paths' ELSE '[]'::jsonb END
      || CASE WHEN jsonb_typeof(task.metadata->'source_allowed_paths')='array' THEN task.metadata->'source_allowed_paths' ELSE '[]'::jsonb END
    ) declared(value)
    WHERE task.task_id=p_task_id AND value ~ '[*?\[\{]'
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(task.metadata->'publication_resolved_scopes')='array'
          THEN task.metadata->'publication_resolved_scopes' ELSE '[]'::jsonb END
      ) resolved(value) WHERE resolved.value=declared.value)
  ) unresolved;
  UPDATE control.publication_readiness_contracts
  SET input_generation=generation,valid=true,invalidated_at=NULL,invalidation_reason=NULL,
      unresolved_scopes=actual_unresolved,
      contract_fingerprint=md5(jsonb_build_object(
        'task_id',publication_readiness_contracts.task_id,
        'task_paths',task_paths,'source_paths',source_paths,'workstream_paths',workstream_paths,
        'project_paths',project_paths,'required_paths',required_paths,'unresolved_scopes',actual_unresolved,
        'requirement_evidence',requirement_evidence,'input_generation',generation
      )::text)
  WHERE task_id=p_task_id
  RETURNING to_jsonb(publication_readiness_contracts) INTO refreshed;
  new_fingerprint:=refreshed->>'contract_fingerprint';
  IF old_fingerprint IS DISTINCT FROM new_fingerprint THEN
    UPDATE control.publication_preexecution_authorizations
    SET revoked_at=COALESCE(revoked_at,now())
    WHERE task_id=p_task_id AND revoked_at IS NULL;
  END IF;
  RETURN refreshed;
END;
$$;

CREATE OR REPLACE FUNCTION control.publication_contract_is_current(p_task_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(contract.valid AND contract.input_generation=generation.input_generation,false)
  FROM control.task_admission_generations generation
  LEFT JOIN control.publication_readiness_contracts contract USING(task_id)
  WHERE generation.task_id=p_task_id;
$$;

CREATE OR REPLACE FUNCTION control.task_publication_authority_is_current(p_task_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    control.publication_contract_is_current(p_task_id)
    AND jsonb_array_length(contract.unresolved_scopes)=0
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(contract.required_paths) required(path)
      WHERE (
        required.path ~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)'
        OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(contract.workstream_paths) owned(prefix)
          WHERE required.path=rtrim(owned.prefix,'/') OR required.path LIKE rtrim(owned.prefix,'/')||'/%'
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM control.publication_preexecution_authorizations AS auth
        WHERE auth.task_id=p_task_id
          AND auth.contract_id=contract.contract_id
          AND auth.revoked_at IS NULL
          AND auth.authorized_paths ? required.path
          AND auth.authorization_kind=CASE
            WHEN required.path ~* '(^|/)\.env([./]|$)|(^|/)supabase/(migrations/|config\.toml$|seed\.sql$)|(^|/)n8n(/|\.|-)|(^|/)\.github/workflows/|(^|/)(vercel|deploy)(/|\.|-)'
              THEN 'protected' ELSE 'ordinary' END
      )
    ),
    false
  )
  FROM control.publication_readiness_contracts contract
  WHERE contract.task_id=p_task_id;
$$;

CREATE OR REPLACE FUNCTION control.task_hard_dependencies_complete(p_task_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM control.task_dependencies dependency
    LEFT JOIN control.tasks parent ON parent.task_id=dependency.depends_on_task_id
    WHERE dependency.task_id=p_task_id
      AND dependency.dependency_type='hard'
      AND (parent.task_id IS NULL OR parent.status<>'complete')
  );
$$;

CREATE OR REPLACE FUNCTION control.task_blocking_decisions_clear(p_task_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM control.task_decisions link
    LEFT JOIN control.decisions decision
      ON decision.suit_slug=link.suit_slug AND decision.decision_id=link.decision_id
    WHERE link.task_id=p_task_id AND link.blocking
      AND (decision.decision_id IS NULL OR decision.status<>'approved')
  );
$$;

CREATE OR REPLACE FUNCTION control.task_execution_admission(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'ready',control.task_publication_authority_is_current(task.task_id)
      AND NOT COALESCE(run.maintenance_requested,false)
      AND NOT COALESCE(run.stop_requested,false)
      AND (run.admitted_repair_id IS NULL OR run.current_task_id=task.task_id)
      AND control.task_hard_dependencies_complete(task.task_id)
      AND control.task_blocking_decisions_clear(task.task_id),
    'publication_current',control.publication_contract_is_current(task.task_id),
    'publication_authority_current',control.task_publication_authority_is_current(task.task_id),
    'maintenance_requested',COALESCE(run.maintenance_requested,false),
    'run_id',run.run_id,
    'run_owned',run.admitted_repair_id IS NOT NULL,
    'run_current_task_id',run.current_task_id,
    'reason',CASE
      WHEN NOT control.publication_contract_is_current(task.task_id) THEN 'publication_contract_stale'
      WHEN NOT control.task_publication_authority_is_current(task.task_id) THEN 'publication_authority_incomplete'
      WHEN COALESCE(run.maintenance_requested,false) THEN 'maintenance_requested'
      WHEN COALESCE(run.stop_requested,false) THEN 'stop_requested'
      WHEN run.admitted_repair_id IS NOT NULL AND run.current_task_id IS DISTINCT FROM task.task_id THEN 'workflow_run_owned_claim_required'
      WHEN NOT control.task_hard_dependencies_complete(task.task_id) THEN 'hard_dependency_unsatisfied'
      WHEN NOT control.task_blocking_decisions_clear(task.task_id) THEN 'blocking_decision_unresolved'
      ELSE 'admitted'
    END
  )
  FROM control.tasks task
  LEFT JOIN LATERAL (
    SELECT workflow.* FROM control.workflow_runs workflow
    WHERE workflow.project_id=task.project_id AND workflow.workstream_slug=task.workstream_slug
      AND workflow.status='running'
    ORDER BY workflow.started_at DESC LIMIT 1
  ) run ON true
  WHERE task.task_id=p_task_id;
$$;

DO $do$
BEGIN
  IF to_regprocedure('control.generic_task_packet_v1(text)') IS NULL THEN
    ALTER FUNCTION control.generic_task_packet(text) RENAME TO generic_task_packet_v1;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION control.generic_task_packet(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT control.generic_task_packet_v1(p_task_id)
    || jsonb_build_object('execution_admission',control.task_execution_admission(p_task_id));
$$;

DO $do$
BEGIN
  IF to_regprocedure('control.start_execution_v1(text,text,text,text,text,text,text,text)') IS NULL THEN
    ALTER FUNCTION control.start_execution(text,text,text,text,text,text,text,text)
      RENAME TO start_execution_v1;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION control.start_execution(
  p_task_id text,
  p_model_profile text,
  p_model_name text,
  p_reasoning_effort text,
  p_worktree_path text,
  p_branch_name text,
  p_parent_branch text,
  p_parent_sha text
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE admission jsonb;
BEGIN
  PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task: %',p_task_id; END IF;
  admission:=control.task_execution_admission(p_task_id);
  IF admission IS NULL OR admission->>'ready'<>'true' THEN
    RAISE EXCEPTION 'Task execution admission refused: %',COALESCE(admission->>'reason','missing');
  END IF;
  RETURN control.start_execution_v1(p_task_id,p_model_profile,p_model_name,p_reasoning_effort,
    p_worktree_path,p_branch_name,p_parent_branch,p_parent_sha);
END;
$$;

CREATE OR REPLACE FUNCTION control.verification_contract_fingerprint(p_task_id text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT md5(jsonb_build_object(
    'task_id',task.task_id,
    'verification_plan',task.verification_plan,
    'project_verification_config',project.verification_config,
    'workstream_verification_config',workstream.verification_config
  )::text)
  FROM control.tasks task
  JOIN control.projects project USING(project_id)
  JOIN control.workstreams workstream ON workstream.project_id=task.project_id AND workstream.slug=task.workstream_slug
  WHERE task.task_id=p_task_id;
$$;

DO $do$
BEGIN
  IF to_regprocedure('control.workflow_run_gate_v1(uuid)') IS NULL THEN
    ALTER FUNCTION control.workflow_run_gate(uuid) RENAME TO workflow_run_gate_v1;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION control.workflow_run_gate(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE run control.workflow_runs%ROWTYPE;
BEGIN
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown workflow run: %',p_run_id; END IF;
  IF run.status='running' AND run.maintenance_requested THEN
    RETURN jsonb_build_object('run_id',run.run_id,'status',run.status,
      'completed_tasks',run.completed_tasks,'max_tasks',run.max_tasks,'should_continue',false,
      'reason','maintenance_requested','maintenance_requested',true,'run_revision',run.run_revision);
  END IF;
  RETURN control.workflow_run_gate_v1(p_run_id);
END;
$$;

CREATE OR REPLACE FUNCTION control.prepare_batch_readiness_repair(
  p_repair_id text,
  p_evidence_sha256 text,
  p_registry_patch jsonb,
  p_controller_proof jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE existing control.batch_repair_generations%ROWTYPE;
BEGIN
  IF p_repair_id<>'CP-BATCH-READY-001' OR p_evidence_sha256<>'e2f0f02d37eea920dbe589c86888d287dce7a4a84410b8764346e6f74c7d6c5e' THEN
    RAISE EXCEPTION 'Batch repair identity or evidence digest mismatch';
  END IF;
  SELECT * INTO existing FROM control.batch_repair_generations WHERE repair_id=p_repair_id FOR UPDATE;
  IF FOUND THEN
    IF existing.evidence_sha256<>p_evidence_sha256 OR existing.registry_patch<>p_registry_patch
      OR existing.controller_proof<>p_controller_proof OR existing.idempotency_key<>p_idempotency_key THEN
      RAISE EXCEPTION 'Batch repair idempotency conflict';
    END IF;
    RETURN to_jsonb(existing)||jsonb_build_object('idempotent',true);
  END IF;
  INSERT INTO control.batch_repair_generations(repair_id,evidence_sha256,registry_patch,controller_proof,status,idempotency_key,before_state)
  VALUES(p_repair_id,p_evidence_sha256,p_registry_patch,p_controller_proof,'prepared',p_idempotency_key,
    jsonb_build_object(
      'workstreams',(SELECT jsonb_object_agg(workstream.slug,workstream.verification_config)
        FROM control.workstreams workstream JOIN control.projects project USING(project_id)
        WHERE project.slug='building-suit' AND workstream.slug IN('shared','shop-suit','super-admin-suit')),
      'runs',(SELECT jsonb_agg(to_jsonb(run) ORDER BY workstream_slug) FROM control.workflow_runs run WHERE run_id IN(
        '4f3b1b7f-0c82-4667-a420-563a43953326','dc3910cd-48be-42b4-9569-4c769e633a44','e362bc39-996c-451c-8fac-9a47df92715c'))
    )) RETURNING * INTO existing;
  RETURN to_jsonb(existing)||jsonb_build_object('idempotent',false);
END;
$$;

CREATE OR REPLACE FUNCTION control.merge_verification_registry_config(
  p_existing jsonb,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH command_rows AS (
    SELECT command,command->>'name' AS name,priority
    FROM (
      SELECT value AS command,1 AS priority
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_existing->'commands')='array' THEN p_existing->'commands' ELSE '[]'::jsonb END)
      UNION ALL
      SELECT value,2
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_patch->'commands')='array' THEN p_patch->'commands' ELSE '[]'::jsonb END)
    ) command_values
    WHERE command->>'name' IS NOT NULL
  ), commands AS (
    SELECT COALESCE(jsonb_agg(command ORDER BY name),'[]'::jsonb) AS value
    FROM (SELECT DISTINCT ON(name) name,command FROM command_rows ORDER BY name,priority DESC) selected
  )
  SELECT (COALESCE(p_existing,'{}'::jsonb)-'commands'-'legacy_plan_mappings')
    || (COALESCE(p_patch,'{}'::jsonb)-'commands'-'legacy_plan_mappings')
    || jsonb_build_object(
      'commands',commands.value,
      'legacy_plan_mappings',COALESCE(p_existing->'legacy_plan_mappings','{}'::jsonb)
        || COALESCE(p_patch->'legacy_plan_mappings','{}'::jsonb)
    )
  FROM commands;
$$;

CREATE OR REPLACE FUNCTION control.apply_batch_readiness_registry_patch(
  p_repair_id text,
  p_expected_evidence_sha256 text,
  p_expected_run_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE repair control.batch_repair_generations%ROWTYPE;
DECLARE entry record;
DECLARE run_row record;
DECLARE current_config jsonb;
DECLARE resulting_config jsonb;
DECLARE after_workstreams jsonb := '{}'::jsonb;
DECLARE expected_task_ids text[] := ARRAY[
  'BS-UI-ZN-DATA-001','BS-UI-ZN-PATTERNS-001','BS-UI-ZN-LEDGER-001','BS-UI-ZN-SHOP-001',
  'BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-GENERATOR-001','BS-UI-ZN-BROWSER-001','BS-UI-ZN-FINAL-001',
  'SS-SA-EVIDENCE-001','SS-SA-CUSTOM-OFFER-001','SAS-M1-CONFIG-001','SAS-M1-AUTH-001'];
BEGIN
  SELECT * INTO repair FROM control.batch_repair_generations WHERE repair_id=p_repair_id FOR UPDATE;
  IF NOT FOUND OR repair.status='revoked' OR repair.evidence_sha256<>p_expected_evidence_sha256 THEN
    RAISE EXCEPTION 'Prepared batch repair does not match expected evidence';
  END IF;
  IF COALESCE((repair.controller_proof->>'available')::boolean,false)<>true
    OR COALESCE(repair.controller_proof->>'fingerprint','')=''
    OR repair.controller_proof->>'protocol'<>'cp-batch-v2' THEN
    RAISE EXCEPTION 'Deployed controller proof is required before applying batch repair';
  END IF;
  IF repair.status='applied' THEN
    IF EXISTS(
      SELECT 1 FROM jsonb_each(repair.after_state->'workstreams') expected
      LEFT JOIN control.workstreams workstream ON workstream.slug=expected.key
        AND workstream.project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit')
      WHERE workstream.verification_config IS DISTINCT FROM expected.value
    ) THEN RAISE EXCEPTION 'Applied registry state drift prevents replay'; END IF;
    RETURN jsonb_build_object('repair_id',p_repair_id,'status','applied','resumed',false,'idempotent',true);
  END IF;
  IF (SELECT count(*) FROM control.workflow_runs WHERE run_id IN(
    '4f3b1b7f-0c82-4667-a420-563a43953326','dc3910cd-48be-42b4-9569-4c769e633a44','e362bc39-996c-451c-8fac-9a47df92715c'))<>3 THEN
    RAISE EXCEPTION 'One or more preserved workflow runs are missing';
  END IF;
  FOR run_row IN
    SELECT run.* FROM control.workflow_runs run
    WHERE run.run_id IN('4f3b1b7f-0c82-4667-a420-563a43953326','dc3910cd-48be-42b4-9569-4c769e633a44','e362bc39-996c-451c-8fac-9a47df92715c')
    ORDER BY run.run_id FOR UPDATE
  LOOP
    IF NOT (p_expected_run_state ? run_row.run_id::text)
      OR (p_expected_run_state -> (run_row.run_id::text) ->> 'status') IS DISTINCT FROM run_row.status
      OR (p_expected_run_state -> (run_row.run_id::text) ->> 'max_tasks')::integer IS DISTINCT FROM run_row.max_tasks
      OR (p_expected_run_state -> (run_row.run_id::text) ->> 'completed_tasks')::integer IS DISTINCT FROM run_row.completed_tasks
      OR (p_expected_run_state -> (run_row.run_id::text) ->> 'current_task_id') IS DISTINCT FROM run_row.current_task_id
      OR (p_expected_run_state -> (run_row.run_id::text) ->> 'run_revision')::bigint IS DISTINCT FROM run_row.run_revision
      OR run_row.maintenance_requested<>true THEN
      RAISE EXCEPTION 'Run state drift or maintenance not quiescent: %',run_row.run_id;
    END IF;
  END LOOP;
  FOR entry IN SELECT key,value FROM jsonb_each(repair.registry_patch->'workstreams') ORDER BY key
  LOOP
    SELECT workstream.verification_config INTO current_config
    FROM control.workstreams workstream
    WHERE workstream.slug=entry.key
      AND workstream.project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit')
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registered workstream missing: %',entry.key; END IF;
    IF current_config IS DISTINCT FROM repair.before_state->'workstreams'->entry.key THEN
      RAISE EXCEPTION 'Registry state drift before apply: %',entry.key;
    END IF;
    resulting_config:=control.merge_verification_registry_config(current_config,entry.value->'verification_config');
    UPDATE control.workstreams
    SET verification_config=resulting_config
    WHERE slug=entry.key AND project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit');
    after_workstreams:=after_workstreams||jsonb_build_object(entry.key,resulting_config);
  END LOOP;
  PERFORM control.refresh_publication_readiness_contract(task.task_id,'CP-BATCH-READY-001')
  FROM control.tasks task
  WHERE task.task_id=ANY(expected_task_ids) AND task.status NOT IN('complete','cancelled')
  ORDER BY task.task_id;
  UPDATE control.batch_repair_generations
  SET status='applied',applied_at=now(),after_state=jsonb_build_object('workstreams',after_workstreams)
  WHERE repair_id=p_repair_id;
  RETURN jsonb_build_object('repair_id',p_repair_id,'status','applied','resumed',false,
    'idempotent',false,'resulting_workstreams',after_workstreams);
END;
$$;

CREATE OR REPLACE FUNCTION control.request_workflow_maintenance(
  p_run_id uuid,
  p_expected_revision bigint,
  p_source text DEFAULT 'human'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE run control.workflow_runs%ROWTYPE;
BEGIN
  IF p_source<>'human' THEN RAISE EXCEPTION 'Maintenance requires human source'; END IF;
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND OR run.run_revision<>p_expected_revision OR run.status<>'running' THEN
    RAISE EXCEPTION 'Run missing, changed, or not running';
  END IF;
  UPDATE control.workflow_runs SET maintenance_requested=true,run_revision=run_revision+1 WHERE run_id=p_run_id RETURNING * INTO run;
  RETURN to_jsonb(run)||jsonb_build_object('quiescent',run.current_task_id IS NULL
    AND (run.controller_lease_expires_at IS NULL OR run.controller_lease_expires_at<=now()));
END;
$$;

CREATE OR REPLACE FUNCTION control.reconcile_workflow_run_budget(
  p_run_id uuid,
  p_expected_revision bigint,
  p_expected_max_tasks integer,
  p_expected_completed_tasks integer,
  p_requested_max_tasks integer,
  p_source text DEFAULT 'human'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE run control.workflow_runs%ROWTYPE;
BEGIN
  IF p_source<>'human' THEN RAISE EXCEPTION 'Budget reconciliation requires human source'; END IF;
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND OR run.run_revision<>p_expected_revision OR run.max_tasks<>p_expected_max_tasks
    OR run.completed_tasks<>p_expected_completed_tasks OR run.status<>'running'
    OR run.current_task_id IS NOT NULL OR run.maintenance_requested<>true THEN
    RAISE EXCEPTION 'Run state changed or is not quiescent for reconciliation';
  END IF;
  IF p_requested_max_tasks<run.completed_tasks OR p_requested_max_tasks<1 THEN
    RAISE EXCEPTION 'Requested budget cannot be below completed credit';
  END IF;
  UPDATE control.workflow_runs SET max_tasks=p_requested_max_tasks,run_revision=run_revision+1
  WHERE run_id=p_run_id RETURNING * INTO run;
  INSERT INTO control.audit_events(project_id,workstream_slug,action,source,old_value,new_value,metadata)
  VALUES(run.project_id,run.workstream_slug,'workflow_run_budget_reconciled','human',
    jsonb_build_object('max_tasks',p_expected_max_tasks,'completed_tasks',p_expected_completed_tasks),
    jsonb_build_object('max_tasks',p_requested_max_tasks,'completed_tasks',run.completed_tasks),
    jsonb_build_object('run_id',run.run_id,'preserved_run_id',true,'guessed_historical_credit',false));
  RETURN to_jsonb(run);
END;
$$;

CREATE OR REPLACE FUNCTION control.activate_batch_task_admissions(
  p_repair_id text,
  p_admissions jsonb,
  p_controller_protocol text,
  p_controller_fingerprint text,
  p_source text DEFAULT 'human'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE repair control.batch_repair_generations%ROWTYPE;
DECLARE item jsonb;
DECLARE task_row control.tasks%ROWTYPE;
DECLARE run control.workflow_runs%ROWTYPE;
DECLARE generation bigint;
DECLARE contract control.publication_readiness_contracts%ROWTYPE;
DECLARE run_item record;
DECLARE expected_ids text[] := ARRAY[
  'BS-UI-ZN-DATA-001','BS-UI-ZN-PATTERNS-001','BS-UI-ZN-LEDGER-001','BS-UI-ZN-SHOP-001',
  'BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-GENERATOR-001','BS-UI-ZN-BROWSER-001','BS-UI-ZN-FINAL-001',
  'SS-SA-EVIDENCE-001','SS-SA-CUSTOM-OFFER-001','SAS-M1-CONFIG-001','SAS-M1-AUTH-001'];
DECLARE supplied_ids text[];
BEGIN
  IF p_source<>'human' OR jsonb_typeof(p_admissions)<>'array'
    OR COALESCE(p_controller_protocol,'')='' OR COALESCE(p_controller_fingerprint,'')='' THEN
    RAISE EXCEPTION 'Reviewed admissions and controller identity are required';
  END IF;
  SELECT * INTO repair FROM control.batch_repair_generations WHERE repair_id=p_repair_id FOR UPDATE;
  IF NOT FOUND OR repair.status<>'applied'
    OR repair.controller_proof->>'protocol'<>p_controller_protocol
    OR repair.controller_proof->>'fingerprint'<>p_controller_fingerprint THEN
    RAISE EXCEPTION 'Applied repair and matching deployed controller proof are required';
  END IF;
  SELECT array_agg(element->>'task_id' ORDER BY element->>'task_id') INTO supplied_ids
    FROM jsonb_array_elements(p_admissions) elements(element);
  IF supplied_ids IS DISTINCT FROM (SELECT array_agg(value ORDER BY value) FROM unnest(expected_ids) value) THEN
    RAISE EXCEPTION 'Admission set must exactly match the reconciled 12-task release set';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_admissions) value
    WHERE jsonb_typeof(value->'blockers')<>'array' OR jsonb_array_length(value->'blockers')<>0) THEN
    RAISE EXCEPTION 'Every admitted task must have an empty reviewed blocker set';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_admissions) supplied(value)
    JOIN control.tasks task ON task.task_id=supplied.value->>'task_id'
    LEFT JOIN control.workflow_runs workflow ON workflow.run_id=(supplied.value->>'run_id')::uuid
    WHERE workflow.run_id IS NULL
      OR workflow.project_id<>task.project_id
      OR workflow.workstream_slug<>task.workstream_slug
      OR task.project_id IS DISTINCT FROM (SELECT project_id FROM control.projects WHERE slug='building-suit')
      OR workflow.run_id IS DISTINCT FROM CASE task.workstream_slug
        WHEN 'shared' THEN '4f3b1b7f-0c82-4667-a420-563a43953326'::uuid
        WHEN 'shop-suit' THEN 'dc3910cd-48be-42b4-9569-4c769e633a44'::uuid
        WHEN 'super-admin-suit' THEN 'e362bc39-996c-451c-8fac-9a47df92715c'::uuid
        ELSE NULL END
  ) THEN
    RAISE EXCEPTION 'Admission project, workstream, or preserved run attribution is invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_admissions) supplied(value)
    WHERE NULLIF(supplied.value->>'ordinal','') IS NULL
      OR (supplied.value->>'ordinal')::integer<1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_admissions) supplied(value)
    GROUP BY (supplied.value->>'run_id')::uuid,(supplied.value->>'ordinal')::integer
    HAVING count(*)<>1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_admissions) supplied(value)
    GROUP BY (supplied.value->>'run_id')::uuid
    HAVING min((supplied.value->>'ordinal')::integer)<>1
      OR max((supplied.value->>'ordinal')::integer)<>count(*)
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_admissions) supplied(value)
    JOIN (VALUES
      ('BS-UI-ZN-DATA-001',1),('BS-UI-ZN-PATTERNS-001',2),('BS-UI-ZN-LEDGER-001',3),
      ('BS-UI-ZN-SHOP-001',4),('BS-UI-ZN-OTHER-SUITS-001',5),('BS-UI-ZN-GENERATOR-001',6),
      ('BS-UI-ZN-BROWSER-001',7),('BS-UI-ZN-FINAL-001',8),
      ('SS-SA-EVIDENCE-001',1),('SS-SA-CUSTOM-OFFER-001',2),
      ('SAS-M1-CONFIG-001',1),('SAS-M1-AUTH-001',2)
    ) expected(task_id,ordinal) ON expected.task_id=supplied.value->>'task_id'
    WHERE (supplied.value->>'ordinal')::integer<>expected.ordinal
  ) THEN
    RAISE EXCEPTION 'Admission ordinals must be positive, unique, contiguous, and match the reviewed run order';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_admissions) child_json(value)
    JOIN control.task_dependencies dependency
      ON dependency.task_id=child_json.value->>'task_id' AND dependency.dependency_type='hard'
    LEFT JOIN control.tasks parent ON parent.task_id=dependency.depends_on_task_id
    LEFT JOIN LATERAL (
      SELECT parent_json.value
      FROM jsonb_array_elements(p_admissions) parent_json(value)
      WHERE parent_json.value->>'task_id'=dependency.depends_on_task_id
    ) internal_parent ON true
    WHERE dependency.task_id=dependency.depends_on_task_id
      OR (COALESCE(parent.status,'missing')<>'complete' AND internal_parent.value IS NULL)
  ) THEN
    RAISE EXCEPTION 'Hard dependency is self-referential, omitted, incomplete, or ordered after its child';
  END IF;
  IF EXISTS (
    WITH RECURSIVE supplied AS (
      SELECT value->>'task_id' AS task_id,(value->>'run_id')::uuid AS run_id,
        (value->>'ordinal')::integer AS ordinal
      FROM jsonb_array_elements(p_admissions) entries(value)
    ), wait_edges(waiter,prerequisite) AS (
      SELECT dependency.task_id,dependency.depends_on_task_id
      FROM control.task_dependencies dependency
      JOIN supplied child ON child.task_id=dependency.task_id
      JOIN supplied parent ON parent.task_id=dependency.depends_on_task_id
      WHERE dependency.dependency_type='hard'
      UNION
      SELECT later.task_id,earlier.task_id
      FROM supplied later
      JOIN supplied earlier ON earlier.run_id=later.run_id AND earlier.ordinal=later.ordinal-1
    ), dependency_walk(root_task,current_task,path,cycle) AS (
      SELECT edge.waiter,edge.prerequisite,ARRAY[edge.waiter,edge.prerequisite],
        edge.waiter=edge.prerequisite
      FROM wait_edges edge
      UNION ALL
      SELECT walk.root_task,edge.prerequisite,walk.path||edge.prerequisite,
        edge.prerequisite=ANY(walk.path)
      FROM dependency_walk walk
      JOIN wait_edges edge ON edge.waiter=walk.current_task
      WHERE NOT walk.cycle
    )
    SELECT 1 FROM dependency_walk WHERE cycle
  ) THEN
    RAISE EXCEPTION 'Combined hard-dependency and run-order graph contains a cycle';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_admissions) supplied(value)
    JOIN control.tasks task ON task.task_id=supplied.value->>'task_id'
    WHERE task.status='in_progress'
      AND (NOT control.task_hard_dependencies_complete(task.task_id)
        OR NOT control.task_blocking_decisions_clear(task.task_id)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_admissions) earlier(value)
          JOIN control.tasks earlier_task ON earlier_task.task_id=earlier.value->>'task_id'
          WHERE earlier.value->>'run_id'=supplied.value->>'run_id'
            AND (earlier.value->>'ordinal')::integer<(supplied.value->>'ordinal')::integer
            AND earlier_task.status<>'complete'
        ))
  ) THEN
    RAISE EXCEPTION 'Existing claim is not the dependency-ready head of its run';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT (value->>'run_id')::uuid AS run_id,count(*) AS admitted_count
      FROM jsonb_array_elements(p_admissions) supplied(value)
      GROUP BY (value->>'run_id')::uuid
    ) batch
    JOIN control.workflow_runs workflow USING(run_id)
    WHERE batch.admitted_count>workflow.max_tasks-workflow.completed_tasks
  ) THEN
    RAISE EXCEPTION 'Admission set exceeds remaining reconciled run budget';
  END IF;

  IF (SELECT count(*) FROM control.batch_task_admissions WHERE repair_id=p_repair_id)=jsonb_array_length(p_admissions)
    AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_admissions) supplied(value)
      LEFT JOIN control.batch_task_admissions admission
        ON admission.repair_id=p_repair_id AND admission.task_id=supplied.value->>'task_id'
      WHERE admission.task_id IS NULL
        OR admission.run_id<>(supplied.value->>'run_id')::uuid
        OR admission.ordinal<>(supplied.value->>'ordinal')::integer
        OR admission.contract_fingerprint<>supplied.value->>'contract_fingerprint'
        OR admission.verification_fingerprint<>supplied.value->>'verification_fingerprint'
        OR admission.input_generation<>(SELECT input_generation FROM control.task_admission_generations
          WHERE task_id=supplied.value->>'task_id')
        OR jsonb_array_length(admission.blockers)>0
    )
    AND NOT EXISTS(
      SELECT 1 FROM control.workflow_runs AS persisted_run
      WHERE persisted_run.run_id IN(SELECT (value->>'run_id')::uuid FROM jsonb_array_elements(p_admissions))
        AND (persisted_run.admitted_repair_id IS DISTINCT FROM p_repair_id
          OR persisted_run.controller_protocol IS DISTINCT FROM p_controller_protocol
          OR persisted_run.controller_fingerprint IS DISTINCT FROM p_controller_fingerprint)
    ) THEN
    RETURN jsonb_build_object('repair_id',p_repair_id,'admitted_tasks',jsonb_array_length(p_admissions),
      'maintenance_preserved',true,'resumed',false,'idempotent',true);
  END IF;

  FOR run_item IN
    SELECT (value->>'run_id')::uuid AS run_id,
      count(*) FILTER(WHERE task.status='in_progress') AS existing_claims,
      min(task.task_id) FILTER(WHERE task.status='in_progress') AS existing_claim
    FROM jsonb_array_elements(p_admissions) supplied(value)
    JOIN control.tasks task ON task.task_id=value->>'task_id'
    GROUP BY (value->>'run_id')::uuid ORDER BY (value->>'run_id')::uuid
  LOOP
    SELECT * INTO run FROM control.workflow_runs WHERE run_id=run_item.run_id FOR UPDATE;
    IF NOT FOUND OR run.status<>'running' OR run.maintenance_requested<>true
      OR run_item.existing_claims>1
      OR run.controller_lease_expires_at>now()
      OR (run.current_task_id IS NOT NULL AND run.current_task_id IS DISTINCT FROM run_item.existing_claim) THEN
      RAISE EXCEPTION 'Run state drift or multiple preserved claims for run %',run_item.run_id;
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_admissions) ORDER BY value->>'task_id'
  LOOP
    SELECT * INTO task_row FROM control.tasks WHERE task_id=item->>'task_id' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown admission task: %',item->>'task_id'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('task-admission:'||task_row.task_id,0));
    SELECT * INTO run FROM control.workflow_runs WHERE run_id=(item->>'run_id')::uuid;
    SELECT input_generation INTO generation FROM control.task_admission_generations WHERE task_id=task_row.task_id FOR UPDATE;
    SELECT * INTO contract FROM control.publication_readiness_contracts WHERE task_id=task_row.task_id FOR UPDATE;
    IF task_row.task_id IS NULL OR run.run_id IS NULL OR run.workstream_slug<>task_row.workstream_slug
      OR run.status<>'running' OR run.maintenance_requested<>true
      OR NOT contract.valid OR contract.input_generation<>generation
      OR contract.contract_fingerprint<>(item->>'contract_fingerprint')
      OR jsonb_array_length(contract.unresolved_scopes)>0
      OR control.verification_contract_fingerprint(task_row.task_id) IS DISTINCT FROM item->>'verification_fingerprint'
      OR EXISTS(SELECT 1 FROM control.task_dependencies dependency
        JOIN control.tasks parent ON parent.task_id=dependency.depends_on_task_id
        WHERE dependency.task_id=task_row.task_id AND dependency.dependency_type='hard' AND parent.status<>'complete'
          AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_admissions) internal(value)
            WHERE internal.value->>'task_id'=dependency.depends_on_task_id))
      OR EXISTS(SELECT 1 FROM control.task_decisions link JOIN control.decisions decision
        ON decision.suit_slug=link.suit_slug AND decision.decision_id=link.decision_id
        WHERE link.task_id=task_row.task_id AND link.blocking AND decision.status<>'approved') THEN
      RAISE EXCEPTION 'Admission state drift for task %',item->>'task_id';
    END IF;
    IF NOT control.task_publication_authority_is_current(task_row.task_id) THEN
      RAISE EXCEPTION 'Current exact/protected publication authorization is incomplete: %',task_row.task_id;
    END IF;
    IF task_row.status='in_progress' AND EXISTS(SELECT 1 FROM control.executions WHERE task_id=task_row.task_id) THEN
      RAISE EXCEPTION 'Existing claim has implementation executions: %',task_row.task_id;
    ELSIF task_row.status NOT IN('planned','ready','in_progress') THEN
      RAISE EXCEPTION 'Task status is not safely admissible: %',task_row.task_id;
    END IF;
    INSERT INTO control.batch_task_admissions(repair_id,task_id,run_id,ordinal,input_generation,
      contract_fingerprint,verification_fingerprint,status,blockers)
    VALUES(p_repair_id,task_row.task_id,run.run_id,(item->>'ordinal')::integer,generation,
      contract.contract_fingerprint,item->>'verification_fingerprint',
      CASE WHEN task_row.status='in_progress' THEN 'claimed' ELSE 'admitted' END,'[]'::jsonb)
    ON CONFLICT(repair_id,task_id) DO UPDATE SET
      run_id=EXCLUDED.run_id,ordinal=EXCLUDED.ordinal,input_generation=EXCLUDED.input_generation,
      contract_fingerprint=EXCLUDED.contract_fingerprint,verification_fingerprint=EXCLUDED.verification_fingerprint,
      status=EXCLUDED.status,blockers='[]'::jsonb,updated_at=now()
    WHERE control.batch_task_admissions.status<>'completed';
  END LOOP;

  FOR run_item IN
    SELECT (value->>'run_id')::uuid AS run_id,
      min(task.task_id) FILTER(WHERE task.status='in_progress') AS existing_claim
    FROM jsonb_array_elements(p_admissions) supplied(value)
    JOIN control.tasks task ON task.task_id=value->>'task_id'
    GROUP BY (value->>'run_id')::uuid ORDER BY (value->>'run_id')::uuid
  LOOP
    UPDATE control.workflow_runs
    SET current_task_id=run_item.existing_claim,
      admitted_repair_id=p_repair_id,
      controller_protocol=p_controller_protocol,
      controller_fingerprint=p_controller_fingerprint,
      run_revision=run_revision+1
    WHERE run_id=run_item.run_id
      AND (current_task_id IS DISTINCT FROM run_item.existing_claim
        OR admitted_repair_id IS DISTINCT FROM p_repair_id
        OR controller_protocol IS DISTINCT FROM p_controller_protocol
        OR controller_fingerprint IS DISTINCT FROM p_controller_fingerprint);
  END LOOP;
  RETURN jsonb_build_object('repair_id',p_repair_id,'admitted_tasks',jsonb_array_length(p_admissions),
    'maintenance_preserved',true,'resumed',false,'idempotent',false);
END;
$$;

CREATE OR REPLACE FUNCTION control.resume_admitted_workflow_run(
  p_run_id uuid,
  p_expected_revision bigint,
  p_controller_protocol text,
  p_controller_fingerprint text,
  p_source text DEFAULT 'human'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE run control.workflow_runs%ROWTYPE;
BEGIN
  IF p_source<>'human' THEN RAISE EXCEPTION 'Run resume requires human source'; END IF;
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND OR run.status<>'running' OR run.run_revision<>p_expected_revision
    OR run.stop_requested OR run.maintenance_requested<>true OR run.controller_protocol IS DISTINCT FROM p_controller_protocol
    OR run.controller_fingerprint IS DISTINCT FROM p_controller_fingerprint
    OR run.controller_lease_expires_at>now()
    OR run.admitted_repair_id IS NULL THEN RAISE EXCEPTION 'Run resume state drift'; END IF;
  IF NOT EXISTS(SELECT 1 FROM control.batch_task_admissions WHERE repair_id=run.admitted_repair_id
      AND run_id=run.run_id AND status IN('admitted','claimed'))
    OR EXISTS(SELECT 1 FROM control.batch_task_admissions admission
      JOIN control.task_admission_generations generation USING(task_id)
      JOIN control.publication_readiness_contracts contract USING(task_id)
      WHERE admission.repair_id=run.admitted_repair_id AND admission.run_id=run.run_id
        AND admission.status IN('admitted','claimed')
        AND (jsonb_array_length(admission.blockers)>0 OR NOT contract.valid
          OR admission.input_generation<>generation.input_generation
          OR contract.input_generation<>generation.input_generation
          OR contract.contract_fingerprint<>admission.contract_fingerprint
          OR admission.verification_fingerprint<>control.verification_contract_fingerprint(admission.task_id)
          OR NOT control.task_publication_authority_is_current(admission.task_id))) THEN
    RAISE EXCEPTION 'Run admission is missing or stale';
  END IF;
  IF run.current_task_id IS NOT NULL
    AND (NOT control.task_hard_dependencies_complete(run.current_task_id)
      OR NOT control.task_blocking_decisions_clear(run.current_task_id)) THEN
    RAISE EXCEPTION 'Current attributed task is not execution-ready';
  END IF;
  UPDATE control.workflow_runs SET maintenance_requested=false,run_revision=run_revision+1,
    controller_lease_token=NULL,controller_lease_expires_at=NULL
    WHERE run_id=p_run_id RETURNING * INTO run;
  RETURN to_jsonb(run)||jsonb_build_object('resumed',true);
END;
$$;

CREATE OR REPLACE FUNCTION control.acquire_workflow_run_task(
  p_run_id uuid,
  p_controller_protocol text,
  p_controller_fingerprint text,
  p_controller_lease_token text,
  p_source text DEFAULT 'n8n'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE run control.workflow_runs%ROWTYPE;
DECLARE selected record;
DECLARE current_task control.tasks%ROWTYPE;
DECLARE recovery jsonb;
DECLARE ordinary_packet jsonb;
BEGIN
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown workflow run: %',p_run_id; END IF;
  IF run.status<>'running' OR run.stop_requested OR run.maintenance_requested
    OR run.completed_tasks>=run.max_tasks THEN
    RETURN jsonb_build_object('acquired',false,'action','wait','reason',
      CASE WHEN run.maintenance_requested THEN 'maintenance_requested'
        WHEN run.stop_requested THEN 'stop_requested'
        WHEN run.completed_tasks>=run.max_tasks THEN 'limit_reached'
        ELSE run.status END,'run_id',p_run_id);
  END IF;
  IF COALESCE(p_controller_lease_token,'')='' THEN
    RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','controller_lease_token_required','run_id',p_run_id);
  END IF;
  IF p_controller_protocol<>'cp-batch-v2' THEN
    RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','unsupported_controller_protocol','run_id',p_run_id);
  END IF;
  IF run.controller_lease_expires_at>now()
    AND run.controller_lease_token IS DISTINCT FROM p_controller_lease_token THEN
    RETURN jsonb_build_object('acquired',false,'action','wait_for_owner','reason','controller_lease_active',
      'run_id',p_run_id,'lease_expires_at',run.controller_lease_expires_at);
  END IF;
  IF run.admitted_repair_id IS NULL THEN
    IF run.current_task_id IS NOT NULL THEN
      UPDATE control.workflow_runs
      SET controller_lease_token=p_controller_lease_token,
        controller_lease_expires_at=now()+interval '5 minutes'
      WHERE run_id=p_run_id;
      SELECT * INTO current_task FROM control.tasks WHERE task_id=run.current_task_id FOR UPDATE;
      IF current_task.task_id IS NULL OR NOT control.task_publication_authority_is_current(current_task.task_id)
        OR EXISTS(SELECT 1 FROM control.task_dependencies dependency
          JOIN control.tasks parent ON parent.task_id=dependency.depends_on_task_id
          WHERE dependency.task_id=current_task.task_id AND dependency.dependency_type='hard' AND parent.status<>'complete')
        OR EXISTS(SELECT 1 FROM control.task_decisions link JOIN control.decisions decision
          ON decision.suit_slug=link.suit_slug AND decision.decision_id=link.decision_id
          WHERE link.task_id=current_task.task_id AND link.blocking AND decision.status<>'approved') THEN
        RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','ordinary_claim_missing_or_stale','run_id',p_run_id);
      END IF;
      IF current_task.status='complete' THEN
        RETURN jsonb_build_object('acquired',true,'action','credit_completion','reason','ordinary_completed_but_uncredited',
          'run_id',p_run_id,'task_id',current_task.task_id,'packet',control.generic_task_packet(current_task.task_id));
      END IF;
      IF current_task.status NOT IN('in_progress','verification','passed','failed') THEN
        RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','ordinary_task_not_resumable','run_id',p_run_id);
      END IF;
      RETURN jsonb_build_object('acquired',true,'action','resume','reason','ordinary_claim_resumed',
        'run_id',p_run_id,'task_id',current_task.task_id,'packet',control.generic_task_packet(current_task.task_id));
    END IF;
    ordinary_packet:=control.claim_next_task(run.suit_slug,p_source);
    IF ordinary_packet IS NULL THEN
      RETURN jsonb_build_object('acquired',false,'action','wait','reason','no_admitted_task','run_id',p_run_id);
    END IF;
    UPDATE control.workflow_runs
    SET current_task_id=ordinary_packet->'task'->>'task_id',
      controller_protocol=p_controller_protocol,
      controller_fingerprint=p_controller_fingerprint,
      controller_lease_token=p_controller_lease_token,
      controller_lease_expires_at=now()+interval '5 minutes',
      run_revision=run_revision+1
    WHERE run_id=p_run_id;
    RETURN jsonb_build_object('acquired',true,'action','execute','reason','ordinary_task_claimed',
      'run_id',p_run_id,'task_id',ordinary_packet->'task'->>'task_id','packet',ordinary_packet);
  END IF;
  IF run.controller_protocol IS DISTINCT FROM p_controller_protocol
    OR run.controller_fingerprint IS DISTINCT FROM p_controller_fingerprint THEN
    RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','controller_or_admission_mismatch','run_id',p_run_id);
  END IF;
  UPDATE control.workflow_runs
  SET controller_lease_token=p_controller_lease_token,
    controller_lease_expires_at=now()+interval '5 minutes'
  WHERE run_id=p_run_id;

  IF run.current_task_id IS NOT NULL THEN
    SELECT * INTO current_task FROM control.tasks WHERE task_id=run.current_task_id FOR UPDATE;
    PERFORM pg_advisory_xact_lock(hashtextextended('task-admission:'||run.current_task_id,0));
    IF current_task.task_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM control.batch_task_admissions admission
      JOIN control.task_admission_generations generation USING(task_id)
      JOIN control.publication_readiness_contracts contract USING(task_id)
      WHERE admission.repair_id=run.admitted_repair_id AND admission.run_id=run.run_id
        AND admission.task_id=run.current_task_id AND admission.status='claimed'
        AND admission.input_generation=generation.input_generation
        AND contract.valid AND contract.input_generation=generation.input_generation
        AND contract.contract_fingerprint=admission.contract_fingerprint
        AND admission.verification_fingerprint=control.verification_contract_fingerprint(admission.task_id)
        AND control.task_publication_authority_is_current(admission.task_id)
    ) THEN
      RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','attributed_claim_missing_or_stale','run_id',p_run_id);
    END IF;
    IF NOT control.task_hard_dependencies_complete(current_task.task_id) THEN
      UPDATE control.workflow_runs SET controller_lease_token=NULL,controller_lease_expires_at=NULL WHERE run_id=p_run_id;
      RETURN jsonb_build_object('acquired',false,'action','wait','reason','dependency_wait',
        'run_id',p_run_id,'task_id',current_task.task_id);
    END IF;
    IF NOT control.task_blocking_decisions_clear(current_task.task_id) THEN
      UPDATE control.workflow_runs SET controller_lease_token=NULL,controller_lease_expires_at=NULL WHERE run_id=p_run_id;
      RETURN jsonb_build_object('acquired',false,'action','wait','reason','decision_wait',
        'run_id',p_run_id,'task_id',current_task.task_id);
    END IF;
    IF current_task.status='complete' THEN
      RETURN jsonb_build_object('acquired',true,'action','credit_completion','reason','completed_but_uncredited',
        'run_id',p_run_id,'task_id',current_task.task_id,'packet',control.generic_task_packet(current_task.task_id));
    END IF;
    IF current_task.status NOT IN('in_progress','verification','passed','failed') THEN
      RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','attributed_task_not_resumable','run_id',p_run_id);
    END IF;
    recovery:=control.current_task_recovery_condition(current_task.task_id);
    IF recovery->>'lease_owner' IS NOT NULL
      AND NULLIF(recovery->>'lease_expires_at','')::timestamptz>now() THEN
      RETURN jsonb_build_object('acquired',false,'action','wait_for_owner','reason','supervisor_lease_active',
        'run_id',p_run_id,'task_id',current_task.task_id,'recovery',recovery);
    END IF;
    RETURN jsonb_build_object('acquired',true,'action','resume','reason','authoritative_claim_resumed',
      'run_id',p_run_id,'task_id',current_task.task_id,'packet',control.generic_task_packet(current_task.task_id),
      'recovery',recovery);
  END IF;
  SELECT admission.*,task.status AS task_status INTO selected
  FROM control.batch_task_admissions admission
  JOIN control.tasks task USING(task_id)
  WHERE admission.repair_id=run.admitted_repair_id AND admission.run_id=run.run_id
    AND admission.status='admitted' AND task.status IN('planned','ready')
  ORDER BY admission.ordinal FOR UPDATE OF admission,task LIMIT 1;
  IF NOT FOUND THEN
    UPDATE control.workflow_runs SET controller_lease_token=NULL,controller_lease_expires_at=NULL WHERE run_id=p_run_id;
    RETURN jsonb_build_object('acquired',false,'action','wait','reason','no_admitted_task','run_id',p_run_id);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('task-admission:'||selected.task_id,0));
  IF NOT EXISTS(
    SELECT 1 FROM control.batch_task_admissions admission
    JOIN control.task_admission_generations generation USING(task_id)
    JOIN control.publication_readiness_contracts contract USING(task_id)
    WHERE admission.repair_id=selected.repair_id AND admission.task_id=selected.task_id
      AND admission.status='admitted' AND admission.input_generation=generation.input_generation
      AND contract.valid AND contract.input_generation=generation.input_generation
      AND contract.contract_fingerprint=admission.contract_fingerprint
      AND admission.verification_fingerprint=control.verification_contract_fingerprint(admission.task_id)
      AND control.task_publication_authority_is_current(admission.task_id)
  ) THEN RETURN jsonb_build_object('acquired',false,'action','safety_stop','reason','admission_changed_during_claim'); END IF;
  IF NOT control.task_hard_dependencies_complete(selected.task_id) THEN
    UPDATE control.workflow_runs SET controller_lease_token=NULL,controller_lease_expires_at=NULL WHERE run_id=p_run_id;
    RETURN jsonb_build_object('acquired',false,'action','wait','reason','dependency_wait',
      'run_id',p_run_id,'task_id',selected.task_id,'ordinal',selected.ordinal);
  END IF;
  IF NOT control.task_blocking_decisions_clear(selected.task_id) THEN
    UPDATE control.workflow_runs SET controller_lease_token=NULL,controller_lease_expires_at=NULL WHERE run_id=p_run_id;
    RETURN jsonb_build_object('acquired',false,'action','wait','reason','decision_wait',
      'run_id',p_run_id,'task_id',selected.task_id,'ordinal',selected.ordinal);
  END IF;
  UPDATE control.tasks SET status='in_progress' WHERE task_id=selected.task_id;
  UPDATE control.batch_task_admissions SET status='claimed',updated_at=now()
    WHERE repair_id=selected.repair_id AND task_id=selected.task_id;
  UPDATE control.workflow_runs SET current_task_id=selected.task_id,run_revision=run_revision+1 WHERE run_id=p_run_id;
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(selected.task_id,'task_claimed',selected.task_status,'in_progress',p_source,
    jsonb_build_object('run_id',p_run_id,'repair_id',selected.repair_id,'ordinal',selected.ordinal));
  RETURN jsonb_build_object('acquired',true,'action','execute','reason','new_admitted_task_claimed',
    'run_id',p_run_id,'task_id',selected.task_id,
    'packet',control.generic_task_packet(selected.task_id));
END;
$$;

CREATE OR REPLACE FUNCTION control.claim_next_task(
  p_suit_slug text,
  p_source text DEFAULT 'n8n'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE selected_task control.tasks%ROWTYPE;
DECLARE active_run control.workflow_runs%ROWTYPE;
BEGIN
  IF p_source NOT IN('system','n8n','runner','human','chatgpt') THEN
    RAISE EXCEPTION 'Unsupported task claim source: %',p_source;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('building-suit-control:'||p_suit_slug,0));
  SELECT * INTO active_run FROM control.workflow_runs
  WHERE suit_slug=p_suit_slug AND status='running' FOR UPDATE;
  IF FOUND AND active_run.maintenance_requested THEN
    RAISE EXCEPTION 'workflow_run_maintenance_requested';
  END IF;
  IF FOUND AND active_run.admitted_repair_id IS NOT NULL THEN
    RAISE EXCEPTION 'workflow_run_owned_claim_required';
  END IF;
  SELECT task.* INTO selected_task
  FROM control.ready_tasks task
  WHERE task.suit_slug=p_suit_slug
    AND control.task_publication_authority_is_current(task.task_id)
  ORDER BY task.priority,task.sequence,task.created_at
  FOR UPDATE OF task SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('task-admission:'||selected_task.task_id,0));
  IF NOT control.task_publication_authority_is_current(selected_task.task_id) THEN
    RAISE EXCEPTION 'task_admission_changed_during_claim';
  END IF;
  UPDATE control.tasks SET status='in_progress' WHERE task_id=selected_task.task_id;
  INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload)
  VALUES(selected_task.task_id,'task_claimed',selected_task.status,'in_progress',p_source,
    jsonb_build_object('suit_slug',p_suit_slug,'authoritative_admission',true));
  RETURN control.generic_task_packet(selected_task.task_id);
END;
$$;

CREATE OR REPLACE FUNCTION control.record_workflow_task_success(p_run_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE run control.workflow_runs%ROWTYPE;
DECLARE new_count integer;
BEGIN
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown workflow run: %',p_run_id; END IF;
  IF run.admitted_repair_id IS NOT NULL OR run.current_task_id IS NOT NULL THEN
    RAISE EXCEPTION 'task_attribution_and_idempotency_key_required';
  END IF;
  IF run.status<>'running' THEN
    RETURN jsonb_build_object('run_id',run.run_id,'status',run.status,'completed_tasks',run.completed_tasks,
      'max_tasks',run.max_tasks,'should_continue',false,'reason',run.status);
  END IF;
  new_count:=run.completed_tasks+1;
  UPDATE control.workflow_runs
  SET completed_tasks=new_count,
    status=CASE WHEN stop_requested THEN 'stopped' WHEN new_count>=max_tasks THEN 'limit_reached' ELSE status END,
    finished_at=CASE WHEN stop_requested OR new_count>=max_tasks THEN now() ELSE finished_at END
  WHERE run_id=p_run_id;
  RETURN jsonb_build_object('run_id',run.run_id,
    'status',CASE WHEN run.stop_requested THEN 'stopped' WHEN new_count>=run.max_tasks THEN 'limit_reached' ELSE 'running' END,
    'completed_tasks',new_count,'max_tasks',run.max_tasks,
    'should_continue',NOT run.stop_requested AND new_count<run.max_tasks,
    'reason',CASE WHEN run.stop_requested THEN 'stop_requested' WHEN new_count>=run.max_tasks THEN 'limit_reached' ELSE 'continue' END,
    'legacy_unattributed',true);
END;
$$;

CREATE OR REPLACE FUNCTION control.record_workflow_task_success(
  p_run_id uuid,
  p_task_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE run control.workflow_runs%ROWTYPE;
DECLARE existing control.workflow_run_task_credits%ROWTYPE;
DECLARE new_count integer;
BEGIN
  SELECT * INTO run FROM control.workflow_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown workflow run: %',p_run_id; END IF;
  SELECT * INTO existing FROM control.workflow_run_task_credits WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF existing.run_id<>p_run_id OR existing.task_id<>p_task_id THEN RAISE EXCEPTION 'Completion idempotency conflict'; END IF;
    RETURN jsonb_build_object('run_id',p_run_id,'task_id',p_task_id,'completed_tasks',run.completed_tasks,'idempotent',true);
  END IF;
  SELECT * INTO existing FROM control.workflow_run_task_credits WHERE run_id=p_run_id AND task_id=p_task_id;
  IF FOUND THEN
    RETURN jsonb_build_object('run_id',p_run_id,'task_id',p_task_id,'completed_tasks',run.completed_tasks,'idempotent',true);
  END IF;
  IF run.status<>'running' OR run.current_task_id IS DISTINCT FROM p_task_id OR run.completed_tasks>=run.max_tasks
    OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task_id AND status='complete') THEN
    RAISE EXCEPTION 'Run/task completion state is not creditable';
  END IF;
  INSERT INTO control.workflow_run_task_credits(run_id,task_id,idempotency_key) VALUES(p_run_id,p_task_id,p_idempotency_key);
  IF run.admitted_repair_id IS NOT NULL THEN
    UPDATE control.batch_task_admissions SET status='completed',updated_at=now()
      WHERE repair_id=run.admitted_repair_id AND run_id=p_run_id AND task_id=p_task_id AND status='claimed';
    IF NOT FOUND THEN RAISE EXCEPTION 'Task is not the attributed admitted claim'; END IF;
  END IF;
  new_count:=run.completed_tasks+1;
  UPDATE control.workflow_runs SET completed_tasks=new_count,current_task_id=NULL,run_revision=run_revision+1,
    controller_lease_token=NULL,controller_lease_expires_at=NULL,
    status=CASE WHEN new_count>=max_tasks THEN 'limit_reached' ELSE status END,
    finished_at=CASE WHEN new_count>=max_tasks THEN now() ELSE finished_at END
  WHERE run_id=p_run_id;
  RETURN jsonb_build_object('run_id',p_run_id,'task_id',p_task_id,'completed_tasks',new_count,
    'max_tasks',run.max_tasks,'idempotent',false,'should_continue',new_count<run.max_tasks AND NOT run.stop_requested AND NOT run.maintenance_requested);
END;
$$;

CREATE OR REPLACE FUNCTION control.start_workflow_run(p_suit_slug text,p_max_tasks integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE existing_run control.workflow_runs%ROWTYPE;
DECLARE new_run control.workflow_runs%ROWTYPE;
DECLARE workstream control.workstreams%ROWTYPE;
DECLARE safety_bound integer;
BEGIN
  SELECT * INTO workstream FROM control.workstreams WHERE suit_slug=p_suit_slug AND active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or inactive workstream: %',p_suit_slug; END IF;
  SELECT COALESCE((concurrency_policy->>'max_run_tasks')::integer,20) INTO safety_bound
    FROM control.projects WHERE project_id=workstream.project_id AND active=true;
  IF safety_bound IS NULL OR p_max_tasks<1 OR p_max_tasks>safety_bound THEN
    RAISE EXCEPTION 'max_tasks is outside the active project safety bound';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('automation-run:'||workstream.project_id::text||':'||workstream.slug,0));
  SELECT * INTO existing_run FROM control.workflow_runs WHERE suit_slug=p_suit_slug AND status='running' FOR UPDATE;
  IF FOUND THEN
    IF existing_run.max_tasks<>p_max_tasks THEN
      UPDATE control.workflow_runs SET maintenance_requested=true,run_revision=run_revision+1
      WHERE run_id=existing_run.run_id RETURNING * INTO existing_run;
    END IF;
    RETURN jsonb_build_object('started',false,
      'reason',CASE WHEN existing_run.max_tasks=p_max_tasks THEN 'run_already_active' ELSE 'active_run_budget_reconciliation_required' END,
      'run_id',existing_run.run_id,'suit_slug',existing_run.suit_slug,'max_tasks',existing_run.max_tasks,
      'requested_max_tasks',p_max_tasks,'completed_tasks',existing_run.completed_tasks,
      'requires_explicit_reconciliation',existing_run.max_tasks<>p_max_tasks);
  END IF;
  INSERT INTO control.workflow_runs(suit_slug,project_id,workstream_slug,max_tasks)
  VALUES(p_suit_slug,workstream.project_id,workstream.slug,p_max_tasks) RETURNING * INTO new_run;
  RETURN jsonb_build_object('started',true,'reason','started','run_id',new_run.run_id,
    'suit_slug',new_run.suit_slug,'max_tasks',new_run.max_tasks,'completed_tasks',new_run.completed_tasks,
    'status',new_run.status,'should_continue',true);
END;
$$;

CREATE OR REPLACE FUNCTION control.revoke_batch_readiness_repair(
  p_repair_id text,
  p_source text DEFAULT 'human'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE repair control.batch_repair_generations%ROWTYPE;
DECLARE entry record;
DECLARE expected_task_ids text[] := ARRAY[
  'BS-UI-ZN-DATA-001','BS-UI-ZN-PATTERNS-001','BS-UI-ZN-LEDGER-001','BS-UI-ZN-SHOP-001',
  'BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-GENERATOR-001','BS-UI-ZN-BROWSER-001','BS-UI-ZN-FINAL-001',
  'SS-SA-EVIDENCE-001','SS-SA-CUSTOM-OFFER-001','SAS-M1-CONFIG-001','SAS-M1-AUTH-001'];
BEGIN
  IF p_source<>'human' THEN RAISE EXCEPTION 'Repair rollback requires human source'; END IF;
  SELECT * INTO repair FROM control.batch_repair_generations WHERE repair_id=p_repair_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown repair'; END IF;
  IF repair.status='revoked' THEN RETURN to_jsonb(repair)||jsonb_build_object('idempotent',true); END IF;
  IF repair.status<>'applied' THEN RAISE EXCEPTION 'Only an applied repair can be rolled back'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_each(repair.after_state->'workstreams') expected
    LEFT JOIN control.workstreams workstream ON workstream.slug=expected.key
      AND workstream.project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit')
    WHERE workstream.verification_config IS DISTINCT FROM expected.value
  ) THEN RAISE EXCEPTION 'Independent registry drift prevents rollback'; END IF;
  IF EXISTS(SELECT 1 FROM control.workflow_runs WHERE admitted_repair_id=p_repair_id
    AND status='running' AND (maintenance_requested<>true OR current_task_id IS NOT NULL
      OR controller_lease_expires_at>now())) THEN
    RAISE EXCEPTION 'Rollback requires maintenance acknowledgement and quiescent run leases';
  END IF;
  UPDATE control.workflow_runs SET maintenance_requested=true,run_revision=run_revision+1
    WHERE admitted_repair_id=p_repair_id AND status='running';
  UPDATE control.batch_task_admissions SET status='revoked',updated_at=now()
    WHERE repair_id=p_repair_id AND status<>'completed';
  FOR entry IN SELECT key,value FROM jsonb_each(repair.before_state->'workstreams') ORDER BY key
  LOOP
    UPDATE control.workstreams SET verification_config=entry.value
      WHERE slug=entry.key AND project_id=(SELECT project_id FROM control.projects WHERE slug='building-suit');
  END LOOP;
  PERFORM control.refresh_publication_readiness_contract(task.task_id,'CP-BATCH-READY-001-rollback')
    FROM control.tasks task
    WHERE task.task_id=ANY(expected_task_ids) AND task.status NOT IN('complete','cancelled') ORDER BY task.task_id;
  UPDATE control.batch_repair_generations SET status='revoked',revoked_at=now() WHERE repair_id=p_repair_id RETURNING * INTO repair;
  RETURN to_jsonb(repair)||jsonb_build_object('resumed',false,'run_ids_preserved',true);
END;
$$;

DO $do$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_app') THEN
    GRANT SELECT,INSERT,UPDATE ON control.task_admission_generations,control.batch_repair_generations,
      control.batch_task_admissions,control.workflow_run_task_credits TO bs_control_app;
    GRANT EXECUTE ON FUNCTION control.publication_contract_is_current(text),
      control.task_publication_authority_is_current(text),control.task_hard_dependencies_complete(text),
      control.task_blocking_decisions_clear(text),control.task_execution_admission(text),
      control.verification_contract_fingerprint(text),control.acquire_workflow_run_task(uuid,text,text,text,text),
      control.start_execution(text,text,text,text,text,text,text,text),
      control.record_workflow_task_success(uuid,text,text),control.record_workflow_task_success(uuid) TO bs_control_app;
  END IF;
END
$do$;

COMMIT;
