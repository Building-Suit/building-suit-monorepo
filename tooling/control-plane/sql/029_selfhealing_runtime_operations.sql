BEGIN;
-- Additive runtime journal. Historical product executions are untouched.
CREATE TABLE IF NOT EXISTS control.runtime_operations (
  operation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES control.tasks(task_id),
  workflow_run_id uuid REFERENCES control.workflow_runs(run_id),
  action text NOT NULL CHECK (action IN ('task-run','task-retry','task-verify','task-publish','task-prepare')),
  execution_id bigint REFERENCES control.executions(execution_id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','settled','consumed')),
  descriptor jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  infra_retries integer NOT NULL DEFAULT 0 CHECK (infra_retries >= 0),
  next_wake_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS runtime_operations_one_unfinished_task
 ON control.runtime_operations(task_id) WHERE status IN ('pending','running','settled');
-- Existing classes/actions remain canonical. Product implementation failures
-- use the existing verification-product-defect repair class.
CREATE OR REPLACE FUNCTION control.claim_runtime_operation(
 p_task_id text, p_action text, p_execution_id bigint, p_descriptor jsonb,
 p_owner text, p_token text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE op control.runtime_operations%ROWTYPE;
DECLARE run control.workflow_runs%ROWTYPE;
BEGIN
 PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown task'; END IF;
 SELECT * INTO run FROM control.workflow_runs WHERE current_task_id=p_task_id AND status='running' ORDER BY started_at DESC LIMIT 1;
 IF run.run_id IS NOT NULL AND (run.stop_requested OR run.maintenance_requested OR run.completed_tasks>=run.max_tasks) THEN
  RETURN jsonb_build_object('acquired',false,'reason','workflow_run_held');
 END IF;
 SELECT * INTO op FROM control.runtime_operations WHERE task_id=p_task_id AND status IN ('pending','running','settled') FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('acquired',true,'existing',true,'operation',to_jsonb(op)); END IF;
 INSERT INTO control.runtime_operations(task_id,workflow_run_id,action,execution_id,descriptor,lease_owner,lease_token,lease_expires_at)
 VALUES(p_task_id,run.run_id,p_action,p_execution_id,p_descriptor,p_owner,p_token,now()+interval '80 minutes') RETURNING * INTO op;
 RETURN jsonb_build_object('acquired',true,'existing',false,'operation',to_jsonb(op));
END $$;
CREATE OR REPLACE FUNCTION control.runtime_recovery_candidates(p_limit integer DEFAULT 10)
 RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(candidate)),'[]'::jsonb) FROM (
  SELECT r.run_id,r.current_task_id,r.suit_slug,r.max_tasks,r.completed_tasks,
   r.controller_lease_expires_at, s.next_action,s.failure_class,s.next_wake_at,s.lease_owner,s.lease_expires_at,
   o.operation_id,o.status AS operation_status,o.next_wake_at AS operation_wake
  FROM control.workflow_runs r
  LEFT JOIN control.recovery_states s ON s.resume_identity='task:'||r.current_task_id
  LEFT JOIN control.runtime_operations o ON o.task_id=r.current_task_id AND o.status IN ('pending','running','settled')
  WHERE r.status='running' AND r.current_task_id IS NOT NULL AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
  AND s.next_action IS DISTINCT FROM 'safety-stop'
  AND (s.status IS DISTINCT FROM 'active' OR s.next_action NOT IN ('wait-operator','wait-decision','safety-stop'))
  AND (o.operation_id IS NOT NULL OR s.next_wake_at IS NULL OR s.next_wake_at<=now())
  ORDER BY r.started_at LIMIT greatest(1,least(p_limit,25))
 ) candidate;
$$;
-- Ensure semantics preserve an incomplete attributed terminal/stopped run.
-- A new bounded run is permitted only after the old attributed task settled.
CREATE OR REPLACE FUNCTION control.ensure_workflow_run(p_suit_slug text,p_max_tasks integer)
 RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE previous control.workflow_runs%ROWTYPE;
BEGIN
 PERFORM 1 FROM control.suits WHERE slug=p_suit_slug FOR UPDATE;
 SELECT r.* INTO previous FROM control.workflow_runs r
 JOIN control.tasks t ON t.task_id=r.current_task_id
 WHERE r.suit_slug=p_suit_slug AND t.status NOT IN ('complete','cancelled')
 ORDER BY r.started_at DESC LIMIT 1;
 IF FOUND THEN
  RETURN jsonb_build_object('started',false,'reason',CASE WHEN previous.status='running' THEN 'run_already_active' ELSE 'existing_run_terminal_gate' END,
   'run_id',previous.run_id,'status',previous.status,'max_tasks',previous.max_tasks,'completed_tasks',previous.completed_tasks,
   'current_task_id',previous.current_task_id,'maintenance_requested',previous.maintenance_requested,'stop_requested',previous.stop_requested);
 END IF;
 RETURN control.start_workflow_run(p_suit_slug,p_max_tasks);
END $$;

-- The installed app role already owns existing runtime transitions; grant only
-- this compatible journal to it when that role exists.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_app') THEN
  GRANT SELECT,INSERT,UPDATE ON control.runtime_operations TO bs_control_app;
  GRANT EXECUTE ON FUNCTION control.claim_runtime_operation(text,text,bigint,jsonb,text,text), control.runtime_recovery_candidates(integer) TO bs_control_app;
 END IF;
END $$;
COMMIT;
