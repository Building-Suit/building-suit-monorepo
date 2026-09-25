import type {
  DashboardResponse,
  DecisionRow,
  ExecutionRow,
  PullRequestRow,
  RuntimeExecutionRow,
  SuitRow,
  TaskEventRow,
  TaskRow,
  VerificationRow,
  WorkflowRunRow,
} from '../../types/dashboard'
import { buildIncidents } from '../utils/incidents'
import { useControlDb } from '../utils/controlDb'

function normalizeSuit(raw: unknown) {
  const suit = String(raw ?? '').trim()
  if (!suit) return null
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(suit)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Suit filter' })
  }
  return suit
}

export default defineEventHandler(async (event): Promise<DashboardResponse> => {
  const sql = useControlDb()
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const suit = normalizeSuit(query.suit)

  const [databaseRows, suitRows, summaryRows, taskRows, workflowRunRows, executionRows, verificationRows, decisionRows, pullRequestRows, eventRows, runtimeTableRows] = await Promise.all([
    sql`
      SELECT
        current_database()::text AS database,
        current_user::text AS user,
        inet_server_addr()::text AS server_addr,
        inet_server_port()::int AS server_port
    `,
    sql`
      SELECT slug, display_name, status, updated_at
      FROM control.suits
      ORDER BY display_name, slug
    `,
    sql`
      SELECT
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})) AS total_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status IN ('passed','complete')) AS finished_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status NOT IN ('passed','complete','cancelled')) AS unfinished_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status = 'in_progress') AS in_progress_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status = 'verification') AS verification_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status = 'blocked') AS blocked_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status = 'failed') AS failed_tasks,
        (SELECT count(*)::int FROM control.tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit}) AND t.status = 'planned') AS planned_tasks,
        (SELECT count(*)::int FROM control.ready_tasks t WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})) AS ready_tasks,
        (
          SELECT count(DISTINCT (d.suit_slug, d.decision_id))::int
          FROM control.decisions d
          JOIN control.task_decisions td
            ON td.suit_slug = d.suit_slug
           AND td.decision_id = d.decision_id
           AND td.blocking = true
          JOIN control.tasks t ON t.task_id = td.task_id
          WHERE d.status = 'open'
            AND (${suit}::text IS NULL OR d.suit_slug = ${suit})
        ) AS open_blocking_decisions,
        (SELECT count(*)::int FROM control.workflow_runs r WHERE (${suit}::text IS NULL OR r.suit_slug = ${suit}) AND r.status = 'running') AS running_workflows,
        (
          SELECT count(*)::int
          FROM control.executions e
          JOIN control.tasks t ON t.task_id = e.task_id
          WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})
            AND e.status = 'running'
        ) AS running_executions
    `,
    sql`
      SELECT
        task_id, suit_slug, sequence, priority, title, task_type,
        risk_level, model_profile, status, updated_at, metadata
      FROM control.tasks
      WHERE (${suit}::text IS NULL OR suit_slug = ${suit})
      ORDER BY
        CASE status
          WHEN 'failed' THEN 1
          WHEN 'blocked' THEN 2
          WHEN 'in_progress' THEN 3
          WHEN 'verification' THEN 4
          WHEN 'passed' THEN 5
          WHEN 'planned' THEN 6
          ELSE 7
        END,
        priority,
        sequence,
        task_id
      LIMIT 600
    `,
    sql`
      SELECT run_id, suit_slug, max_tasks, completed_tasks, stop_requested,
             status, started_at, finished_at, updated_at
      FROM control.workflow_runs
      WHERE (${suit}::text IS NULL OR suit_slug = ${suit})
      ORDER BY started_at DESC, updated_at DESC
      LIMIT 120
    `,
    sql`
      SELECT
        e.execution_id, e.task_id, t.suit_slug, e.attempt, e.model_profile,
        e.model_name, e.reasoning_effort, e.status, e.worktree_path,
        e.branch_name, e.parent_branch, e.parent_sha, e.commit_sha,
        e.started_at, e.finished_at, e.created_at, e.metadata,
        e.engine_stage,e.resolved_retry_policy,e.prompt_path,e.run_log_path,e.usage
      FROM control.executions e
      JOIN control.tasks t ON t.task_id = e.task_id
      WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})
      ORDER BY e.created_at DESC, e.execution_id DESC
      LIMIT 160
    `,
    sql`
      SELECT
        v.verification_id, v.verification_run_id, v.execution_id, e.task_id, t.suit_slug,
        v.check_name, v.command, v.status, v.exit_code, v.summary,
        v.queued_at,v.started_at, v.finished_at, v.elapsed_ms,v.created_at, v.metadata
      FROM control.verification_results v
      JOIN control.executions e ON e.execution_id = v.execution_id
      JOIN control.tasks t ON t.task_id = e.task_id
      WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})
      ORDER BY v.created_at DESC, v.verification_id DESC
      LIMIT 300
    `,
    sql`
      SELECT
        d.suit_slug, d.decision_id, d.title, d.decision_text,
        d.status, d.source, d.updated_at,
        count(td.task_id) FILTER (WHERE td.blocking = true)::int AS blocking_tasks
      FROM control.decisions d
      LEFT JOIN control.task_decisions td
        ON td.suit_slug = d.suit_slug
       AND td.decision_id = d.decision_id
      WHERE (${suit}::text IS NULL OR d.suit_slug = ${suit})
      GROUP BY d.suit_slug, d.decision_id, d.title, d.decision_text,
               d.status, d.source, d.updated_at
      ORDER BY
        CASE d.status WHEN 'open' THEN 1 ELSE 2 END,
        d.updated_at DESC,
        d.decision_id
      LIMIT 200
    `,
    sql`
      SELECT
        p.pull_request_id, p.task_id, t.suit_slug, p.repository, p.pr_number,
        p.head_branch, p.base_branch, p.state, p.is_draft, p.url,
        p.head_sha, p.merge_sha, p.updated_at, p.metadata
      FROM control.pull_requests p
      LEFT JOIN control.tasks t ON t.task_id = p.task_id
      WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})
      ORDER BY p.updated_at DESC, p.pull_request_id DESC
      LIMIT 180
    `,
    sql`
      SELECT
        ev.event_id, ev.task_id, t.suit_slug, ev.event_type,
        ev.from_status, ev.to_status, ev.source, ev.payload, ev.created_at
      FROM control.task_events ev
      JOIN control.tasks t ON t.task_id = ev.task_id
      WHERE (${suit}::text IS NULL OR t.suit_slug = ${suit})
      ORDER BY ev.created_at DESC, ev.event_id DESC
      LIMIT 350
    `,
    sql`SELECT to_regclass('control.n8n_runtime_executions') IS NOT NULL AS available`,
  ])

  const runtimeTelemetryAvailable = Boolean(runtimeTableRows[0]?.available)
  const runtimeExecutions = runtimeTelemetryAvailable
    ? await sql`
        SELECT
          n8n_execution_id, workflow_id, workflow_name, run_id,
          suit_slug, task_id, runtime_status, current_node, current_stage,
          started_at, last_heartbeat_at, finished_at, error_code,
          error_message, metadata, observed_at
        FROM control.n8n_runtime_executions
        WHERE (${suit}::text IS NULL OR suit_slug = ${suit})
        ORDER BY observed_at DESC, n8n_execution_id DESC
        LIMIT 150
      `
    : []

  const tasks = taskRows as unknown as TaskRow[]
  const workflowRuns = workflowRunRows as unknown as WorkflowRunRow[]
  const executions = executionRows as unknown as ExecutionRow[]
  const verificationResults = verificationRows as unknown as VerificationRow[]
  const decisions = decisionRows as unknown as DecisionRow[]
  const pullRequests = pullRequestRows as unknown as PullRequestRow[]
  const events = eventRows as unknown as TaskEventRow[]
  const runtime = runtimeExecutions as unknown as RuntimeExecutionRow[]

  const incidents = buildIncidents({
    tasks,
    workflowRuns,
    executions,
    verificationResults,
    decisions,
    pullRequests,
    events,
    runtimeExecutions: runtime,
    runtimeTelemetryAvailable,
    staleTaskMinutes: Number(config.staleTaskMinutes || 20),
    staleExecutionMinutes: Number(config.staleExecutionMinutes || 60),
    runtimeHeartbeatSeconds: Number(config.runtimeHeartbeatSeconds || 120),
  })

  const db = databaseRows[0] ?? {}

  return {
    generatedAt: new Date().toISOString(),
    selectedSuit: suit,
    database: {
      database: String(db.database ?? ''),
      user: String(db.user ?? ''),
      server_addr: db.server_addr == null ? null : String(db.server_addr),
      server_port: db.server_port == null ? null : Number(db.server_port),
    },
    runtimeTelemetryAvailable,
    summary: summaryRows[0] as DashboardResponse['summary'],
    suits: suitRows as unknown as SuitRow[],
    tasks,
    workflowRuns,
    executions,
    verificationResults,
    decisions,
    pullRequests,
    events,
    runtimeExecutions: runtime,
    incidents,
  }
})
