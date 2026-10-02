<script setup lang="ts">
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
        <BsSelect v-model="selectedSuit" :label="t('dashboard.allSuits')" :options="suitOptions" option-label="label" option-value="value" class="min-w-48" />
        <BsButton @click="refresh()">
          {{ t('dashboard.refresh') }}
        </BsButton>
      </div>
    </section>

    <BsCard v-if="error" as="section" class="border-danger/40 bg-[var(--bs-status-danger-bg)]">
      <h2 class="font-black text-danger">{{ t('dashboard.loadFailed') }}</h2>
      <p class="mt-1 text-sm text-fg">{{ error.message }}</p>
    </BsCard>

    <BsCard v-if="status === 'pending' && !data" as="section" padding="lg" class="text-center text-sm text-fg-muted" aria-busy="true">
      {{ t('dashboard.loading') }}
    </BsCard>

    <template v-if="data && summary">
      <BsCard as="section" padding="sm">
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
      </BsCard>

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
          <BsSelect v-model="severity" :label="t('incidents.title')" :options="severityOptions" option-label="label" option-value="value" class="min-w-40" />
        </div>
        <div v-if="incidents.length" class="grid gap-3 xl:grid-cols-2">
          <DashboardIncidentCard v-for="incident in incidents" :key="incident.id" :incident="incident" />
        </div>
        <BsCard v-else padding="lg" class="text-sm text-fg-muted">{{ t('incidents.empty') }}</BsCard>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <BsCard padding="sm">
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
        </BsCard>

        <BsCard padding="sm">
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
        </BsCard>
      </section>

      <BsCard as="section" padding="none">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--bs-border)] p-4">
          <div><h2 class="font-black text-fg">{{ t('tasks.title') }}</h2><p class="text-xs text-fg-muted">{{ t('tasks.subtitle') }}</p></div>
          <label class="flex items-center gap-2 text-xs font-semibold text-fg-muted"><input v-model="showCompleted" type="checkbox"> {{ t('tasks.showCompleted') }}</label>
        </div>
        <BsDataTable :value="visibleTasks" data-key="task_id" :label="t('tasks.title')" scroll-label="Tasks" class="overflow-x-auto">
          <Column field="task_id" header="Task" body-class="font-mono text-xs" />
          <Column field="suit_slug" header="Suit" />
          <Column field="title" header="Title" body-class="max-w-xl font-semibold" />
          <Column field="status" header="Status"><template #body="{ data: task }"><DashboardStatusPill :value="task.status" /></template></Column>
          <Column header="Risk / model" body-class="text-xs text-fg-muted"><template #body="{ data: task }">{{ task.risk_level }} · {{ task.model_profile }}</template></Column>
          <Column field="updated_at" header="Updated" body-class="whitespace-nowrap text-xs text-fg-muted"><template #body="{ data: task }">{{ formatDate(task.updated_at) }}</template></Column>
        </BsDataTable>
      </BsCard>

      <section class="grid gap-4 xl:grid-cols-2">
        <BsCard padding="sm">
          <h2 class="font-black text-fg">{{ t('verification.title') }}</h2>
          <p class="text-xs text-fg-muted">{{ t('verification.subtitle') }}</p>
          <div v-if="failingVerification.length" class="mt-4 space-y-3">
            <div v-for="row in failingVerification.slice(0, 12)" :key="row.verification_id" class="rounded-control border border-[var(--bs-border)] p-3">
              <div class="flex items-center justify-between gap-2"><span class="font-mono text-xs text-fg">{{ row.task_id }}</span><DashboardStatusPill :value="row.status" /></div>
              <p class="mt-2 font-bold text-fg">{{ row.check_name }}</p><p class="mt-1 text-xs text-fg-muted">{{ row.summary || row.command || 'No summary recorded' }}</p>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-fg-muted">{{ t('verification.empty') }}</p>
        </BsCard>

        <BsCard padding="sm">
          <h2 class="font-black text-fg">{{ t('decisions.title') }}</h2>
          <p class="text-xs text-fg-muted">{{ t('decisions.subtitle') }}</p>
          <div v-if="openDecisions.length" class="mt-4 space-y-3">
            <div v-for="row in openDecisions.slice(0, 12)" :key="`${row.suit_slug}:${row.decision_id}`" class="rounded-control border border-[var(--bs-border)] p-3">
              <div class="flex items-center justify-between gap-2"><span class="font-mono text-xs text-fg">{{ row.decision_id }}</span><span class="text-xs font-bold text-fg-muted">{{ row.blocking_tasks }} blocking</span></div>
              <p class="mt-2 font-bold text-fg">{{ row.title }}</p><p class="mt-1 text-xs text-fg-muted">{{ row.decision_text || 'No decision text' }}</p>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-fg-muted">{{ t('decisions.empty') }}</p>
        </BsCard>
      </section>

      <section class="grid gap-4 2xl:grid-cols-2">
        <BsCard padding="none">
          <div class="border-b border-[var(--bs-border)] p-4"><h2 class="font-black text-fg">{{ t('executions.title') }}</h2><p class="text-xs text-fg-muted">{{ t('executions.subtitle') }}</p></div>
          <BsDataTable :value="data.executions" data-key="execution_id" label="Executions" density="compact" sticky-header max-height="34rem" scroll-label="Executions">
            <Column field="execution_id" header="ID" body-class="font-mono text-xs" />
            <Column field="task_id" header="Task" body-class="font-mono text-xs" />
            <Column field="status" header="Status"><template #body="{ data: row }"><DashboardStatusPill :value="row.status" /></template></Column>
            <Column field="attempt" header="Attempt" />
            <Column field="branch_name" header="Branch" body-class="max-w-56 truncate font-mono text-fg-muted"><template #body="{ data: row }">{{ row.branch_name || '—' }}</template></Column>
            <Column header="Started" body-class="whitespace-nowrap text-fg-muted"><template #body="{ data: row }">{{ formatDate(row.started_at || row.created_at) }}</template></Column>
          </BsDataTable>
        </BsCard>

        <BsCard padding="none">
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
        </BsCard>
      </section>

      <BsCard as="section" padding="sm" class="text-xs text-fg-muted">
        {{ t('dashboard.readOnlyFooter') }}
      </BsCard>
    </template>
  </main>
</template>
