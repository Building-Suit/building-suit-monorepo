<script setup lang="ts">
import type { BsOperationsDashboardView, BsOperationsDashboardCopy } from '../types/operationsDashboardPresentation'
const selectedSuit = defineModel<string>('selectedSuit', { required: true })
const severity = defineModel<string>('severity', { required: true })
const showCompleted = defineModel<boolean>('showCompleted', { required: true })
const props = defineProps<{ dashboard?: BsOperationsDashboardView | null; copy: BsOperationsDashboardCopy; loading: boolean; error?: string | null; suitOptions: { value: string; label: string }[]; severityOptions: { value: string; label: string }[] }>()
const emit = defineEmits<{ refresh: [] }>()
const taskColumns = computed(() => [
  { key: 'id', header: props.copy.taskColumns.task, field: 'id', width: 'content' as const }, { key: 'suit', header: props.copy.taskColumns.suit, field: 'suit' }, { key: 'title', header: props.copy.taskColumns.title, field: 'title', width: 'xl' as const }, { key: 'status', header: props.copy.taskColumns.status }, { key: 'riskModel', header: props.copy.taskColumns.riskModel }, { key: 'updated', header: props.copy.taskColumns.updated, width: 'content' as const },
])
const executionColumns = computed(() => [
  { key: 'id', header: props.copy.executionColumns.id, field: 'id', width: 'content' as const }, { key: 'task', header: props.copy.executionColumns.task, field: 'task', width: 'content' as const }, { key: 'status', header: props.copy.executionColumns.status }, { key: 'attempt', header: props.copy.executionColumns.attempt, field: 'attempt' }, { key: 'branch', header: props.copy.executionColumns.branch }, { key: 'started', header: props.copy.executionColumns.started, width: 'content' as const },
])
</script>
<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between" align="start" collapse="md" as="section">
      <BsStack gap="sm">
        <BsText size="xs" tone="muted" emphasis="semibold">
          {{ copy['dashboard.eyebrow'] }}
        </BsText>
        <BsHeading :level="1">
          {{ copy['dashboard.title'] }}
        </BsHeading>
        <BsText size="sm" tone="muted">
          {{ copy['dashboard.subtitle'] }}
        </BsText>
      </BsStack>
      <BsInline>
        <BsSelect v-model="selectedSuit" :label="copy['dashboard.allSuits']" :options="suitOptions" option-label="label" option-value="value" />
        <BsButton @click="emit('refresh')">
          {{ copy['dashboard.refresh'] }}
        </BsButton>
      </BsInline>
    </BsInline>
    <BsAlert v-if="error" tone="error" :title="copy['dashboard.loadFailed']" :description="error" />
    <BsCard v-if="loading && !dashboard" as="section" padding="lg" aria-busy="true">
      <BsStack gap="sm">
        {{ copy['dashboard.loading'] }}
      </BsStack>
    </BsCard>
    <template v-if="dashboard">
      <BsCard as="section" padding="sm">
        <BsInline justify="between" collapse="md">
          <BsStack gap="sm">
            <BsInline>
              <BsStatusBadge :status="dashboard.telemetry.status" :label="dashboard.telemetry.statusLabel" :tone="dashboard.telemetry.statusTone" />
              <BsText size="xs" tone="muted">{{ copy['dashboard.generated'] }} {{ dashboard.telemetry.generated }}</BsText>
            </BsInline>
            <BsText size="sm" tone="muted">{{ dashboard.telemetry.description }}</BsText>
          </BsStack>
          <BsDescriptionList density="compact">
            <BsDescriptionItem :term="copy.database" orientation="inline">{{ dashboard.database.name }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.role" orientation="inline">{{ dashboard.database.role }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.server" orientation="inline">{{ dashboard.database.server }}</BsDescriptionItem>
          </BsDescriptionList>
        </BsInline>
      </BsCard>
      <BsGrid columns="auto" min-item-width="sm" as="section"><BsKpiCard v-for="metric in dashboard.metrics" :key="metric.id" :title="metric.label" :tone="metric.tone"><BsText as="span" size="lg" emphasis="bold" :tone="metric.textTone">{{ metric.value }}</BsText></BsKpiCard></BsGrid>
      <BsStack gap="sm" as="section">
        <BsInline justify="between">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ copy['incidents.title'] }}
            </BsHeading>
            <BsText size="sm" tone="muted">
              {{ copy['incidents.subtitle'] }}
            </BsText>
          </BsStack>
          <BsSelect v-model="severity" :label="copy['incidents.title']" :options="severityOptions" option-label="label" option-value="value" />
        </BsInline>
        <BsGrid v-if="dashboard.incidents.length" columns="auto">
          <BsCard v-for="incident in dashboard.incidents" :key="incident.id" padding="sm">
            <BsStack gap="sm">
              <BsStack gap="sm">
                <BsInline justify="between">
                  <BsInline>
                    <BsStatusBadge :status="incident.status" :label="incident.statusLabel" :tone="incident.statusTone" />
                    <BsText size="xs" tone="muted">
                      {{ incident.kind }}
                    </BsText>
                  </BsInline>
                  <BsText size="xs" tone="muted">
                    {{ incident.context }}
                  </BsText>
                </BsInline>
                <BsAlert :tone="incident.alertTone" :title="incident.title" :description="incident.detail" />
                <BsContentSection :title="copy.recovery" variant="flat">
                  <BsText size="sm">
                    {{ incident.recovery }}
                  </BsText>
                </BsContentSection>
                <BsDisclosure :summary="copy.evidence">
                  <BsCodeBlock language="json" :code="incident.evidence" />
                </BsDisclosure>
              </BsStack>
            </BsStack>
          </BsCard>
        </BsGrid>
        <BsCard v-else padding="lg">
          <BsStack gap="sm">
            {{ copy['incidents.empty'] }}
          </BsStack>
        </BsCard>
      </BsStack>
      <BsGrid :columns="2" as="section">
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsInline justify="between">
              <BsStack gap="sm">
                <BsHeading :level="2">
                  {{ copy['runtime.title'] }}
                </BsHeading>
                <BsText size="xs" tone="muted">
                  {{ copy['runtime.subtitle'] }}
                </BsText>
              </BsStack>
              <BsStatusBadge :status="dashboard.telemetry.availability.status" :label="dashboard.telemetry.availability.statusLabel" :tone="dashboard.telemetry.availability.statusTone" />
            </BsInline>
            <BsStack v-if="dashboard.telemetry.available && dashboard.runtime.length" gap="sm">
              <BsCard v-for="row in dashboard.runtime" :key="row.id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsStack gap="sm">
                      <BsText emphasis="semibold">
                        {{ row.suit }}
                      </BsText>
                      <BsText size="xs" tone="muted">
                        {{ row.subtitle }}
                      </BsText>
                    </BsStack>
                    <BsStatusBadge :status="row.status" :label="row.statusLabel" :tone="row.statusTone" />
                  </BsInline>
                  <BsDescriptionList density="compact" :columns="2">
                    <BsDescriptionItem :term="copy.node">
                      {{ row.node }}
                    </BsDescriptionItem>
                    <BsDescriptionItem :term="copy.stage">
                      {{ row.stage }}
                    </BsDescriptionItem>
                    <BsDescriptionItem :term="copy.started">
                      {{ row.started }}
                    </BsDescriptionItem>
                    <BsDescriptionItem :term="copy.heartbeat">
                      {{ row.heartbeat }}
                    </BsDescriptionItem>
                  </BsDescriptionList>
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else-if="!dashboard.telemetry.available" size="sm">
              {{ copy['runtime.installHint'] }}
            </BsText>
            <BsText v-else size="sm" tone="muted">
              {{ copy['runtime.idle'] }}
            </BsText>
          </BsStack>
        </BsCard>
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ copy['runs.title'] }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ copy['runs.subtitle'] }}
            </BsText>
            <BsStack v-if="dashboard.runs.length" gap="sm">
              <BsCard v-for="run in dashboard.runs" :key="run.id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsStack gap="sm">
                      <BsText emphasis="semibold">
                        {{ run.suit }}
                      </BsText>
                      <BsText size="xs" tone="muted">
                        {{ run.displayId }}
                      </BsText>
                    </BsStack>
                    <BsStatusBadge :status="run.status" :label="run.statusLabel" :tone="run.statusTone" />
                  </BsInline>
                  <BsUsageMeter :item="{ id: run.id, label: copy['runs.title'], used: run.used, limit: run.limit, valueLabel: run.valueLabel }" compact />
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else size="sm" tone="muted">
              {{ copy['runs.idle'] }}
            </BsText>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsCard as="section" padding="none">
        <BsStack gap="sm">
          <BsInline justify="between">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ copy['tasks.title'] }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ copy['tasks.subtitle'] }}
              </BsText>
            </BsStack>
            <BsCheckbox v-model="showCompleted" :label="copy['tasks.showCompleted']" />
          </BsInline>
          <BsDataTable :value="dashboard.tasks" row-key="id" :label="copy['tasks.title']" :scroll-label="copy['tasks.title']" :columns="taskColumns">
            <template #cell-status="{ row: task }">
              <BsStatusBadge :status="task.status" :label="task.statusLabel" :tone="task.statusTone" />
            </template>
            <template #cell-riskModel="{ row: task }">
              <BsText size="xs" tone="muted">
                {{ task.riskModel }}
              </BsText>
            </template>
            <template #cell-updated="{ row: task }">
              <BsText size="xs" tone="muted">
                {{ task.updated }}
              </BsText>
            </template>
          </BsDataTable>
        </BsStack>
      </BsCard>
      <BsGrid :columns="2" as="section">
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ copy['verification.title'] }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ copy['verification.subtitle'] }}
            </BsText>
            <BsStack v-if="dashboard.verification.length" gap="sm">
              <BsCard v-for="row in dashboard.verification" :key="row.id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsText as="span" size="xs">
                      {{ row.task }}
                    </BsText>
                    <BsStatusBadge :status="row.status" :label="row.statusLabel" :tone="row.statusTone" />
                  </BsInline>
                  <BsText emphasis="semibold">
                    {{ row.name }}
                  </BsText>
                  <BsText size="xs" tone="muted">
                    {{ row.description }}
                  </BsText>
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else size="sm" tone="muted">
              {{ copy['verification.empty'] }}
            </BsText>
          </BsStack>
        </BsCard>
        <BsCard padding="sm">
          <BsStack gap="sm">
            <BsHeading :level="2">
              {{ copy['decisions.title'] }}
            </BsHeading>
            <BsText size="xs" tone="muted">
              {{ copy['decisions.subtitle'] }}
            </BsText>
            <BsStack v-if="dashboard.decisions.length" gap="sm">
              <BsCard v-for="row in dashboard.decisions" :key="row.id" variant="flat" padding="sm">
                <BsStack gap="sm">
                  <BsInline justify="between">
                    <BsText as="span" size="xs">
                      {{ row.displayId }}
                    </BsText>
                    <BsText as="span" size="xs" tone="muted" emphasis="semibold">
                      {{ row.blocking }}
                    </BsText>
                  </BsInline>
                  <BsText emphasis="semibold">
                    {{ row.title }}
                  </BsText>
                  <BsText size="xs" tone="muted">
                    {{ row.description }}
                  </BsText>
                </BsStack>
              </BsCard>
            </BsStack>
            <BsText v-else size="sm" tone="muted">
              {{ copy['decisions.empty'] }}
            </BsText>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsGrid :columns="2" as="section">
        <BsCard padding="none">
          <BsStack gap="sm">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ copy['executions.title'] }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ copy['executions.subtitle'] }}
              </BsText>
            </BsStack>
            <BsDataTable :value="dashboard.executions" row-key="id" :label="copy['executions.title']" density="compact" sticky-header max-height="34rem" :scroll-label="copy['executions.title']" :columns="executionColumns">
              <template #cell-status="{ row }">
                <BsStatusBadge :status="row.status" :label="row.statusLabel" :tone="row.statusTone" />
              </template>
              <template #cell-branch="{ row }">
                <BsText size="xs" tone="muted">
                  {{ row.branch }}
                </BsText>
              </template>
              <template #cell-started="{ row }">
                <BsText size="xs" tone="muted">
                  {{ row.started }}
                </BsText>
              </template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsCard padding="none">
          <BsStack gap="sm">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ copy['events.title'] }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ copy['events.subtitle'] }}
              </BsText>
            </BsStack>
            <BsStack gap="sm">
              <BsDisclosure v-for="row in dashboard.events" :key="row.id" :summary="row.summary">
                <BsCodeBlock>
                  {{ row.payload }}
                </BsCodeBlock>
              </BsDisclosure>
            </BsStack>
          </BsStack>
        </BsCard>
      </BsGrid>
      <BsCard as="section" padding="sm">
        <BsStack gap="sm">
          {{ copy['dashboard.readOnlyFooter'] }}
        </BsStack>
      </BsCard>
    </template>
  </BsPage>
</template>
