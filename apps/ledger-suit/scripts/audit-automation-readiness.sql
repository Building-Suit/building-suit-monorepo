-- Run against the Automation control database, never the Ledger business DB.
-- Example: psql -X -Atq -v ON_ERROR_STOP=1 "$AUTOMATION_DATABASE_URL" \
--   -f apps/ledger-suit/scripts/audit-automation-readiness.sql > ledger-automation.json
-- Read-only, consistent snapshot; does not acquire/dispatch/retry any task.
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH ledger_tasks AS (
  SELECT task_id, title, description, status, priority, sequence,
         acceptance_criteria, verification_plan
  FROM control.tasks WHERE suit_slug = 'ledger-suit'
), latest_executions AS (
  SELECT DISTINCT ON (e.task_id) e.task_id, e.execution_id, e.attempt, e.status
  FROM control.executions e JOIN ledger_tasks t USING (task_id)
  ORDER BY e.task_id, e.attempt DESC, e.execution_id DESC
)
SELECT jsonb_build_object(
  'observed_at', transaction_timestamp(),
  'database', current_database(),
  'read_only', current_setting('transaction_read_only'),
  'tasks', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY priority, sequence, task_id), '[]') FROM ledger_tasks t),
  'requirements', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'requirement_id', r.requirement_id, 'status', r.status,
    'task_ids', (SELECT coalesce(jsonb_agg(tr.task_id ORDER BY tr.task_id), '[]')
                 FROM control.task_requirements tr
                 WHERE tr.suit_slug = r.suit_slug AND tr.requirement_id = r.requirement_id)
  ) ORDER BY r.requirement_id), '[]') FROM control.requirements r WHERE r.suit_slug = 'ledger-suit'),
  'dependencies', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.task_id, d.depends_on_task_id), '[]')
                   FROM control.task_dependencies d JOIN ledger_tasks t USING (task_id)),
  'decisions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'decision_id', d.decision_id, 'status', d.status, 'title', d.title
  ) ORDER BY d.decision_id), '[]') FROM control.decisions d WHERE d.suit_slug = 'ledger-suit'),
  'latest_executions', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.task_id), '[]') FROM latest_executions e),
  'latest_verification', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'task_id', e.task_id, 'execution_id', e.execution_id, 'check_name', v.check_name,
    'status', v.status, 'exit_code', v.exit_code
  ) ORDER BY e.task_id, v.verification_id), '[]')
  FROM control.verification_results v JOIN latest_executions e USING (execution_id)),
  'runs', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'run_id', r.run_id, 'status', r.status, 'completed_tasks', r.completed_tasks,
    'max_tasks', r.max_tasks, 'stop_requested', r.stop_requested, 'updated_at', r.updated_at
  ) ORDER BY r.updated_at DESC), '[]') FROM control.workflow_runs r WHERE r.suit_slug = 'ledger-suit')
);
ROLLBACK;
