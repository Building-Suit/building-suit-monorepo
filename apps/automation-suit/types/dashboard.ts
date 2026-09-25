export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface SuitRow {
  slug: string
  display_name: string
  status: string
  updated_at: string
}

export interface TaskRow {
  task_id: string
  suit_slug: string
  sequence: number
  priority: number
  title: string
  task_type: string
  risk_level: string
  model_profile: string
  status: string
  updated_at: string
  metadata: Record<string, JsonValue>
}

export interface WorkflowRunRow {
  run_id: string
  suit_slug: string
  max_tasks: number
  completed_tasks: number
  stop_requested: boolean
  status: string
  started_at: string
  finished_at: string | null
  updated_at: string
}

export interface ExecutionRow {
  execution_id: number
  task_id: string
  suit_slug: string
  attempt: number
  model_profile: string
  model_name: string | null
  reasoning_effort: string | null
  status: string
  worktree_path: string | null
  branch_name: string | null
  parent_branch: string | null
  parent_sha: string | null
  commit_sha: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  metadata: Record<string, JsonValue>
}

export interface VerificationRow {
  verification_id: number
  execution_id: number
  task_id: string
  suit_slug: string
  check_name: string
  command: string | null
  status: string
  exit_code: number | null
  summary: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  metadata: Record<string, JsonValue>
}

export interface DecisionRow {
  suit_slug: string
  decision_id: string
  title: string
  decision_text: string | null
  status: string
  source: string | null
  updated_at: string
  blocking_tasks: number
}

export interface PullRequestRow {
  pull_request_id: number
  task_id: string | null
  suit_slug: string | null
  repository: string
  pr_number: number
  head_branch: string
  base_branch: string
  state: string
  is_draft: boolean
  url: string | null
  head_sha: string | null
  merge_sha: string | null
  updated_at: string
  metadata: Record<string, JsonValue>
}

export interface TaskEventRow {
  event_id: number
  task_id: string
  suit_slug: string
  event_type: string
  from_status: string | null
  to_status: string | null
  source: string
  payload: Record<string, JsonValue>
  created_at: string
}

export interface RuntimeExecutionRow {
  n8n_execution_id: string
  workflow_id: string | null
  workflow_name: string | null
  run_id: string | null
  suit_slug: string | null
  task_id: string | null
  runtime_status: string
  current_node: string | null
  current_stage: string | null
  started_at: string | null
  last_heartbeat_at: string | null
  finished_at: string | null
  error_code: string | null
  error_message: string | null
  metadata: Record<string, JsonValue>
  observed_at: string
}

export interface SummaryRow {
  total_tasks: number
  finished_tasks: number
  unfinished_tasks: number
  in_progress_tasks: number
  verification_tasks: number
  blocked_tasks: number
  failed_tasks: number
  planned_tasks: number
  ready_tasks: number
  open_blocking_decisions: number
  running_workflows: number
  running_executions: number
}

export type IncidentSeverity = 'critical' | 'warning' | 'info'

export interface Incident {
  id: string
  severity: IncidentSeverity
  kind: string
  title: string
  detail: string
  recovery: string
  suit_slug: string | null
  task_id: string | null
  run_id: string | null
  execution_id: number | string | null
  occurred_at: string | null
  evidence: Record<string, JsonValue>
}

export interface DashboardResponse {
  generatedAt: string
  selectedSuit: string | null
  database: {
    database: string
    user: string
    server_addr: string | null
    server_port: number | null
  }
  runtimeTelemetryAvailable: boolean
  summary: SummaryRow
  suits: SuitRow[]
  tasks: TaskRow[]
  workflowRuns: WorkflowRunRow[]
  executions: ExecutionRow[]
  verificationResults: VerificationRow[]
  decisions: DecisionRow[]
  pullRequests: PullRequestRow[]
  events: TaskEventRow[]
  runtimeExecutions: RuntimeExecutionRow[]
  incidents: Incident[]
}
