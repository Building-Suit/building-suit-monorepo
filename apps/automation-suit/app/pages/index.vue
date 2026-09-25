<script setup lang="ts">
import type { DashboardResponse, IncidentSeverity } from '../../types/dashboard'

const { t } = useI18n()
const config = useRuntimeConfig()
const selectedSuit = ref('')
const severity = ref<'all' | IncidentSeverity>('all')
const showCompleted = ref(false)

const requestQuery = computed(() => selectedSuit.value ? { suit: selectedSuit.value } : {})
const { data, error, status, refresh } = await useFetch<DashboardResponse>('/api/dashboard', {
  query: requestQuery,
  watch: [selectedSuit],
})

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  const seconds = Math.max(5, Number(config.public.refreshSeconds || 15))
  timer = setInterval(() => refresh(), seconds * 1000)
})
onBeforeUnmount(() => timer && clearInterval(timer))

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
</script>

<template>
  <main class="space-y-6">
    <section class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-fg-muted">{{ t('dashboard.eyebrow') }}</p>
        <h1 class="mt-2 text-3xl font-black text-fg">{{ t('dashboard.title') }}</h1>
        <p class="mt-2 max-w-3xl text-sm text-fg-muted">{{ t('dashboard.subtitle') }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <select v-model="selectedSuit" class="min-w-48 rounded-control border border-[var(--bs-border)] bg-surface px-3 py-2 text-sm text-fg">
          <option value="">{{ t('dashboard.allSuits') }}</option>
          <option v-for="suit in data?.suits || []" :key="suit.slug" :value="suit.slug">{{ suit.display_name }}</option>
        </select>
        <button class="rounded-control border border-[var(--bs-border)] bg-surface px-3 py-2 text-sm font-bold text-fg hover:bg-surface-muted" @click="refresh()">
          {{ t('dashboard.refresh') }}
        </button>
      </div>
    </section>

    <section v-if="error" class="rounded-card border border-danger/40 bg-[var(--bs-status-danger-bg)] p-5">
      <h2 class="font-black text-danger">{{ t('dashboard.loadFailed') }}</h2>
      <p class="mt-1 text-sm text-fg">{{ error.message }}</p>
    </section>

    <section v-if="status === 'pending' && !data" class="rounded-card border border-[var(--bs-border)] bg-surface p-8 text-center text-sm text-fg-muted" aria-busy="true">
      {{ t('dashboard.loading') }}
    </section>

    <template v-if="data && summary">
      <section class="rounded-card border border-[var(--bs-border)] bg-surface p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <DashboardStatusPill :value="data.runtimeTelemetryAvailable ? 'runtime telemetry on' : 'control-plane only'" />
              <span class="text-xs text-fg-muted">{{ t('dashboard.generated') }} {{ formatDate(data.generatedAt) }}</span>
            </div>
            <p class="mt-2 text-sm text-fg-muted">
              {{ data.runtimeTelemetryAvailable ? t('dashboard.runtimeTruthOn') : t('dashboard.runtimeTruthOff') }}
            </p>
          </div>
          <div class="text-xs text-fg-muted lg:text-end">
            <div><strong class="text-fg">DB:</strong> {{ data.database.database }}</div>
            <div><strong class="text-fg">Role:</strong> {{ data.database.user }}</div>
            <div><strong class="text-fg">Server:</strong> {{ data.database.server_addr || 'managed' }}<template v-if="data.database.server_port">:{{ data.database.server_port }}</template></div>
          </div>
        </div>
      </section>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <DashboardMetricCard :label="t('metrics.total')" :value="summary.total_tasks" />
        <DashboardMetricCard :label="t('metrics.finished')" :value="summary.finished_tasks" />
        <DashboardMetricCard :label="t('metrics.activeTasks')" :value="summary.in_progress_tasks" />
        <DashboardMetricCard :label="t('metrics.verifying')" :value="summary.verification_tasks" />
        <DashboardMetricCard :label="t('metrics.blocked')" :value="summary.blocked_tasks" :danger="summary.blocked_tasks > 0" />
        <DashboardMetricCard :label="t('metrics.failed')" :value="summary.failed_tasks" :danger="summary.failed_tasks > 0" />
        <DashboardMetricCard :label="t('metrics.ready')" :value="summary.ready_tasks" />
        <DashboardMetricCard :label="t('metrics.runningFlows')" :value="summary.running_workflows" />
        <DashboardMetricCard :label="t('metrics.runningExecutions')" :value="summary.running_executions" />
        <DashboardMetricCard :label="t('metrics.decisions')" :value="summary.open_blocking_decisions" :danger="summary.open_blocking_decisions > 0" />
        <DashboardMetricCard :label="t('metrics.incidents')" :value="data.incidents.length" :danger="data.incidents.some(row => row.severity === 'critical')" />
        <DashboardMetricCard :label="t('metrics.unfinished')" :value="summary.unfinished_tasks" />
      </section>

      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black text-fg">{{ t('incidents.title') }}</h2>
            <p class="text-sm text-fg-muted">{{ t('incidents.subtitle') }}</p>
          </div>
          <select v-model="severity" class="rounded-control border border-[var(--bs-border)] bg-surface px-3 py-2 text-sm text-fg">
            <option value="all">{{ t('incidents.all') }}</option>
            <option value="critical">{{ t('incidents.critical') }}</option>
            <option value="warning">{{ t('incidents.warning') }}</option>
            <option value="info">{{ t('incidents.info') }}</option>
          </select>
        </div>
        <div v-if="incidents.length" class="grid gap-3 xl:grid-cols-2">
          <DashboardIncidentCard v-for="incident in incidents" :key="incident.id" :incident="incident" />
        </div>
        <div v-else class="rounded-card border border-[var(--bs-border)] bg-surface p-6 text-sm text-fg-muted">{{ t('incidents.empty') }}</div>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <div class="rounded-card border border-[var(--bs-border)] bg-surface p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-black text-fg">{{ t('runtime.title') }}</h2>
              <p class="text-xs text-fg-muted">{{ t('runtime.subtitle') }}</p>
            </div>
            <DashboardStatusPill :value="data.runtimeTelemetryAvailable ? 'available' : 'not installed'" />
          </div>
          <div v-if="data.runtimeTelemetryAvailable && activeRuntime.length" class="mt-4 space-y-3">
            <div v-for="row in activeRuntime" :key="row.n8n_execution_id" class="rounded-control border border-[var(--bs-border)] p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="font-bold text-fg">{{ row.suit_slug || 'Unresolved Suit' }}</p>
                  <p class="font-mono text-xs text-fg-muted">{{ row.task_id || 'No task' }} · {{ row.n8n_execution_id }}</p>
                </div>
                <DashboardStatusPill :value="row.runtime_status" />
              </div>
              <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt class="text-fg-muted">Node</dt><dd class="font-semibold text-fg">{{ row.current_node || '—' }}</dd></div>
                <div><dt class="text-fg-muted">Stage</dt><dd class="font-semibold text-fg">{{ row.current_stage || '—' }}</dd></div>
                <div><dt class="text-fg-muted">Started</dt><dd class="text-fg">{{ formatDate(row.started_at) }}</dd></div>
                <div><dt class="text-fg-muted">Heartbeat</dt><dd class="text-fg">{{ formatDate(row.last_heartbeat_at) }}</dd></div>
              </dl>
            </div>
          </div>
          <p v-else-if="!data.runtimeTelemetryAvailable" class="mt-4 rounded-control border border-warning/40 bg-[var(--bs-status-warning-bg)] p-3 text-sm text-fg">{{ t('runtime.installHint') }}</p>
          <p v-else class="mt-4 text-sm text-fg-muted">{{ t('runtime.idle') }}</p>
        </div>

        <div class="rounded-card border border-[var(--bs-border)] bg-surface p-4">
          <h2 class="font-black text-fg">{{ t('runs.title') }}</h2>
          <p class="text-xs text-fg-muted">{{ t('runs.subtitle') }}</p>
          <div v-if="activeRuns.length" class="mt-4 space-y-3">
            <div v-for="run in activeRuns" :key="run.run_id" class="rounded-control border border-[var(--bs-border)] p-3">
              <div class="flex items-center justify-between gap-2">
                <div><p class="font-bold text-fg">{{ run.suit_slug }}</p><p class="font-mono text-xs text-fg-muted">{{ compactId(run.run_id) }}</p></div>
                <DashboardStatusPill :value="run.status" />
              </div>
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"><div class="h-full bg-fg" :style="{ width: `${progress(run)}%` }" /></div>
              <div class="mt-2 flex justify-between text-xs text-fg-muted"><span>{{ run.completed_tasks }} / {{ run.max_tasks }}</span><span>{{ progress(run) }}%</span></div>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-fg-muted">{{ t('runs.idle') }}</p>
        </div>
      </section>

      <section class="rounded-card border border-[var(--bs-border)] bg-surface">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--bs-border)] p-4">
          <div><h2 class="font-black text-fg">{{ t('tasks.title') }}</h2><p class="text-xs text-fg-muted">{{ t('tasks.subtitle') }}</p></div>
          <label class="flex items-center gap-2 text-xs font-semibold text-fg-muted"><input v-model="showCompleted" type="checkbox"> {{ t('tasks.showCompleted') }}</label>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-surface-muted text-start text-xs uppercase tracking-wide text-fg-muted"><tr><th class="px-4 py-3">Task</th><th class="px-4 py-3">Suit</th><th class="px-4 py-3">Title</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Risk / model</th><th class="px-4 py-3">Updated</th></tr></thead>
            <tbody class="divide-y divide-[var(--bs-border)]">
              <tr v-for="task in visibleTasks" :key="task.task_id" class="align-top"><td class="px-4 py-3 font-mono text-xs text-fg">{{ task.task_id }}</td><td class="px-4 py-3 text-fg">{{ task.suit_slug }}</td><td class="max-w-xl px-4 py-3 font-semibold text-fg">{{ task.title }}</td><td class="px-4 py-3"><DashboardStatusPill :value="task.status" /></td><td class="px-4 py-3 text-xs text-fg-muted">{{ task.risk_level }} · {{ task.model_profile }}</td><td class="whitespace-nowrap px-4 py-3 text-xs text-fg-muted">{{ formatDate(task.updated_at) }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <div class="rounded-card border border-[var(--bs-border)] bg-surface p-4">
          <h2 class="font-black text-fg">{{ t('verification.title') }}</h2>
          <p class="text-xs text-fg-muted">{{ t('verification.subtitle') }}</p>
          <div v-if="failingVerification.length" class="mt-4 space-y-3">
            <div v-for="row in failingVerification.slice(0, 12)" :key="row.verification_id" class="rounded-control border border-[var(--bs-border)] p-3">
              <div class="flex items-center justify-between gap-2"><span class="font-mono text-xs text-fg">{{ row.task_id }}</span><DashboardStatusPill :value="row.status" /></div>
              <p class="mt-2 font-bold text-fg">{{ row.check_name }}</p><p class="mt-1 text-xs text-fg-muted">{{ row.summary || row.command || 'No summary recorded' }}</p>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-fg-muted">{{ t('verification.empty') }}</p>
        </div>

        <div class="rounded-card border border-[var(--bs-border)] bg-surface p-4">
          <h2 class="font-black text-fg">{{ t('decisions.title') }}</h2>
          <p class="text-xs text-fg-muted">{{ t('decisions.subtitle') }}</p>
          <div v-if="openDecisions.length" class="mt-4 space-y-3">
            <div v-for="row in openDecisions.slice(0, 12)" :key="`${row.suit_slug}:${row.decision_id}`" class="rounded-control border border-[var(--bs-border)] p-3">
              <div class="flex items-center justify-between gap-2"><span class="font-mono text-xs text-fg">{{ row.decision_id }}</span><span class="text-xs font-bold text-fg-muted">{{ row.blocking_tasks }} blocking</span></div>
              <p class="mt-2 font-bold text-fg">{{ row.title }}</p><p class="mt-1 text-xs text-fg-muted">{{ row.decision_text || 'No decision text' }}</p>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-fg-muted">{{ t('decisions.empty') }}</p>
        </div>
      </section>

      <section class="grid gap-4 2xl:grid-cols-2">
        <div class="rounded-card border border-[var(--bs-border)] bg-surface">
          <div class="border-b border-[var(--bs-border)] p-4"><h2 class="font-black text-fg">{{ t('executions.title') }}</h2><p class="text-xs text-fg-muted">{{ t('executions.subtitle') }}</p></div>
          <div class="max-h-[34rem] overflow-auto">
            <table class="min-w-full text-xs"><thead class="sticky top-0 bg-surface-muted text-fg-muted"><tr><th class="px-3 py-2">ID</th><th class="px-3 py-2">Task</th><th class="px-3 py-2">Status</th><th class="px-3 py-2">Attempt</th><th class="px-3 py-2">Branch</th><th class="px-3 py-2">Started</th></tr></thead><tbody class="divide-y divide-[var(--bs-border)]"><tr v-for="row in data.executions" :key="row.execution_id"><td class="px-3 py-2 font-mono">{{ row.execution_id }}</td><td class="px-3 py-2 font-mono">{{ row.task_id }}</td><td class="px-3 py-2"><DashboardStatusPill :value="row.status" /></td><td class="px-3 py-2">{{ row.attempt }}</td><td class="max-w-56 truncate px-3 py-2 font-mono text-fg-muted">{{ row.branch_name || '—' }}</td><td class="whitespace-nowrap px-3 py-2 text-fg-muted">{{ formatDate(row.started_at || row.created_at) }}</td></tr></tbody></table>
          </div>
        </div>

        <div class="rounded-card border border-[var(--bs-border)] bg-surface">
          <div class="border-b border-[var(--bs-border)] p-4"><h2 class="font-black text-fg">{{ t('events.title') }}</h2><p class="text-xs text-fg-muted">{{ t('events.subtitle') }}</p></div>
          <div class="max-h-[34rem] overflow-auto divide-y divide-[var(--bs-border)]">
            <details v-for="row in data.events" :key="row.event_id" class="p-3">
              <summary class="cursor-pointer list-none">
                <div class="flex flex-wrap items-center justify-between gap-2"><div><span class="font-mono text-xs font-bold text-fg">{{ row.task_id }}</span><span class="ms-2 text-xs text-fg-muted">{{ row.event_type }}</span></div><span class="text-xs text-fg-muted">{{ formatDate(row.created_at) }}</span></div>
                <div class="mt-1 text-xs text-fg-muted">{{ row.source }} · {{ row.from_status || '—' }} → {{ row.to_status || '—' }}</div>
              </summary>
              <pre class="mt-3 overflow-auto rounded-control bg-background p-3 font-mono text-[11px] leading-5 text-fg">{{ JSON.stringify(row.payload, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </section>

      <section class="rounded-card border border-[var(--bs-border)] bg-surface p-4 text-xs text-fg-muted">
        {{ t('dashboard.readOnlyFooter') }}
      </section>
    </template>
  </main>
</template>
