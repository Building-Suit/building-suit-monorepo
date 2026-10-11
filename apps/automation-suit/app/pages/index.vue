<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
import type { DashboardResponse, IncidentSeverity } from '../../types/dashboard'

const { t } = useI18n()
const config = useRuntimeConfig()
const selectedSuit = ref('')
const severity = ref<'all' | IncidentSeverity>('all')
const showCompleted = ref(false)
const suitOptions = computed(() => [
  { value: '', label: t('dashboard.allSuits') },
  ...(data.value?.suits ?? []).map(suit => ({ value: suit.slug, label: suit.display_name })),
])
const severityOptions = computed(() => [
  { value: 'all', label: t('incidents.all') },
  { value: 'critical', label: t('incidents.critical') },
  { value: 'warning', label: t('incidents.warning') },
  { value: 'info', label: t('incidents.info') },
])

const requestQuery = computed(() => selectedSuit.value ? { suit: selectedSuit.value } : {})
const { data, error, status, refresh } = await useFetch<DashboardResponse>('/api/dashboard', {
  query: requestQuery,
  watch: [selectedSuit],
})

usePolling(refresh, () => Math.max(5, Number(config.public.refreshSeconds || 15)) * 1000)

const summary = computed(() => data.value?.summary)
const incidents = computed(() => {
  const rows = data.value?.incidents ?? []
  return severity.value === 'all' ? rows : rows.filter(row => row.severity === severity.value)
})
const visibleTasks = computed(() => {
  const rows = data.value?.tasks ?? []
  return showCompleted.value ? rows : rows.filter(row => !['passed', 'complete', 'cancelled'].includes(row.status))
})
const failingVerification = computed(() => (data.value?.verificationResults ?? []).filter(row => ['fail', 'not_run'].includes(row.status)))
const openDecisions = computed(() => (data.value?.decisions ?? []).filter(row => row.status === 'open'))
const activeRuns = computed(() => (data.value?.workflowRuns ?? []).filter(row => row.status === 'running'))
const activeRuntime = computed(() => (data.value?.runtimeExecutions ?? []).filter(row => row.runtime_status === 'running'))

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

function compactId(value?: string | number | null) {
  if (value == null) return '—'
  const text = String(value)
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text
}

function progress(run: { completed_tasks: number; max_tasks: number }) {
  if (!run.max_tasks) return 0
  return Math.min(100, Math.round((run.completed_tasks / run.max_tasks) * 100))
}

const badge = (status: string) => ({ status, statusLabel: status || 'unknown', statusTone: automationStatusTone(status) })
const dashboardView = computed(() => {
  if (!data.value || !summary.value) return null
  const source = data.value
  const counts = summary.value
  const metrics: { id: string; label: string; value: number; tone: 'danger' | 'neutral'; textTone: 'danger' | 'default' }[] = []
  const metric = (key: string, value: number, danger = false) => metrics.push({ id: key, label: t(`metrics.${key}`), value, tone: danger ? 'danger' : 'neutral', textTone: danger ? 'danger' : 'default' })
  metric('total', counts.total_tasks); metric('finished', counts.finished_tasks); metric('activeTasks', counts.in_progress_tasks); metric('verifying', counts.verification_tasks)
  metric('blocked', counts.blocked_tasks, counts.blocked_tasks > 0); metric('failed', counts.failed_tasks, counts.failed_tasks > 0); metric('ready', counts.ready_tasks)
  metric('runningFlows', counts.running_workflows); metric('runningExecutions', counts.running_executions); metric('decisions', counts.open_blocking_decisions, counts.open_blocking_decisions > 0)
  metric('incidents', source.incidents.length, source.incidents.some(row => row.severity === 'critical')); metric('unfinished', counts.unfinished_tasks)
  return {
    telemetry: { ...badge(source.runtimeTelemetryAvailable ? 'runtime telemetry on' : 'control-plane only'), availability: badge(source.runtimeTelemetryAvailable ? 'available' : 'not installed'), available: source.runtimeTelemetryAvailable, generated: formatDate(source.generatedAt), description: t(source.runtimeTelemetryAvailable ? 'dashboard.runtimeTruthOn' : 'dashboard.runtimeTruthOff') },
    database: { name: source.database.database, role: source.database.user, server: `${source.database.server_addr || 'managed'}${source.database.server_port ? `:${source.database.server_port}` : ''}` }, metrics,
    incidents: incidents.value.map(row => ({ ...badge(row.severity), id: row.id, kind: row.kind, context: `${row.suit_slug ?? ''} ${row.task_id ?? ''}`, alertTone: row.severity === 'critical' ? 'error' as const : row.severity, title: row.title, detail: row.detail, recovery: row.recovery, evidence: JSON.stringify(row.evidence, null, 2) })),
    runtime: activeRuntime.value.map(row => ({ ...badge(row.runtime_status), id: row.n8n_execution_id, suit: row.suit_slug || 'Unresolved Suit', subtitle: `${row.task_id || 'No task'} · ${row.n8n_execution_id}`, node: row.current_node || '—', stage: row.current_stage || '—', started: formatDate(row.started_at), heartbeat: formatDate(row.last_heartbeat_at) })),
    runs: activeRuns.value.map(row => ({ ...badge(row.status), id: row.run_id, suit: row.suit_slug, displayId: compactId(row.run_id), used: row.completed_tasks, limit: row.max_tasks || null, valueLabel: `${row.completed_tasks} / ${row.max_tasks} · ${progress(row)}%` })),
    tasks: visibleTasks.value.map(row => ({ ...badge(row.status), id: row.task_id, suit: row.suit_slug, title: row.title, riskModel: `${row.risk_level} · ${row.model_profile}`, updated: formatDate(row.updated_at) })),
    verification: failingVerification.value.slice(0, 12).map(row => ({ ...badge(row.status), id: String(row.verification_id), task: row.task_id, name: row.check_name, description: row.summary || row.command || 'No summary recorded' })),
    decisions: openDecisions.value.slice(0, 12).map(row => ({ id: `${row.suit_slug}:${row.decision_id}`, displayId: row.decision_id, blocking: `${row.blocking_tasks} blocking`, title: row.title, description: row.decision_text || 'No decision text' })),
    executions: source.executions.map(row => ({ ...badge(row.status), id: row.execution_id, task: row.task_id, attempt: row.attempt, branch: row.branch_name || '—', started: formatDate(row.started_at || row.created_at) })),
    events: source.events.map(row => ({ id: String(row.event_id), summary: `${row.task_id} · ${row.event_type} · ${formatDate(row.created_at)} · ${row.source} · ${row.from_status || '—'} → ${row.to_status || '—'}`, payload: JSON.stringify(row.payload, null, 2) })),
  }
})
const copy = computed(() => ({
  'dashboard.eyebrow': t('dashboard.eyebrow'),
  'dashboard.title': t('dashboard.title'),
  'dashboard.subtitle': t('dashboard.subtitle'),
  'dashboard.allSuits': t('dashboard.allSuits'),
  'dashboard.refresh': t('dashboard.refresh'),
  'dashboard.loadFailed': t('dashboard.loadFailed'),
  'dashboard.loading': t('dashboard.loading'),
  'dashboard.generated': t('dashboard.generated'),
  'dashboard.runtimeTruthOn': t('dashboard.runtimeTruthOn'),
  'dashboard.runtimeTruthOff': t('dashboard.runtimeTruthOff'),
  'metrics.total': t('metrics.total'),
  'metrics.finished': t('metrics.finished'),
  'metrics.activeTasks': t('metrics.activeTasks'),
  'metrics.verifying': t('metrics.verifying'),
  'metrics.blocked': t('metrics.blocked'),
  'metrics.failed': t('metrics.failed'),
  'metrics.ready': t('metrics.ready'),
  'metrics.runningFlows': t('metrics.runningFlows'),
  'metrics.runningExecutions': t('metrics.runningExecutions'),
  'metrics.decisions': t('metrics.decisions'),
  'metrics.incidents': t('metrics.incidents'),
  'metrics.unfinished': t('metrics.unfinished'),
  'incidents.title': t('incidents.title'),
  'incidents.subtitle': t('incidents.subtitle'),
  'incidents.empty': t('incidents.empty'),
  'runtime.title': t('runtime.title'),
  'runtime.subtitle': t('runtime.subtitle'),
  'runtime.installHint': t('runtime.installHint'),
  'runtime.idle': t('runtime.idle'),
  'runs.title': t('runs.title'),
  'runs.subtitle': t('runs.subtitle'),
  'runs.idle': t('runs.idle'),
  'tasks.title': t('tasks.title'),
  'tasks.subtitle': t('tasks.subtitle'),
  'tasks.showCompleted': t('tasks.showCompleted'),
  'verification.title': t('verification.title'),
  'verification.subtitle': t('verification.subtitle'),
  'verification.empty': t('verification.empty'),
  'decisions.title': t('decisions.title'),
  'decisions.subtitle': t('decisions.subtitle'),
  'decisions.empty': t('decisions.empty'),
  'executions.title': t('executions.title'),
  'executions.subtitle': t('executions.subtitle'),
  'events.title': t('events.title'),
  'events.subtitle': t('events.subtitle'),
  'dashboard.readOnlyFooter': t('dashboard.readOnlyFooter'),
  recovery: 'Recovery', evidence: 'Evidence', database: 'DB', role: 'Role', server: 'Server', node: 'Node', stage: 'Stage', started: 'Started', heartbeat: 'Heartbeat',
  taskColumns: { task: 'Task', suit: 'Suit', title: 'Title', status: 'Status', riskModel: 'Risk / model', updated: 'Updated' },
  executionColumns: { id: 'ID', task: 'Task', status: 'Status', attempt: 'Attempt', branch: 'Branch', started: 'Started' },
}))
function changeSeverity(value: string) { if (['all', 'critical', 'warning', 'info'].includes(value)) severity.value = value as 'all' | IncidentSeverity }
</script>
<template>
  <BsOperationsDashboardPage v-model:selected-suit="selectedSuit" v-model:show-completed="showCompleted" :severity="severity" :dashboard="dashboardView" :copy="copy" :suit-options="suitOptions" :severity-options="severityOptions" :loading="status === 'pending'" :error="error?.message" @update:severity="changeSeverity" @refresh="refresh()" />
</template>
