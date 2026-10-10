<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
import type { BsDataTable } from '#components'
import type { TaskRow, ExecutionRow, DashboardResponse, IncidentSeverity } from '../../types/dashboard'

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

// Derive the public column contract from Nuxt's registered shared component.
type BsDataTableColumn<Row extends object> = NonNullable<Parameters<typeof BsDataTable<Row>>[0]['columns']>[number]

const taskColumns: BsDataTableColumn<TaskRow>[] = [
  { key: 'task_id', header: 'Task', field: 'task_id', width: 'content' },
  { key: 'suit_slug', header: 'Suit', field: 'suit_slug' },
  { key: 'title', header: 'Title', field: 'title', width: 'xl' },
  { key: 'status', header: 'Status', field: 'status' },
  { key: 'risk_model', header: 'Risk / model' },
  { key: 'updated_at', header: 'Updated', field: 'updated_at', width: 'content' },
]
const executionColumns: BsDataTableColumn<ExecutionRow>[] = [
  { key: 'execution_id', header: 'ID', field: 'execution_id', width: 'content' },
  { key: 'task_id', header: 'Task', field: 'task_id', width: 'content' },
  { key: 'status', header: 'Status', field: 'status' },
  { key: 'attempt', header: 'Attempt', field: 'attempt' },
  { key: 'branch_name', header: 'Branch', field: 'branch_name' },
  { key: 'started', header: 'Started', width: 'content' },
]
</script>

<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between" align="start" collapse="md" as="section">
      <BsStack gap="sm">
        <BsText size="xs" tone="muted" emphasis="semibold">
          {{ t('dashboard.eyebrow') }}
        </BsText>
        <BsHeading :level="1">
          {{ t('dashboard.title') }}
        </BsHeading>
        <BsText size="sm" tone="muted">
          {{ t('dashboard.subtitle') }}
        </BsText>
      </BsStack>
      <BsInline>
        <BsSelect v-model="selectedSuit" :label="t('dashboard.allSuits')" :options="suitOptions" option-label="label" option-value="value" />
        <BsButton @click="refresh()">
          {{ t('dashboard.refresh') }}
        </BsButton>
      </BsInline>
    </BsInline>
    <BsAlert v-if="error" tone="error" :title="t('dashboard.loadFailed')" :description="error.message" />
    <BsCard v-if="status === 'pending' && !data" as="section" padding="lg" aria-busy="true">
      <BsStack gap="sm">
        {{ t('dashboard.loading') }}
      </BsStack>
    </BsCard>
    <template v-if="data && summary">
      <BsCard as="section" padding="sm">
        <BsInline justify="between" collapse="md">
          <BsStack gap="sm">
            <BsInline>
              <BsStatusBadge :status="data.runtimeTelemetryAvailable ? 'runtime telemetry on' : 'control-plane only'" :label="data.runtimeTelemetryAvailable ? 'runtime telemetry on' : 'control-plane only'" :tone="automationStatusTone(data.runtimeTelemetryAvailable ? 'runtime telemetry on' : 'control-plane only')" />
              <BsText size="xs" tone="muted">{{ t('dashboard.generated') }} {{ formatDate(data.generatedAt) }}</BsText>
            </BsInline>
            <BsText size="sm" tone="muted">{{ data.runtimeTelemetryAvailable ? t('dashboard.runtimeTruthOn') : t('dashboard.runtimeTruthOff') }}</BsText>
          </BsStack>
          <BsDescriptionList density="compact">
            <BsDescriptionItem term="DB" orientation="inline">{{ data.database.database }}</BsDescriptionItem>
            <BsDescriptionItem term="Role" orientation="inline">{{ data.database.user }}</BsDescriptionItem>
            <BsDescriptionItem term="Server" orientation="inline">{{ data.database.server_addr || 'managed' }}<template v-if="data.database.server_port">:{{ data.database.server_port }}</template></BsDescriptionItem>
          </BsDescriptionList>
        </BsInline>
      </BsCard>
      <BsGrid columns="auto" min-item-width="sm" as="section">
        <BsKpiCard :title="t('metrics.total')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.total_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.finished')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.finished_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.activeTasks')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.in_progress_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.verifying')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.verification_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.blocked')"  :tone="(summary.blocked_tasks > 0) ? 'danger' : 'neutral'">
          <BsText as="span" size="lg" emphasis="bold" :tone="(summary.blocked_tasks > 0) ? 'danger' : 'default'">
            {{ summary.blocked_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.failed')"  :tone="(summary.failed_tasks > 0) ? 'danger' : 'neutral'">
          <BsText as="span" size="lg" emphasis="bold" :tone="(summary.failed_tasks > 0) ? 'danger' : 'default'">
            {{ summary.failed_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.ready')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.ready_tasks }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.runningFlows')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.running_workflows }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.runningExecutions')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.running_executions }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.decisions')"  :tone="(summary.open_blocking_decisions > 0) ? 'danger' : 'neutral'">
          <BsText as="span" size="lg" emphasis="bold" :tone="(summary.open_blocking_decisions > 0) ? 'danger' : 'default'">
            {{ summary.open_blocking_decisions }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.incidents')"  :tone="(data.incidents.some(row => row.severity === 'critical')) ? 'danger' : 'neutral'">
          <BsText as="span" size="lg" emphasis="bold" :tone="(data.incidents.some(row => row.severity === 'critical')) ? 'danger' : 'default'">
            {{ data.incidents.length }}
          </BsText>
        </BsKpiCard>
        <BsKpiCard :title="t('metrics.unfinished')">
          <BsText as="span" size="lg" emphasis="bold">
            {{ summary.unfinished_tasks }}
          </BsText>
        </BsKpiCard>
      </BsGrid>
      <BsStack gap="sm" as="section">
        <BsInline justify="between">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ t('incidents.title') }}
            </BsHeading>
            <BsText size="sm" tone="muted">
              {{ t('incidents.subtitle') }}
            </BsText>
          </BsStack>
          <BsSelect v-model="severity" :label="t('incidents.title')" :options="severityOptions" option-label="label" option-value="value" />
        </BsInline>
        <BsGrid v-if="incidents.length" columns="auto">
          <BsCard v-for="incident in incidents" :key="incident.id" padding="sm">
            <BsStack gap="sm">
              <BsStack gap="sm">
                <BsInline justify="between">
                  <BsInline>
                    <BsStatusBadge :status="incident.severity" :label="incident.severity" :tone="automationStatusTone(incident.severity)" />
                    <BsText size="xs" tone="muted">
                      {{ incident.kind }}
                    </BsText>
                  </BsInline>
                  <BsText size="xs" tone="muted">
                    {{ incident.suit_slug }} {{ incident.task_id }}
                  </BsText>
                </BsInline>
                <BsAlert :tone="incident.severity === 'critical' ? 'error' : incident.severity" :title="incident.title" :description="incident.detail" />
                <BsContentSection title="Recovery" variant="flat">
                  <BsText size="sm">
                    {{ incident.recovery }}
                  </BsText>
                </BsContentSection>
                <BsDisclosure summary="Evidence">
                  <BsCodeBlock language="json" :code="JSON.stringify(incident.evidence, null, 2)" />
                </BsDisclosure>
              </BsStack>
            </BsStack>
          </BsCard>
        </BsGrid>
        <BsCard v-else padding="lg">
          <BsStack gap="sm">
            {{ t('incidents.empty') }}
          </BsStack>
        </BsCard>
      </BsStack>
      <BsGrid :columns="2" as="section">
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsInline justify="between">
              <BsStack gap="sm">
                <BsHeading :level="2">
                  {{ t('runtime.title') }}
                </BsHeading>
                <BsText size="xs" tone="muted">
                  {{ t('runtime.subtitle') }}
                </BsText>
              </BsStack>
              <BsStatusBadge :status="data.runtimeTelemetryAvailable ? 'available' : 'not installed'" :label="data.runtimeTelemetryAvailable ? 'available' : 'not installed'" :tone="automationStatusTone(data.runtimeTelemetryAvailable ? 'available' : 'not installed')" />
            </BsInline>
            <BsStack v-if="data.runtimeTelemetryAvailable && activeRuntime.length" gap="sm">
              <BsCard v-for="row in activeRuntime" :key="row.n8n_execution_id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsStack gap="sm">
                      <BsText emphasis="semibold">
                        {{ row.suit_slug || 'Unresolved Suit' }}
                      </BsText>
                      <BsText size="xs" tone="muted">
                        {{ row.task_id || 'No task' }} · {{ row.n8n_execution_id }}
                      </BsText>
                    </BsStack>
                    <BsStatusBadge :status="row.runtime_status" :label="(row.runtime_status) || 'unknown'" :tone="automationStatusTone(row.runtime_status)" />
                  </BsInline>
                  <BsDescriptionList density="compact" :columns="2">
                    <BsDescriptionItem term="Node">
                      {{ row.current_node || '—' }}
                    </BsDescriptionItem>
                    <BsDescriptionItem term="Stage">
                      {{ row.current_stage || '—' }}
                    </BsDescriptionItem>
                    <BsDescriptionItem term="Started">
                      {{ formatDate(row.started_at) }}
                    </BsDescriptionItem>
                    <BsDescriptionItem term="Heartbeat">
                      {{ formatDate(row.last_heartbeat_at) }}
                    </BsDescriptionItem>
                  </BsDescriptionList>
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else-if="!data.runtimeTelemetryAvailable" size="sm">
              {{ t('runtime.installHint') }}
            </BsText>
            <BsText v-else size="sm" tone="muted">
              {{ t('runtime.idle') }}
            </BsText>
          </BsStack>
        </BsCard>
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ t('runs.title') }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ t('runs.subtitle') }}
            </BsText>
            <BsStack v-if="activeRuns.length" gap="sm">
              <BsCard v-for="run in activeRuns" :key="run.run_id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsStack gap="sm">
                      <BsText emphasis="semibold">
                        {{ run.suit_slug }}
                      </BsText>
                      <BsText size="xs" tone="muted">
                        {{ compactId(run.run_id) }}
                      </BsText>
                    </BsStack>
                    <BsStatusBadge :status="run.status" :label="(run.status) || 'unknown'" :tone="automationStatusTone(run.status)" />
                  </BsInline>
                  <BsUsageMeter :item="{ id: run.run_id, label: t('runs.title'), used: run.completed_tasks, limit: run.max_tasks || null, valueLabel: `${run.completed_tasks} / ${run.max_tasks} · ${progress(run)}%` }" compact />
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else size="sm" tone="muted">
              {{ t('runs.idle') }}
            </BsText>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsCard as="section" padding="none">
        <BsStack gap="sm">
          <BsInline justify="between">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ t('tasks.title') }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ t('tasks.subtitle') }}
              </BsText>
            </BsStack>
            <BsCheckbox v-model="showCompleted" :label="t('tasks.showCompleted')" />
          </BsInline>
          <BsDataTable :value="visibleTasks" row-key="task_id" :label="t('tasks.title')" scroll-label="Tasks" :columns="taskColumns">
            <template #cell-status="{ row: task }">
              <BsStatusBadge :status="task.status" :label="(task.status) || 'unknown'" :tone="automationStatusTone(task.status)" />
            </template>
            <template #cell-risk_model="{ row: task }">
              <BsText size="xs" tone="muted">
                {{ task.risk_level }} · {{ task.model_profile }}
              </BsText>
            </template>
            <template #cell-updated_at="{ row: task }">
              <BsText size="xs" tone="muted">
                {{ formatDate(task.updated_at) }}
              </BsText>
            </template>
          </BsDataTable>
        </BsStack>
      </BsCard>
      <BsGrid :columns="2" as="section">
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ t('verification.title') }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ t('verification.subtitle') }}
            </BsText>
            <BsStack v-if="failingVerification.length" gap="sm">
              <BsCard v-for="row in failingVerification.slice(0, 12)" :key="row.verification_id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsText as="span" size="xs">
                      {{ row.task_id }}
                    </BsText>
                    <BsStatusBadge :status="row.status" :label="(row.status) || 'unknown'" :tone="automationStatusTone(row.status)" />
                  </BsInline>
                  <BsText emphasis="semibold">
                    {{ row.check_name }}
                  </BsText>
                  <BsText size="xs" tone="muted">
                    {{ row.summary || row.command || 'No summary recorded' }}
                  </BsText>
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else size="sm" tone="muted">
              {{ t('verification.empty') }}
            </BsText>
          </BsStack>
        </BsCard>
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ t('decisions.title') }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ t('decisions.subtitle') }}
            </BsText>
            <BsStack v-if="openDecisions.length" gap="sm">
              <BsCard v-for="row in openDecisions.slice(0, 12)" :key="`${row.suit_slug}:${row.decision_id}`" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsText as="span" size="xs">
                      {{ row.decision_id }}
                    </BsText>
                    <BsText as="span" size="xs" tone="muted" emphasis="semibold">
                      {{ row.blocking_tasks }} blocking
                    </BsText>
                  </BsInline>
                  <BsText emphasis="semibold">
                    {{ row.title }}
                  </BsText>
                  <BsText size="xs" tone="muted">
                    {{ row.decision_text || 'No decision text' }}
                  </BsText>
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else size="sm" tone="muted">
              {{ t('decisions.empty') }}
            </BsText>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsGrid :columns="2" as="section">
        <BsCard padding="none">
          <BsStack gap="sm">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ t('executions.title') }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ t('executions.subtitle') }}
              </BsText>
            </BsStack>
            <BsDataTable :value="data.executions" row-key="execution_id" label="Executions" density="compact" sticky-header max-height="34rem" scroll-label="Executions" :columns="executionColumns">
              <template #cell-status="{ row }">
                <BsStatusBadge :status="row.status" :label="(row.status) || 'unknown'" :tone="automationStatusTone(row.status)" />
              </template>
              <template #cell-branch_name="{ row }">
                <BsText size="xs" tone="muted">
                  {{ row.branch_name || '—' }}
                </BsText>
              </template>
              <template #cell-started="{ row }">
                <BsText size="xs" tone="muted">
                  {{ formatDate(row.started_at || row.created_at) }}
                </BsText>
              </template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsCard padding="none">
          <BsStack gap="sm">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ t('events.title') }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ t('events.subtitle') }}
              </BsText>
            </BsStack>
            <BsStack gap="sm">
              <BsDisclosure v-for="row in data.events" :key="row.event_id" :summary="`${row.task_id} · ${row.event_type} · ${formatDate(row.created_at)} · ${row.source} · ${row.from_status || '—'} → ${row.to_status || '—'}`">
                <BsCodeBlock>
                  {{ JSON.stringify(row.payload, null, 2) }}
                </BsCodeBlock>
              </BsDisclosure>
            </BsStack>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsCard as="section" padding="sm">
        <BsStack gap="sm">
          {{ t('dashboard.readOnlyFooter') }}
        </BsStack>
      </BsCard>
    </template>
  </BsPage>
</template>
