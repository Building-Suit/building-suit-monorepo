import type {
  DecisionRow,
  ExecutionRow,
  Incident,
  PullRequestRow,
  RuntimeExecutionRow,
  TaskEventRow,
  TaskRow,
  VerificationRow,
  WorkflowRunRow,
} from '../../types/dashboard'

function ageMinutes(value: string | null | undefined, now: number) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, (now - timestamp) / 60_000)
}

function jsonText(value: unknown) {
  try {
    return JSON.stringify(value ?? {}).toLowerCase()
  } catch {
    return String(value ?? '').toLowerCase()
  }
}

function incident(input: Incident): Incident {
  return input
}

export function buildIncidents(input: {
  tasks: TaskRow[]
  workflowRuns: WorkflowRunRow[]
  executions: ExecutionRow[]
  verificationResults: VerificationRow[]
  decisions: DecisionRow[]
  pullRequests: PullRequestRow[]
  events: TaskEventRow[]
  runtimeExecutions: RuntimeExecutionRow[]
  runtimeTelemetryAvailable: boolean
  staleTaskMinutes: number
  staleExecutionMinutes: number
  runtimeHeartbeatSeconds: number
}) {
  const now = Date.now()
  const incidents: Incident[] = []
  const executionById = new Map(input.executions.map(row => [String(row.execution_id), row]))
  const latestExecutionByTask = new Map<string, ExecutionRow>()
  const pullRequestsByTask = new Map<string, PullRequestRow[]>()

  for (const row of input.executions) {
    const current = latestExecutionByTask.get(row.task_id)
    if (!current || row.attempt > current.attempt) latestExecutionByTask.set(row.task_id, row)
  }

  for (const row of input.pullRequests) {
    if (!row.task_id) continue
    const rows = pullRequestsByTask.get(row.task_id) ?? []
    rows.push(row)
    pullRequestsByTask.set(row.task_id, rows)
  }

  for (const task of input.tasks) {
    if (task.status === 'failed') {
      incidents.push(incident({
        id: `task-failed:${task.task_id}`,
        severity: 'critical',
        kind: 'task_failed',
        title: `${task.task_id} failed`,
        detail: task.title,
        recovery: 'Keep recovery on this task. Inspect the latest execution, verification evidence, and task events before dispatching another task.',
        suit_slug: task.suit_slug,
        task_id: task.task_id,
        run_id: null,
        execution_id: latestExecutionByTask.get(task.task_id)?.execution_id ?? null,
        occurred_at: task.updated_at,
        evidence: { status: task.status, risk_level: task.risk_level },
      }))
    }

    if (task.status === 'blocked') {
      incidents.push(incident({
        id: `task-blocked:${task.task_id}`,
        severity: 'warning',
        kind: 'task_blocked',
        title: `${task.task_id} is blocked`,
        detail: task.title,
        recovery: 'Resolve the documented blocker or decision. Do not silently advance the Suit around this task.',
        suit_slug: task.suit_slug,
        task_id: task.task_id,
        run_id: null,
        execution_id: latestExecutionByTask.get(task.task_id)?.execution_id ?? null,
        occurred_at: task.updated_at,
        evidence: { status: task.status, risk_level: task.risk_level },
      }))
    }

    if (task.status === 'in_progress') {
      const latest = latestExecutionByTask.get(task.task_id)
      const stale = ageMinutes(task.updated_at, now) >= input.staleTaskMinutes
      if (stale && (!latest || latest.status !== 'running')) {
        incidents.push(incident({
          id: `stale-task:${task.task_id}`,
          severity: 'warning',
          kind: 'stale_task_state',
          title: `${task.task_id} may be stuck in progress`,
          detail: `Control-plane task state is in_progress, but there is no running execution and it has not changed for at least ${input.staleTaskMinutes} minutes.`,
          recovery: 'Inspect the last task event and execution. Reconcile the interrupted task before creating a new execution or advancing the Suit.',
          suit_slug: task.suit_slug,
          task_id: task.task_id,
          run_id: null,
          execution_id: latest?.execution_id ?? null,
          occurred_at: task.updated_at,
          evidence: { task_status: task.status, latest_execution_status: latest?.status ?? null },
        }))
      }
    }

    if (task.status === 'passed') {
      const prs = pullRequestsByTask.get(task.task_id) ?? []
      if (!prs.some(row => row.state === 'open') && ageMinutes(task.updated_at, now) >= input.staleTaskMinutes) {
        incidents.push(incident({
          id: `publication-pending:${task.task_id}`,
          severity: 'warning',
          kind: 'publication_pending',
          title: `${task.task_id} passed but has no open publication PR`,
          detail: 'Verification passed, but publication has not completed and no open PR is recorded for the task.',
          recovery: 'Resume publication for this same task. Do not consume it as a completed hard dependency until publication succeeds.',
          suit_slug: task.suit_slug,
          task_id: task.task_id,
          run_id: null,
          execution_id: latestExecutionByTask.get(task.task_id)?.execution_id ?? null,
          occurred_at: task.updated_at,
          evidence: { task_status: task.status, recorded_prs: prs.length },
        }))
      }
    }
  }

  for (const run of input.workflowRuns) {
    if (run.status === 'failed') {
      incidents.push(incident({
        id: `workflow-failed:${run.run_id}`,
        severity: 'critical',
        kind: 'workflow_run_failed',
        title: `${run.suit_slug} workflow run failed`,
        detail: `Run ${run.run_id} stopped after ${run.completed_tasks}/${run.max_tasks} tasks.`,
        recovery: 'Inspect the affected task and latest task event. Resume from the failed bounded task rather than starting unrelated work.',
        suit_slug: run.suit_slug,
        task_id: null,
        run_id: run.run_id,
        execution_id: null,
        occurred_at: run.finished_at || run.updated_at,
        evidence: { completed_tasks: run.completed_tasks, max_tasks: run.max_tasks },
      }))
    }
  }

  for (const row of input.executions) {
    if (row.status === 'running' && ageMinutes(row.started_at || row.created_at, now) >= input.staleExecutionMinutes) {
      incidents.push(incident({
        id: `execution-long-running:${row.execution_id}`,
        severity: 'warning',
        kind: 'long_running_execution',
        title: `Execution ${row.execution_id} has been running for a long time`,
        detail: `${row.task_id} has exceeded the ${input.staleExecutionMinutes}-minute dashboard threshold.`,
        recovery: 'Check the runner/n8n runtime observation and process state before assuming the task is still executing.',
        suit_slug: row.suit_slug,
        task_id: row.task_id,
        run_id: null,
        execution_id: row.execution_id,
        occurred_at: row.started_at || row.created_at,
        evidence: { attempt: row.attempt, branch_name: row.branch_name },
      }))
    }
  }

  for (const row of input.verificationResults) {
    if (!['fail', 'not_run'].includes(row.status)) continue
    const execution = executionById.get(String(row.execution_id))
    incidents.push(incident({
      id: `verification:${row.verification_id}`,
      severity: row.status === 'fail' ? 'critical' : 'warning',
      kind: row.status === 'fail' ? 'verification_failed' : 'verification_not_run',
      title: `${row.task_id} verification ${row.status === 'fail' ? 'failed' : 'was not run'}`,
      detail: `${row.check_name}${row.summary ? ` — ${row.summary}` : ''}`,
      recovery: 'Keep the same task active for correction or missing verification. A failed/not-run check is not completion evidence.',
      suit_slug: row.suit_slug,
      task_id: row.task_id,
      run_id: null,
      execution_id: execution?.execution_id ?? row.execution_id,
      occurred_at: row.finished_at || row.created_at,
      evidence: { check_name: row.check_name, status: row.status, exit_code: row.exit_code, command: row.command },
    }))
  }

  for (const row of input.decisions) {
    if (row.status !== 'open' || row.blocking_tasks < 1) continue
    incidents.push(incident({
      id: `decision:${row.suit_slug}:${row.decision_id}`,
      severity: 'warning',
      kind: 'blocking_decision_open',
      title: `${row.decision_id} blocks ${row.blocking_tasks} task${row.blocking_tasks === 1 ? '' : 's'}`,
      detail: row.decision_text || row.title,
      recovery: 'Obtain the unresolved operator/product decision and persist it canonically before continuing dependent work.',
      suit_slug: row.suit_slug,
      task_id: null,
      run_id: null,
      execution_id: null,
      occurred_at: row.updated_at,
      evidence: { decision_id: row.decision_id, blocking_tasks: row.blocking_tasks, source: row.source },
    }))
  }

  for (const row of input.events) {
    const payload = jsonText(row.payload)
    const eventType = row.event_type.toLowerCase()

    if (eventType === 'retry_exhausted' || payload.includes('retry_limit_reached')) {
      incidents.push(incident({
        id: `retry-exhausted:${row.event_id}`,
        severity: 'critical',
        kind: 'retry_exhausted',
        title: `${row.task_id} exhausted its automatic retry allowance`,
        detail: 'The runner recorded retry exhaustion.',
        recovery: 'Stop automatic retry. Diagnose the repeated failure and require an explicit bounded correction/unblocking decision.',
        suit_slug: row.suit_slug,
        task_id: row.task_id,
        run_id: null,
        execution_id: null,
        occurred_at: row.created_at,
        evidence: row.payload,
      }))
    }

    if (payload.includes('out_of_scope_changes')) {
      incidents.push(incident({
        id: `out-of-scope:${row.event_id}`,
        severity: 'critical',
        kind: 'out_of_scope_changes',
        title: `${row.task_id} publication was blocked by out-of-scope changes`,
        detail: 'The publication guard detected changed files outside the task packet scope.',
        recovery: `Preserve unrelated work, correct the task publication boundary, then resume publication for ${row.task_id}. Do not dispatch the next task.`,
        suit_slug: row.suit_slug,
        task_id: row.task_id,
        run_id: null,
        execution_id: null,
        occurred_at: row.created_at,
        evidence: row.payload,
      }))
    } else if ((eventType.includes('publication') || payload.includes('publish')) && (payload.includes('failed') || payload.includes('error') || payload.includes('"ok":false'))) {
      incidents.push(incident({
        id: `publication-error:${row.event_id}`,
        severity: 'critical',
        kind: 'publication_failed',
        title: `${row.task_id} publication failed`,
        detail: 'A publication-related event contains failure evidence.',
        recovery: `Resume publication for ${row.task_id} after correcting the recorded error. Do not advance the task graph first.`,
        suit_slug: row.suit_slug,
        task_id: row.task_id,
        run_id: null,
        execution_id: null,
        occurred_at: row.created_at,
        evidence: row.payload,
      }))
    }
  }

  if (input.runtimeTelemetryAvailable) {
    const runningRuntime = input.runtimeExecutions.filter(row => row.runtime_status === 'running')
    const activeControlRuns = input.workflowRuns.filter(row => row.status === 'running' && !row.stop_requested)
    const runtimeBySuit = new Map<string, RuntimeExecutionRow[]>()

    for (const row of runningRuntime) {
      if (!row.suit_slug) continue
      const rows = runtimeBySuit.get(row.suit_slug) ?? []
      rows.push(row)
      runtimeBySuit.set(row.suit_slug, rows)

      const heartbeatAge = row.last_heartbeat_at ? (now - new Date(row.last_heartbeat_at).getTime()) / 1000 : Infinity
      if (heartbeatAge >= input.runtimeHeartbeatSeconds) {
        incidents.push(incident({
          id: `runtime-heartbeat:${row.n8n_execution_id}`,
          severity: 'critical',
          kind: 'runtime_heartbeat_stale',
          title: `n8n execution ${row.n8n_execution_id} heartbeat is stale`,
          detail: `No runtime heartbeat has been observed within ${input.runtimeHeartbeatSeconds} seconds.`,
          recovery: 'Check the actual n8n execution/process. Reconcile runtime and control-plane state before dispatching more work.',
          suit_slug: row.suit_slug,
          task_id: row.task_id,
          run_id: row.run_id,
          execution_id: row.n8n_execution_id,
          occurred_at: row.last_heartbeat_at || row.observed_at,
          evidence: { current_node: row.current_node, current_stage: row.current_stage, runtime_status: row.runtime_status },
        }))
      }
    }

    for (const [suit, rows] of runtimeBySuit.entries()) {
      if (rows.length > 1) {
        incidents.push(incident({
          id: `runtime-duplicate:${suit}`,
          severity: 'critical',
          kind: 'duplicate_n8n_execution',
          title: `${suit} has multiple running n8n executions`,
          detail: `${rows.length} live runtime rows are marked running for one Suit.`,
          recovery: 'Do not dispatch another task. Identify the authoritative execution and reconcile duplicates without discarding work.',
          suit_slug: suit,
          task_id: null,
          run_id: null,
          execution_id: null,
          occurred_at: rows[0]?.observed_at ?? null,
          evidence: { execution_ids: rows.map(row => row.n8n_execution_id) },
        }))
      }
    }

    for (const run of activeControlRuns) {
      if (!runtimeBySuit.has(run.suit_slug)) {
        incidents.push(incident({
          id: `control-runtime-missing:${run.run_id}`,
          severity: 'critical',
          kind: 'control_runtime_mismatch',
          title: `${run.suit_slug} is running in the control plane but not in n8n telemetry`,
          detail: `Control run ${run.run_id} is active, but no running runtime observation exists for the Suit.`,
          recovery: 'Inspect the n8n execution and heartbeat writer. Do not treat the database running row as proof of live execution.',
          suit_slug: run.suit_slug,
          task_id: null,
          run_id: run.run_id,
          execution_id: null,
          occurred_at: run.updated_at,
          evidence: { control_status: run.status, completed_tasks: run.completed_tasks, max_tasks: run.max_tasks },
        }))
      }
    }

    const activeControlSuitSet = new Set(activeControlRuns.map(run => run.suit_slug))
    for (const row of runningRuntime) {
      if (row.suit_slug && !activeControlSuitSet.has(row.suit_slug)) {
        incidents.push(incident({
          id: `runtime-control-missing:${row.n8n_execution_id}`,
          severity: 'critical',
          kind: 'runtime_control_mismatch',
          title: `n8n is running ${row.suit_slug} without an active control-plane run`,
          detail: `Runtime execution ${row.n8n_execution_id} is marked running, but control.workflow_runs has no active run for that Suit.`,
          recovery: 'Reconcile orchestration persistence and runtime ownership before allowing further dispatch.',
          suit_slug: row.suit_slug,
          task_id: row.task_id,
          run_id: row.run_id,
          execution_id: row.n8n_execution_id,
          occurred_at: row.observed_at,
          evidence: { current_node: row.current_node, current_stage: row.current_stage },
        }))
      }
    }
  }

  const severityRank = { critical: 0, warning: 1, info: 2 }
  return incidents
    .filter((row, index, all) => all.findIndex(candidate => candidate.id === row.id) === index)
    .sort((a, b) => {
      const severity = severityRank[a.severity] - severityRank[b.severity]
      if (severity !== 0) return severity
      return new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime()
    })
}
