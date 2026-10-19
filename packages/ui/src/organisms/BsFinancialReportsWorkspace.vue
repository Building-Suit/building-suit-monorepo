<script setup lang="ts">
import type { BsFinancialReportCopy, BsFinancialReportFilters, BsFinancialReportsView } from '../types/financialReportsPresentation'
defineProps<{ copy: BsFinancialReportCopy; view: BsFinancialReportsView }>()
const filters = defineModel<BsFinancialReportFilters>('filters', { required: true })
const emit = defineEmits<{ export: [format: 'csv' | 'excel' | 'print']; retry: []; drilldown: [account: string, period: 'range' | 'asof' | 'opening' | 'period' | 'closing']; allocate: [id: string] }>()
function field<K extends keyof BsFinancialReportFilters>(key: K, value: BsFinancialReportFilters[K]) { filters.value = { ...filters.value, [key]: value } }
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.subtitle" :context="view.context" :context-label="copy.context"/>
  <BsText v-if="view.exportError" role="alert" tone="danger">{{ view.exportError }}</BsText>
  <BsInline role="tablist" gap="xs" wrap><BsButton v-for="tab in view.tabs" :key="tab.value" variant="tab" role="tab" :aria-selected="filters.tab === tab.value" @click="field('tab', tab.value)">{{ tab.label }}</BsButton></BsInline>
  <BsInline gap="md" wrap align="end">
   <template v-if="filters.tab !== 'balance-sheet'"><BsFloatingField :label="copy.from"><BsInput id="from" :model-value="filters.from" type="date" @update:model-value="field('from', String($event ?? ''))"/></BsFloatingField><BsFloatingField :label="copy.to"><BsInput id="to" :model-value="filters.to" type="date" :min="filters.from" @update:model-value="field('to', String($event ?? ''))"/></BsFloatingField></template>
   <BsFloatingField v-else :label="copy.asOf"><BsInput id="asof" :model-value="filters.asOf" type="date" @update:model-value="field('asOf', String($event ?? ''))"/></BsFloatingField>
   <BsFloatingField v-if="filters.tab === 'ledger'" :label="copy.account"><BsSelect id="ledger-account" :label="copy.account" :model-value="filters.account" :options="view.accounts" option-label="label" option-value="value" native @update:model-value="field('account', String($event))"/></BsFloatingField>
   <BsTableDensity :model-value="filters.density" :disabled="!view.preferenceReady" :label="copy.density" :compact-label="copy.compact" :comfortable-label="copy.comfortable" @update:model-value="field('density', $event)"/>
  </BsInline>
  <BsStack role="tabpanel" :aria-label="view.tabs.find(tab => tab.value === filters.tab)?.label" gap="md">
   <BsInline v-if="view.canExport" gap="sm" wrap justify="end"><BsButton v-for="format in (['csv', 'excel', 'print'] as const)" :key="format" :disabled="view.exporting || (filters.tab === 'ledger' && !filters.account)" @click="emit('export', format)">{{ copy[format] }}</BsButton></BsInline>
   <BsText v-if="view.invalidPeriod" role="alert" tone="danger">{{ view.invalidPeriod }}</BsText>
   <BsStateSurface v-if="view.failed" state="error" :title="view.errorLabel || copy.failed" :action-label="copy.retry" @action="emit('retry')"/>
   <template v-else>
    <BsText v-for="warning in view.warnings" :key="warning" role="alert" tone="danger">{{ warning }}</BsText>
    <BsDisclosure v-if="view.reconciliation.length"><template #summary>{{ copy.reconciliation }}</template><BsFinancialReportTable :rows="view.reconciliation" :columns="view.reconciliationColumns" :label="copy.reconciliation" :account-label="copy.account" :total-label="copy.total" :density="filters.density" @drilldown="(account, period) => emit('drilldown', account, period)"/></BsDisclosure>
    <BsMetricGrid v-if="!view.loading && view.metrics.length" :columns="4"><BsKpiCard v-for="metric in view.metrics" :key="metric.id" :title="metric.label" :change-label="metric.hint" :tone="metric.tone"><BsText>{{ metric.value }}</BsText></BsKpiCard></BsMetricGrid>
    <BsSectionSkeleton v-if="view.loading" variant="table" :rows="7"/>
    <BsEmptyState v-else-if="view.empty" :title="copy.empty" :description="view.emptyHint || copy.emptyHint"/>
    <template v-else>
     <BsDescriptionList v-if="view.cashSummary.length" :columns="2"><BsDescriptionItem v-for="item in view.cashSummary" :key="item.label" :term="item.label">{{ item.value }}</BsDescriptionItem></BsDescriptionList>
     <BsText v-if="view.diagnostic" size="sm" tone="muted">{{ view.diagnostic }}</BsText>
     <template v-if="filters.tab === 'cash-flow'"><BsHeading :level="3" size="body">{{ view.adjustmentTitle }}</BsHeading><BsFinancialReportTable :rows="view.adjustments" :columns="view.columns" :label="view.adjustmentTitle" :account-label="copy.account" :total-label="copy.total" :density="filters.density" @drilldown="(account, period) => emit('drilldown', account, period)"/><BsHeading :level="3" size="body">{{ view.cashSourceTitle }}</BsHeading></template>
     <BsText v-if="view.balanceLabel" size="sm" emphasis="semibold" :tone="view.balanced ? 'success' : 'danger'">{{ view.balanceLabel }}</BsText>
     <BsCard v-for="section in view.sections" :key="section.id" padding="none" overflow="hidden"><BsInline v-if="section.title" wrap justify="between" padding="md" surface="muted"><BsHeading :level="2" size="body">{{ section.title }}</BsHeading><BsText>{{ section.total }}</BsText></BsInline><BsFinancialReportTable :rows="section.rows" :columns="view.columns" :label="section.title || copy.title" :account-label="copy.account" :total-label="copy.total" :density="filters.density" :scroll="copy.scroll" :can-allocate="filters.tab === 'cash-flow' && view.canAllocate" :allocate-label="copy.allocate" @drilldown="(account, period) => emit('drilldown', account, period)" @allocate="emit('allocate', $event)"/></BsCard>
     <BsDescriptionList v-if="view.totals.length" :columns="2"><BsDescriptionItem v-for="item in view.totals" :key="item.label" :term="item.label">{{ item.value }}</BsDescriptionItem></BsDescriptionList><BsText v-if="view.equation" size="sm" :tone="view.equationTone">{{ view.equation }}</BsText>
    </template>
   </template>
  </BsStack>
 </BsStack>
</template>
