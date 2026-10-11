<script setup lang="ts">
import type { ClientHealthRow, PortfolioFilter } from '~/utils/clientHealth'
import { filterClientHealthRows } from '~/utils/clientHealth'

definePageMeta({ layout: 'default' })

const { t, locale } = useI18n()
const { currentId, roleLabel, setOrganization } = useTenant()
const { rows, pending, error, load } = useClientPortfolio()
const query = ref('')
const filter = ref<PortfolioFilter>('all')
const openingId = ref<string | null>(null)
const FILTER_OPTIONS = ['all', 'healthy', 'needs_attention', 'unavailable'] as const
const filterOptions = computed(() => FILTER_OPTIONS.map(value => ({ value, label: t(`clientPortfolio.filters.${value}`) })))

useHead({ title: () => `${t('clientPortfolio.title')} · ${t('app.name')}` })

await load()

const filteredRows = computed(() => filterClientHealthRows(rows.value, query.value, filter.value, locale.value))
const counts = computed(() => ({
  all: rows.value.length,
  healthy: rows.value.filter(row => row.health === 'healthy').length,
  needs_attention: rows.value.filter(row => row.health === 'needs_attention').length,
  unavailable: rows.value.filter(row => row.health === 'unavailable').length,
}))

function signalText<T>(signal: { state: 'available', value: T } | { state: 'unavailable' }, key: string) {
  return signal.state === 'available' ? t(`${key}.${String(signal.value)}`) : t('clientPortfolio.unavailable')
}

function healthTone(health: ClientHealthRow['health']) {
  if (health === 'healthy') return 'success' as const
  if (health === 'needs_attention') return 'warning' as const
  return 'neutral' as const
}

async function openClient(row: ClientHealthRow) {
  openingId.value = row.id
  try {
    const selected = await setOrganization(row.id)
    if (selected && currentId.value === row.id) await navigateTo('/dashboard')
  }
  finally {
    if (openingId.value === row.id) openingId.value = null
  }
}
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack data-client-portfolio gap="lg">
    <BsPageHeader
      :title="t('clientPortfolio.title')"
      :subtitle="t('clientPortfolio.subtitle')"
      :context="ledgerPresentation.context(undefined, undefined, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsGrid :aria-label="t('clientPortfolio.summary')" :columns="4" gap="md" as="section">
      <BsKpiCard v-for="status in FILTER_OPTIONS" :key="status" :title="t(`clientPortfolio.filters.${status}`)">
        <BsText as="span" numeric>{{ counts[status] }}</BsText>
      </BsKpiCard>
    </BsGrid>
    <BsCard :aria-label="t('clientPortfolio.filters.label')" as="section" padding="md">
      <BsStack gap="md">
        <BsGrid :columns="1" gap="md">
          <BsFloatingField :label="t('clientPortfolio.searchLabel')">
            <BsInput v-model="query" type="search" :placeholder="t('clientPortfolio.searchPlaceholder')" />
          </BsFloatingField>
          <BsFloatingField :label="t('clientPortfolio.healthFilter')">
            <BsSelect v-model="filter" :label="t('clientPortfolio.healthFilter')" :options="filterOptions" option-label="label" option-value="value" />
          </BsFloatingField>
          <BsButton type="button" :disabled="pending" @click="load">{{ t('clientPortfolio.refresh') }}</BsButton>
        </BsGrid>
        <BsText size="sm" tone="muted">{{ t('clientPortfolio.signalNote') }}</BsText>
      </BsStack>
    </BsCard>
    <BsSectionSkeleton v-if="pending && !rows.length" variant="table" :rows="5" />
    <BsCard v-else-if="error" role="alert" as="section" padding="lg">
      <BsStack gap="md">
        <BsHeading :level="2" size="body">{{ t('clientPortfolio.loadFailed') }}</BsHeading>
        <BsText size="sm" tone="muted">{{ t('clientPortfolio.loadFailedHint') }}</BsText>
        <BsButton type="button" @click="load">{{ t('common.retry') }}</BsButton>
      </BsStack>
    </BsCard>
    <BsEmptyState
      v-else-if="!filteredRows.length"
      :title="t(rows.length ? 'clientPortfolio.noMatches' : 'clientPortfolio.empty')"
      :description="t(rows.length ? 'clientPortfolio.noMatchesHint' : 'clientPortfolio.emptyHint')"
    />
    <BsCard v-else aria-labelledby="client-portfolio-table-heading" as="section" padding="none" overflow="hidden">
      <BsHeading id="client-portfolio-table-heading" :level="2" size="body">{{ t('clientPortfolio.tableLabel') }}</BsHeading>
      <BsBox>
        <BsDataTable
          :value="filteredRows"
          row-key="id"
          :label="t('clientPortfolio.tableLabel')"
          :columns="[{ key: 'column1', header: (t('clientPortfolio.client')) }, { key: 'column2', header: (t('clientPortfolio.health')) }, { key: 'column3', header: (t('clientPortfolio.period')) }, { key: 'column4', header: (t('clientPortfolio.reconciliation')) }, { key: 'column5', header: (t('clientPortfolio.lastActivity')) }, { key: 'column6', header: '', align: 'end' as const }]"
        >
          <template #header-column1>{{ t('clientPortfolio.client') }}</template>
          <template #cell-column1="{ row }">
            <BsText emphasis="semibold">{{ row.name }}</BsText>
            <BsText v-if="row.legalName" size="xs" tone="muted">{{ row.legalName }}</BsText>
            <BsText size="xs" tone="muted">{{ roleLabel(row.role, row.roleId) }} · {{ row.baseCurrency }}</BsText>
          </template>
          <template #header-column2>{{ t('clientPortfolio.health') }}</template>
          <template #cell-column2="{ row }">
            <BsStatusBadge :status="row.health" :label="t(`clientPortfolio.healthStates.${row.health}`)" :tone="healthTone(row.health)" />
          </template>
          <template #header-column3>{{ t('clientPortfolio.period') }}</template>
          <template #cell-column3="{ row }">{{ signalText(row.period, 'clientPortfolio.periodStates') }}</template>
          <template #header-column4>{{ t('clientPortfolio.reconciliation') }}</template>
          <template #cell-column4="{ row }">{{ signalText(row.reconciliation, 'clientPortfolio.reconciliationStates') }}</template>
          <template #header-column5>{{ t('clientPortfolio.lastActivity') }}</template>
          <template #cell-column5="{ row }">{{ row.lastActivity.state === 'unavailable'
              ? t('clientPortfolio.unavailable')
              : row.lastActivity.value
                ? formatDate(row.lastActivity.value, locale)
                : t('clientPortfolio.noActivity') }}</template>
          <template #header-column6>
            <BsVisuallyHidden>{{ t('clientPortfolio.actions') }}</BsVisuallyHidden>
          </template>
          <template #cell-column6="{ row }">
            <BsButton type="button" :disabled="Boolean(openingId)" size="sm" @click="openClient(row)">{{ openingId === row.id ? t('clientPortfolio.opening') : t('clientPortfolio.openClient') }}</BsButton>
          </template>
        </BsDataTable>
      </BsBox>
    </BsCard>
  </BsStack>
</template>
