<script setup lang="ts">
import type { BsDashboardCopy, BsDashboardFilters, BsDashboardSetupForm, BsDashboardView } from '../types/dashboardPresentation'
withDefaults(defineProps<{ variant?: 'default' | 'shop'; copy: BsDashboardCopy; view: BsDashboardView; locations: { value: string; label: string }[]; periods: { value: string; label: string }[]; monthOptions: { value: number; label: string }[]; modes: { value: string; label: string; body: string }[]; constraints: { nameMinimum: number; nameMaximum: number } }>(), { variant: 'default' })
const filters = defineModel<BsDashboardFilters>('filters', { required: true })
const setupForm = defineModel<BsDashboardSetupForm>('setupForm', { required: true })
const setupOpen = defineModel<boolean>('setupOpen', { required: true })
const emit = defineEmits<{ retry: []; retryChecklist: []; retryPlan: []; retryMetrics: []; retryChart: []; retryCashPosition: []; retryCommitments: []; manageCommitments: []; source: [location: string, path: string]; start: []; setup: []; create: [] }>()
function filter<K extends keyof BsDashboardFilters>(key: K, value: BsDashboardFilters[K]) { filters.value = { ...filters.value, [key]: value } }
</script>
<template>
  <BsStack gap="lg" class="bs-dashboard-page" :class="{ 'bs-dashboard-page--shop': variant === 'shop' }">
    <BsText v-if="view.notice" role="status" as="p" size="sm" tone="warning">{{ view.notice }}</BsText>
    <template v-if="!view.available">
      <BsPanel padding="md"><BsIcon name="store"/><BsHeading :level="1">{{ view.setup.title }}</BsHeading><BsText as="p" size="sm" tone="muted">{{ view.setup.description }}</BsText><BsButton @click="emit('setup')">{{ copy.create }}</BsButton></BsPanel>
    </template>
    <template v-else>
      <BsPageHeader :title="view.title" :subtitle="view.subtitle" :class="{ 'bs-dashboard-header': variant === 'shop' }"><template #actions><BsStack v-if="variant === 'shop'" gap="sm" class="bs-dashboard-context"><BsInline gap="xs"><BsText v-if="view.workspace" size="sm" emphasis="medium">{{ view.workspace }}</BsText><BsText v-if="view.role" size="sm" emphasis="medium">· {{ view.role }}</BsText></BsInline><BsLink v-if="view.reportLink.visible" :to="view.reportLink.to">{{ view.reportLink.title }}</BsLink></BsStack><template v-else><BsText v-if="view.workspace" size="xs" emphasis="semibold">{{ view.workspace }}</BsText><BsText v-if="view.role" size="xs" emphasis="semibold">{{ view.role }}</BsText></template></template></BsPageHeader>
      <BsSetupChecklist v-if="variant !== 'shop' && view.checklist.visible" data-setup-checklist :title="view.checklist.title" :progress-label="view.checklist.progress" :description="view.checklist.description" :steps="view.checklist.steps" :loading="view.checklist.loading" :error="view.checklist.error" :empty-label="view.checklist.empty" :retry-label="copy.retry" @retry="emit('retryChecklist')"/>
      <BsPanel v-if="variant !== 'shop' && view.plan.visible" padding="md"><BsHeading :level="2">{{ copy.plan }}</BsHeading><BsStateSurface v-if="view.plan.error" state="error" :title="view.plan.error" :action-label="copy.retry" @action="emit('retryPlan')"/><template v-else><BsText as="p">{{ view.plan.name }}: {{ view.plan.status }}</BsText><BsText v-if="view.plan.date" as="p">{{ view.plan.dateLabel }}: {{ view.plan.date }}</BsText></template></BsPanel>
      <BsFilterBar v-if="view.periodFilter" :label="copy.filters" :class="{ 'bs-dashboard-filterbar': variant === 'shop' }"><BsGrid :columns="3">
        <BsField v-slot="field" :label="copy.location"><BsSelect :model-value="filters.location" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.location" :options="locations" option-label="label" option-value="value" @update:model-value="filter('location', String($event))"/></BsField>
        <BsField v-slot="field" :label="copy.date"><BsInput :id="field.id" :model-value="filters.date" :aria-describedby="field.describedby" type="date" @update:model-value="filter('date', String($event ?? ''))"/></BsField>
        <BsFieldGroup :legend="copy.range"><BsInline :class="{ 'bs-dashboard-periods': variant === 'shop' }"><BsButton v-for="period in periods" :key="period.value" :variant="variant === 'shop' ? 'default' : 'chip'" :aria-pressed="filters.period === period.value" @click="filter('period', period.value)">{{ period.label }}</BsButton></BsInline></BsFieldGroup>
      </BsGrid></BsFilterBar>
      <BsActionTile v-if="variant !== 'shop' && view.reportLink.visible" :to="view.reportLink.to"><BsText as="strong">{{ view.reportLink.title }}</BsText><BsText size="sm" tone="muted">{{ view.reportLink.description }}</BsText><BsText>{{ copy.source }}</BsText></BsActionTile>
      <BsText v-if="variant === 'shop' && view.periodLabel" as="p" size="sm" tone="muted" class="bs-dashboard-period-label">{{ view.periodLabel }}</BsText>
      <BsSectionSkeleton v-if="view.loading" variant="cards"/>
      <BsStateSurface v-else-if="view.error" state="error" :title="view.error" :description="view.errorDescription" :action-label="copy.retry" @action="emit('retry')"/>
      <BsText v-else-if="view.denied" role="status" size="sm" tone="muted">{{ view.denied }}</BsText>
      <BsEmptyState v-else-if="view.empty" :title="view.empty" :description="view.emptyDescription" :action-label="view.canStart ? copy.start : undefined" @action="emit('start')"/>
      <template v-else>
        <BsSectionSkeleton v-if="view.metricsLoading" variant="cards"/>
        <BsStateSurface v-else-if="view.metricsError" state="error" :title="view.metricsError" :description="view.errorDescription" :action-label="copy.retry" @action="emit('retryMetrics')"/>
        <BsStack v-else gap="md"><BsHeading v-if="view.metricsTitle" :level="2" size="body">{{ view.metricsTitle }}</BsHeading><BsMetricGrid>
          <BsDashboardMetric v-for="(metric, index) in view.metrics" :key="metric.id" :metric="metric" :appearance="index === 0 ? 'primary' : index === 1 ? 'accent' : 'default'" @source="(location, path) => emit('source', location, path)" />
        </BsMetricGrid></BsStack>
        <BsGrid v-if="variant !== 'shop' && (view.chart.visible || view.cashPosition)" :columns="3" gap="lg">
          <BsSectionSkeleton v-if="view.chart.visible && view.chart.loading" variant="chart"/>
          <BsStateSurface v-else-if="view.chart.visible && view.chart.error" state="error" :title="view.chart.error" :description="view.errorDescription" :action-label="copy.retry" @action="emit('retryChart')"/>
          <BsCard v-else-if="view.chart.visible" as="section" variant="chart" padding="lg" :span="2"><BsInline justify="between"><BsHeading :level="2">{{ view.chart.title }}</BsHeading><BsInline role="group" :aria-label="copy.range"><BsButton v-for="option in monthOptions" :key="option.value" variant="chip" :aria-pressed="filters.months === option.value && !filters.custom" @click="filters = { ...filters, months: option.value, custom: false }">{{ option.label }}</BsButton><BsButton size="sm" :variant="filters.custom ? 'primary' : 'default'" @click="filter('custom', !filters.custom)">{{ copy.custom }}</BsButton></BsInline></BsInline>
            <BsInline v-if="filters.custom"><BsField v-slot="field" :label="copy.from"><BsInput :id="field.id" :model-value="filters.from" type="date" @update:model-value="filter('from', String($event ?? ''))"/></BsField><BsField v-slot="field" :label="copy.to"><BsInput :id="field.id" :model-value="filters.to" type="date" @update:model-value="filter('to', String($event ?? ''))"/></BsField></BsInline>
            <BsMetricBarChart :points="view.chart.points" :series="view.chart.series" :table-series="view.chart.tableSeries" :point-label="view.chart.pointLabel" :label="view.chart.title" :table-label="view.chart.tableLabel" :empty-label="view.chart.empty"/>
          </BsCard>
          <BsDashboardTable v-if="view.cashPosition" :view="view.cashPosition" :retry-label="copy.retry" :source-label="copy.source" :manage-label="copy.manage" @retry="emit('retryCashPosition')"/>
        </BsGrid>
        <div v-if="variant === 'shop' && (view.chart.visible || view.salesMix.visible)" class="bs-dashboard-analytics">
          <BsCard v-if="view.chart.visible" as="section" variant="chart" padding="lg" class="bs-dashboard-analytics__main">
            <BsInline justify="between"><BsHeading :level="2">{{ view.chart.title }}</BsHeading><BsLink v-if="view.reportLink.visible" :to="view.reportLink.to">{{ copy.source }}</BsLink></BsInline>
            <BsMetricBarChart presentation="dashboard" :points="view.chart.points" :series="view.chart.series" :table-series="view.chart.tableSeries" :point-label="view.chart.pointLabel" :label="view.chart.title" :table-label="view.chart.tableLabel" :empty-label="view.chart.empty" :loading="view.chart.loading" :error="view.chart.error" />
          </BsCard>
          <BsMetricChart v-if="view.salesMix.visible" presentation="dashboard" kind="donut" :title="view.salesMix.title" :empty-label="view.salesMix.empty" :action="view.salesMix.action" :items="view.salesMix.rows.map(row => ({ id: row.id, label: row.name, hint: row.hint, value: row.value ?? 0, formatted: row.amount }))" />
        </div>
        <BsMetricGrid v-if="view.highlights.length || view.highlightsLoading" :columns="variant === 'shop' ? 3 : 4" variant="compact">
          <BsDashboardMetric v-for="metric in view.highlights" :key="metric.id" :metric="metric" appearance="compact" @source="(location, path) => emit('source', location, path)" />
          <template v-if="view.highlightsLoading && !view.highlights.length"><BsSkeleton v-for="index in 3" :key="index" /></template>
        </BsMetricGrid>
        <BsText v-if="view.metricsNotice" as="p" size="xs" tone="muted" class="bs-dashboard-metrics-notice">{{ view.metricsNotice }}</BsText>
        <BsGrid v-if="variant !== 'shop' && (view.salesMix.visible || view.paymentMix.visible)" :columns="2"><BsPanel v-for="mix in [view.salesMix, view.paymentMix].filter(item => item.visible)" :key="mix.title" padding="md"><BsHeading :level="2">{{ mix.title }}</BsHeading><BsText v-if="!mix.rows.length" size="sm" tone="muted">{{ mix.empty }}</BsText><BsInline v-for="row in mix.rows" :key="row.id" justify="between"><BsBox><BsText as="p" emphasis="semibold">{{ row.name }}</BsText><BsText as="p" size="xs" tone="muted">{{ row.hint }}</BsText></BsBox><BsText as="strong">{{ row.amount }}</BsText></BsInline></BsPanel></BsGrid>
        <BsGrid v-if="view.appointments.visible || view.cash.visible || (variant === 'shop' && view.paymentMix.visible)" :columns="variant === 'shop' ? 3 : 2" :class="{ 'bs-dashboard-operations': variant === 'shop' }"><BsMetricChart v-if="variant === 'shop' && view.paymentMix.visible" presentation="dashboard" :title="view.paymentMix.title" :empty-label="view.paymentMix.empty" :action="view.paymentMix.action" :items="view.paymentMix.rows.map(row => ({ id: row.id, label: row.name, hint: row.hint, value: row.value ?? 0, formatted: row.amount }))" /><BsPanel v-if="view.appointments.visible" padding="md"><BsInline justify="between"><BsHeading :level="2">{{ view.appointments.title }}</BsHeading><BsButton v-if="view.appointments.source" variant="link" @click="emit('source', view.appointments.source.location, view.appointments.source.path)">{{ copy.source }}</BsButton></BsInline><BsText v-if="!view.appointments.metrics.length" size="sm" tone="muted">{{ view.appointments.empty }}</BsText><BsGrid :columns="4"><BsBox v-for="metric in view.appointments.metrics" :key="metric.title"><BsText as="p" size="xs" tone="muted">{{ metric.title }}</BsText><BsText as="strong" size="lg">{{ metric.value }}</BsText></BsBox></BsGrid><BsText v-if="view.appointments.busiest.length" size="xs" emphasis="semibold">{{ view.appointments.busiestTitle }}</BsText><BsInline><BsText v-for="time in view.appointments.busiest" :key="time.id" size="sm">{{ time.label }}</BsText></BsInline></BsPanel><BsPanel v-if="view.cash.visible" padding="md"><BsInline justify="between"><BsHeading :level="2">{{ view.cash.title }}</BsHeading><BsButton v-if="view.cash.source" variant="link" @click="emit('source', view.cash.source.location, view.cash.source.path)">{{ copy.source }}</BsButton></BsInline><BsGrid :columns="2"><BsBox v-for="metric in view.cash.metrics" :key="metric.title"><BsText as="p" size="xs" tone="muted">{{ metric.title }}</BsText><BsText as="strong" size="lg">{{ metric.value }}</BsText></BsBox></BsGrid></BsPanel></BsGrid>
        <BsDashboardTable v-if="view.commitments" :view="view.commitments" :retry-label="copy.retry" :source-label="copy.source" :manage-label="copy.manage" @retry="emit('retryCommitments')" @manage="emit('manageCommitments')"/>
        <BsDashboardTable v-if="view.recent" :view="view.recent" :retry-label="copy.retry" :source-label="copy.source" :manage-label="copy.manage"/>
        <div v-if="view.customers || view.staff || view.locations" class="bs-dashboard-tables" :class="{ 'bs-dashboard-tables--shop': variant === 'shop' }">
        <BsDashboardTable v-for="table in [view.customers, view.staff, view.locations].filter(Boolean)" :key="table!.title" :view="table!" :retry-label="copy.retry" :source-label="copy.source" :manage-label="copy.manage" @source="(location, path) => emit('source', location, path)"/>
        </div>
      </template>
      <BsGrid v-if="variant === 'shop' && (view.plan.visible || view.checklist.visible)" :columns="2">
        <BsPanel v-if="view.plan.visible" padding="md"><BsHeading :level="2">{{ copy.plan }}</BsHeading><BsStateSurface v-if="view.plan.error" state="error" :title="view.plan.error" :action-label="copy.retry" @action="emit('retryPlan')"/><template v-else><BsText as="p">{{ view.plan.name }}: {{ view.plan.status }}</BsText><BsText v-if="view.plan.date" as="p">{{ view.plan.dateLabel }}: {{ view.plan.date }}</BsText></template></BsPanel>
        <BsSetupChecklist v-if="view.checklist.visible" data-setup-checklist :title="view.checklist.title" :progress-label="view.checklist.progress" :description="view.checklist.description" :steps="view.checklist.steps" :loading="view.checklist.loading" :error="view.checklist.error" :empty-label="view.checklist.empty" :retry-label="copy.retry" @retry="emit('retryChecklist')"/>
      </BsGrid>
    </template>
    <BsRecordActionDialog v-model:visible="setupOpen" :title="view.setup.title" :dirty="view.setup.dirty" :pending="view.setup.pending" :error="view.setup.error" :submit-label="copy.create" :cancel-label="copy.cancel" @submit="emit('create')"><BsField v-slot="field" :label="copy.name"><BsInput :id="field.id" :model-value="setupForm.name" :aria-describedby="field.describedby" :minlength="constraints.nameMinimum" :maxlength="constraints.nameMaximum" required @update:model-value="setupForm = { ...setupForm, name: String($event ?? '') }"/></BsField><BsFieldGroup :legend="copy.mode"><BsText size="sm" tone="muted">{{ view.setup.modeHelp }}</BsText><BsGrid :columns="3"><BsRadio v-for="mode in modes" :key="mode.value" :model-value="setupForm.mode" name="business-mode" :value="mode.value" :label="mode.label + mode.body" @update:model-value="setupForm = { ...setupForm, mode: String($event) }"/></BsGrid></BsFieldGroup><BsText as="p" emphasis="semibold">{{ view.setup.trial }}</BsText><BsText size="sm" tone="muted">{{ view.setup.description }}</BsText></BsRecordActionDialog>
  </BsStack>
</template>

<style scoped>
.bs-dashboard-page--shop {
  container: bs-dashboard / inline-size;
  gap: var(--bs-space-5);
}
.bs-dashboard-header { align-items: center; }
.bs-dashboard-header :deep(.bs-page-header__subtitle) { max-inline-size: 64ch; }
.bs-dashboard-context { align-items: flex-end; }
.bs-dashboard-context :deep(a), .bs-dashboard-page--shop :deep(.bs-mix-chart a) { font-size: var(--bs-type-caption-size); }
.bs-dashboard-filterbar { border: 0; border-radius: 0; background: transparent; padding: 0; }
.bs-dashboard-filterbar :deep(.bs-grid) { grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-4); }
.bs-dashboard-operations { grid-template-columns: minmax(0, 1fr); }
.bs-dashboard-filterbar :deep(.ls-field), .bs-dashboard-filterbar :deep(.bs-field-group) { min-inline-size: 0; }
.bs-dashboard-periods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--bs-space-1); padding: var(--bs-space-1); background: var(--bs-surface-muted); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); }
.bs-dashboard-periods :deep(button) { min-block-size: 36px; padding: var(--bs-space-1) var(--bs-space-3); border-color: transparent; background: transparent; }
.bs-dashboard-periods :deep(button[aria-pressed='true']) { background: var(--bs-surface); color: var(--bs-primary); border-color: var(--bs-border); box-shadow: var(--bs-elevation-1); }
.bs-dashboard-period-label { margin-block-start: calc(-1 * var(--bs-space-3)); }
.bs-dashboard-analytics { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--bs-space-4); }
.bs-dashboard-analytics > * { min-inline-size: 0; }
.bs-dashboard-analytics__main :deep(.bs-metric-chart) { margin-block-start: var(--bs-space-5); }
.bs-dashboard-metrics-notice { margin-block-start: calc(-1 * var(--bs-space-3)); max-inline-size: 90ch; }
.bs-dashboard-tables { display: grid; gap: var(--bs-space-4); }
@container bs-dashboard (min-width: 56rem) {
  .bs-dashboard-filterbar :deep(.bs-grid) { grid-template-columns: minmax(12rem, 1fr) minmax(11rem, .8fr) minmax(16rem, 1.1fr); }
  .bs-dashboard-analytics { grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); }
  .bs-dashboard-tables--shop { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bs-dashboard-tables--shop > :last-child:nth-child(odd) { grid-column: 1 / -1; }
}
@container bs-dashboard (min-width: 68rem) {
  .bs-dashboard-operations { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
