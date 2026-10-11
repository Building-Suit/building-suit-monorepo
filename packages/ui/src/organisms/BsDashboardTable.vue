<script setup lang="ts">
import type { BsDashboardTable } from '../types/dashboardPresentation'
defineProps<{ view: BsDashboardTable; retryLabel: string; sourceLabel: string; manageLabel: string }>()
const emit = defineEmits<{ retry: []; manage: []; source: [location: string, path: string] }>()
</script>
<template>
  <BsSectionSkeleton v-if="view.loading" variant="table" :rows="4"/>
  <BsPanel v-else padding="md">
    <BsInline justify="between"><BsHeading :level="2">{{ view.title }}</BsHeading><BsLink v-if="view.to" :to="view.to">{{ sourceLabel }}</BsLink><BsButton v-if="view.action" @click="emit('manage')">{{ manageLabel }}</BsButton></BsInline>
    <BsStateSurface v-if="view.error" state="error" :title="view.error" :action-label="retryLabel" @action="emit('retry')"/>
    <BsDataTable v-else-if="view.rows.length" :value="view.rows" data-key="id" :columns="view.columns" :label="view.title">
      <template #cell-name="{ row }"><BsLink v-if="row.to" :to="row.to">{{ row.name }}</BsLink><BsButton v-else-if="row.source" variant="link" @click="emit('source', row.source.location, row.source.path)">{{ row.name }}</BsButton><template v-else>{{ row.name }}</template></template>
      <template #cell-status="{ row }"><BsStatusBadge :status="row.status"/></template>
      <template #cell-date="{ row }">{{ row.cells.date }}</template>
      <template #cell-description="{ row }">{{ row.cells.description }}</template>
      <template #cell-category="{ row }">{{ row.cells.category }}</template>
      <template #cell-account="{ row }">{{ row.cells.account }}</template>
      <template #cell-amount="{ row }">{{ row.cells.amount }}</template>
      <template #cell-sales="{ row }">{{ row.cells.sales }}</template>
      <template #cell-collections="{ row }">{{ row.cells.collections }}</template>
      <template #cell-expenses="{ row }">{{ row.cells.expenses }}</template>
      <template #cell-variance="{ row }">{{ row.cells.variance }}</template>
      <template #cell-saleCount="{ row }">{{ row.cells.saleCount }}</template>
      <template #cell-serviceCount="{ row }">{{ row.cells.serviceCount }}</template>
    </BsDataTable>
    <BsText v-else size="sm" tone="muted">{{ view.empty }}</BsText>
  </BsPanel>
</template>
