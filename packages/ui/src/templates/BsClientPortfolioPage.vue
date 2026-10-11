<script setup lang="ts">
import type { BsClientPortfolioView, BsClientPortfolioCopy } from '../types/portfolioPresentation'
const query = defineModel<string>('query', { required: true })
const filter = defineModel<string>('filter', { required: true })
defineProps<{ items: BsClientPortfolioView[]; copy: BsClientPortfolioCopy; context: { label: string; value: string }[]; contextLabel: string; metrics: { id: string; label: string; value: number }[]; filterOptions: { value: string; label: string }[]; pending: boolean; error: boolean; hasRows: boolean; openingId: string | null }>()
const emit = defineEmits<{ refresh: []; openClient: [id: string] }>()
</script>
<template>
  <BsStack data-client-portfolio gap="lg">
    <BsPageHeader
      :title="copy.title"
      :subtitle="copy.subtitle"
      :context="context"
      :context-label="contextLabel"
    />
    <BsGrid :aria-label="copy.summary" :columns="4" gap="md" as="section">
      <BsKpiCard v-for="metric in metrics" :key="metric.id" :title="metric.label"><BsText as="span" numeric>{{ metric.value }}</BsText></BsKpiCard>
    </BsGrid>
    <BsCard :aria-label="copy.filters" as="section" padding="md">
      <BsStack gap="md">
        <BsGrid :columns="1" gap="md">
          <BsFloatingField :label="copy.searchLabel">
            <BsInput v-model="query" type="search" :placeholder="copy.searchPlaceholder" />
          </BsFloatingField>
          <BsFloatingField :label="copy.healthFilter">
            <BsSelect v-model="filter" :label="copy.healthFilter" :options="filterOptions" option-label="label" option-value="value" />
          </BsFloatingField>
          <BsButton type="button" :disabled="pending" @click="emit('refresh')">{{ copy.refresh }}</BsButton>
        </BsGrid>
        <BsText size="sm" tone="muted">{{ copy.signalNote }}</BsText>
      </BsStack>
    </BsCard>
    <BsSectionSkeleton v-if="pending && !hasRows" variant="table" :rows="5" />
    <BsCard v-else-if="error" role="alert" as="section" padding="lg">
      <BsStack gap="md">
        <BsHeading :level="2" size="body">{{ copy.loadFailed }}</BsHeading>
        <BsText size="sm" tone="muted">{{ copy.loadFailedHint }}</BsText>
        <BsButton type="button" @click="emit('refresh')">{{ copy.retry }}</BsButton>
      </BsStack>
    </BsCard>
    <BsEmptyState
      v-else-if="!items.length"
      :title="copy.emptyTitle"
      :description="copy.emptyDescription"
    />
    <BsCard v-else aria-labelledby="client-portfolio-table-heading" as="section" padding="none" overflow="hidden">
      <BsHeading id="client-portfolio-table-heading" :level="2" size="body">{{ copy.tableLabel }}</BsHeading>
      <BsBox>
        <BsDataTable
          :value="items"
          row-key="id"
          :label="copy.tableLabel"
          :columns="[{ key: 'column1', header: (copy.client) }, { key: 'column2', header: (copy.health) }, { key: 'column3', header: (copy.period) }, { key: 'column4', header: (copy.reconciliation) }, { key: 'column5', header: (copy.lastActivity) }, { key: 'column6', header: '', align: 'end' as const }]"
        >
          <template #header-column1>{{ copy.client }}</template>
          <template #cell-column1="{ row }">
            <BsText emphasis="semibold">{{ row.name }}</BsText>
            <BsText v-if="row.legalName" size="xs" tone="muted">{{ row.legalName }}</BsText>
            <BsText size="xs" tone="muted">{{ row.identity }}</BsText>
          </template>
          <template #header-column2>{{ copy.health }}</template>
          <template #cell-column2="{ row }">
            <BsStatusBadge :status="row.health" :label="row.healthLabel" :tone="row.healthTone" />
          </template>
          <template #header-column3>{{ copy.period }}</template>
          <template #cell-column3="{ row }">{{ row.period }}</template>
          <template #header-column4>{{ copy.reconciliation }}</template>
          <template #cell-column4="{ row }">{{ row.reconciliation }}</template>
          <template #header-column5>{{ copy.lastActivity }}</template>
          <template #cell-column5="{ row }">{{ row.activity }}</template>
          <template #header-column6>
            <BsVisuallyHidden>{{ copy.actions }}</BsVisuallyHidden>
          </template>
          <template #cell-column6="{ row }">
            <BsButton type="button" :disabled="Boolean(openingId)" size="sm" @click="emit('openClient', row.id)">{{ openingId === row.id ? copy.opening : copy.openClient }}</BsButton>
          </template>
        </BsDataTable>
      </BsBox>
    </BsCard>
  </BsStack>
</template>
