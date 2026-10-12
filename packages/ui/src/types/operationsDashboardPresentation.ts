export interface BsOperationsStatus {
  status: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
}
export interface BsOperationsDashboardView {
  telemetry: BsOperationsStatus & { available: boolean; availability: BsOperationsStatus; generated: string; description: string }
  database: { name: string; role: string; server: string }
  metrics: { id: string; label: string; value: number; tone: 'danger' | 'neutral'; textTone: 'danger' | 'default' }[]
  incidents: (BsOperationsStatus & { id: string; kind: string; context: string; alertTone: 'error' | 'warning' | 'info'; title: string; detail: string; recovery: string; evidence: string })[]
  runtime: (BsOperationsStatus & { id: string; suit: string; subtitle: string; node: string; stage: string; started: string; heartbeat: string })[]
  runs: (BsOperationsStatus & { id: string; suit: string; displayId: string; used: number; limit: number | null; valueLabel: string })[]
  tasks: (BsOperationsStatus & { id: string; suit: string; title: string; riskModel: string; updated: string })[]
  verification: (BsOperationsStatus & { id: string; task: string; name: string; description: string })[]
  decisions: { id: string; displayId: string; blocking: string; title: string; description: string }[]
  executions: (BsOperationsStatus & { id: number; task: string; attempt: number; branch: string; started: string })[]
  events: { id: string; summary: string; payload: string }[]
}
export interface BsOperationsDashboardCopy {
  'dashboard.eyebrow': string
  'dashboard.title': string
  'dashboard.subtitle': string
  'dashboard.allSuits': string
  'dashboard.refresh': string
  'dashboard.loadFailed': string
  'dashboard.loading': string
  'dashboard.generated': string
  'dashboard.runtimeTruthOn': string
  'dashboard.runtimeTruthOff': string
  'metrics.total': string
  'metrics.finished': string
  'metrics.activeTasks': string
  'metrics.verifying': string
  'metrics.blocked': string
  'metrics.failed': string
  'metrics.ready': string
  'metrics.runningFlows': string
  'metrics.runningExecutions': string
  'metrics.decisions': string
  'metrics.incidents': string
  'metrics.unfinished': string
  'incidents.title': string
  'incidents.subtitle': string
  'incidents.empty': string
  'runtime.title': string
  'runtime.subtitle': string
  'runtime.installHint': string
  'runtime.idle': string
  'runs.title': string
  'runs.subtitle': string
  'runs.idle': string
  'tasks.title': string
  'tasks.subtitle': string
  'tasks.showCompleted': string
  'verification.title': string
  'verification.subtitle': string
  'verification.empty': string
  'decisions.title': string
  'decisions.subtitle': string
  'decisions.empty': string
  'executions.title': string
  'executions.subtitle': string
  'events.title': string
  'events.subtitle': string
  'dashboard.readOnlyFooter': string
  recovery: string
  evidence: string
  database: string
  role: string
  server: string
  node: string
  stage: string
  started: string
  heartbeat: string
  taskColumns: { task: string; suit: string; title: string; status: string; riskModel: string; updated: string }
  executionColumns: { id: string; task: string; status: string; attempt: string; branch: string; started: string }
}
