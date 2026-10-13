<script setup lang="ts">
import type { BsFinancialReportRow, BsFinancialReportColumn } from '../types/financialReportsPresentation'
defineProps<{ rows: BsFinancialReportRow[]; columns: BsFinancialReportColumn[]; label: string; accountLabel: string; totalLabel: string; density: 'compact' | 'comfortable'; scroll?: string; canAllocate?: boolean; allocateLabel?: string }>()
const emit = defineEmits<{ drilldown: [account: string, period: 'range' | 'asof' | 'opening' | 'period' | 'closing']; allocate: [id: string] }>()
</script>
<template>
 <BsDataTable :value="rows" data-key="id" :label="label" :density="density" :sticky-footer="columns.some(column => !!column.total)" sticky-header max-height="38rem" :scroll-label="scroll" :columns="[{ key: 'name', header: accountLabel, sticky: 'start', width: 'lg', footer: columns.some(column => !!column.total) ? totalLabel : undefined }, ...columns.map(column => ({ key: column.key, header: column.label, align: 'end' as const })), ...(canAllocate ? [{ key: 'allocate', header: allocateLabel || '' }] : [])]">
  <template #cell-name="{ row }"><BsText emphasis="semibold">{{ row.name }}</BsText><BsText v-if="row.code" size="xs" tone="muted">{{ row.code }}</BsText></template>
  <template v-for="(column, index) in columns" :key="column.key" #[`cell-${column.key}`]="{ row }"><BsButton v-if="row.cells[index]?.action" variant="link" :aria-label="row.cells[index].label" @click="emit('drilldown', row.cells[index].action.account, row.cells[index].action.period)">{{ row.cells[index].value }}</BsButton><BsText v-else as="span">{{ row.cells[index]?.value }}</BsText></template>
  <template v-for="column in columns.filter(column => !!column.total)" :key="column.key" #[`footer-${column.key}`]><BsText as="span">{{ column.total }}</BsText></template>
  <template #cell-allocate="{ row }"><BsButton v-if="row.allocationId" size="sm" @click="emit('allocate', row.allocationId)">{{ allocateLabel }}</BsButton></template>
 </BsDataTable>
</template>
