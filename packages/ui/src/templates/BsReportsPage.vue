<script setup lang="ts">
import type { BsReportsCopy, BsReportsView, BsReportFilters, BsReportChoices } from '../types/reportsPresentation'
defineProps<{ copy: BsReportsCopy; view: BsReportsView; choices: BsReportChoices }>()
const filters = defineModel<BsReportFilters>('filters', { required: true })
const emit = defineEmits<{ export: []; retry: []; page: [direction: number] }>()
function updateFilter(key: keyof BsReportFilters, value: string | number | boolean | null | undefined) { filters.value = { ...filters.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsText as="p" size="xs" emphasis="semibold">{{ view.workspace }}</BsText>
        <BsButton variant="primary" :pending="view.exporting" :disabled="view.exportDisabled" @click="emit('export')">{{ view.exportLabel }}</BsButton>
      </template>
    </BsPageHeader>
    <BsText as="p" size="sm" tone="warning">{{ view.notice }}</BsText>
    <BsText v-if="view.detailNotice" as="p" size="sm" tone="muted">{{ view.detailNotice }}</BsText>
    <BsFilterBar :label="copy.title">
      <BsGrid :columns="4">
        <BsField v-slot="field" :label="copy.title">
          <BsSelect :model-value="filters.report" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.title" :options="choices.reports" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="updateFilter('report', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.location">
          <BsSelect :model-value="filters.location" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.location" :options="choices.locations" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="updateFilter('location', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.from">
          <BsInput :id="field.id" :model-value="filters.from" :aria-describedby="field.describedby" type="date" :disabled="view.dateDisabled" @update:model-value="updateFilter('from', $event)"/>
        </BsField>
        <BsField v-slot="field" :label="copy.to">
          <BsInput :id="field.id" :model-value="filters.to" :aria-describedby="field.describedby" type="date" :disabled="view.dateDisabled" @update:model-value="updateFilter('to', $event)"/>
        </BsField>
      </BsGrid>
      <BsText as="p" size="xs" tone="muted">{{ copy.fullHistory }}</BsText>
    </BsFilterBar>
    <BsText v-if="view.failed" role="alert" as="p" size="sm" tone="danger">{{ copy.failed }} <BsButton @click="emit('retry')">{{ copy.retry }}</BsButton>
    </BsText>
    <BsText v-else-if="view.exportError" role="alert" as="p" size="sm" tone="danger">{{ view.exportError }}</BsText>
    <BsText v-if="view.loading" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
    <BsText v-else-if="view.denied" as="p" size="sm" tone="muted">{{ copy.denied }}</BsText>
    <BsText v-else-if="view.restricted" as="p" size="sm" tone="muted">{{ copy.costDenied }}</BsText>
    <template v-else>
      <BsGrid :columns="4">
        <BsActionTile v-for="metric in view.summary" :key="metric.id" :to="metric.to">
          <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ metric.label }}</BsText>
          <BsText as="p" size="lg" emphasis="semibold">{{ metric.value }}</BsText>
          <BsText as="span" size="xs" emphasis="semibold">{{ copy.open }}</BsText>
        </BsActionTile>
      </BsGrid>
      <BsPanel id="report-results" padding="md">
        <BsBox scroll="x">
          <BsDataTable :value="view.rows" data-key="id" :columns="[...(view.columns).map(column => ({ key: column.key, header: column.label })), { key: 'column1', header: (copy.open), align: 'end' }]">
            <template v-for="column in view.columns" :key="column.key" #[`cell-${column.key}`]="{ row: row }">
              <BsLink v-if="column.primary && row.sourceTo" :to="row.sourceTo">{{ row.cells[column.key] }}</BsLink>
              <BsText v-else as="span">{{ row.cells[column.key] }}</BsText>
            </template>
            <template #cell-column1="{ row: row }">
              <BsLink v-if="row.sourceTo" :to="row.sourceTo">{{ copy.open }}</BsLink>
            </template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
        <BsInline v-if="view.total" justify="between">
          <BsText as="p" tone="muted">{{ view.pagination }}</BsText>
          <BsInline>
            <BsButton :disabled="view.previousDisabled" @click="emit('page', -1)">{{ copy.previous }}</BsButton>
            <BsButton :disabled="view.nextDisabled" @click="emit('page', 1)">{{ copy.next }}</BsButton>
          </BsInline>
        </BsInline>
      </BsPanel>
    </template>
  </BsStack>
</template>
