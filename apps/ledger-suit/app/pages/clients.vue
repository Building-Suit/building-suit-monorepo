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
</script>

<template>
  <div class="space-y-6" data-client-portfolio>
    <LedgerPageHeader :title="t('clientPortfolio.title')" :subtitle="t('clientPortfolio.subtitle')" />

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" :aria-label="t('clientPortfolio.summary')">
      <BsKpiCard v-for="status in FILTER_OPTIONS" :key="status" :title="t(`clientPortfolio.filters.${status}`)"><span class="tabular-nums">{{ counts[status] }}</span></BsKpiCard>
    </section>

    <section class="ls-card space-y-4 p-4" :aria-label="t('clientPortfolio.filters.label')">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem_auto] md:items-end">
        <FloatingField :label="t('clientPortfolio.searchLabel')">
          <input v-model="query" type="search" class="ls-input" :placeholder="t('clientPortfolio.searchPlaceholder')">
        </FloatingField>
        <FloatingField :label="t('clientPortfolio.healthFilter')">
          <BsSelect v-model="filter" :label="t('clientPortfolio.healthFilter')" :options="filterOptions" option-label="label" option-value="value" />
        </FloatingField>
        <BsButton type="button" class="ls-btn" :disabled="pending" @click="load">
          {{ t('clientPortfolio.refresh') }}
        </BsButton>
      </div>
      <p class="text-sm text-fg-muted">{{ t('clientPortfolio.signalNote') }}</p>
    </section>

    <SectionSkeleton v-if="pending && !rows.length" variant="table" :rows="5" />

    <section v-else-if="error" class="ls-card space-y-3 p-6" role="alert">
      <h2 class="font-bold">{{ t('clientPortfolio.loadFailed') }}</h2>
      <p class="text-sm text-fg-muted">{{ t('clientPortfolio.loadFailedHint') }}</p>
      <BsButton type="button" class="ls-btn" @click="load">{{ t('common.retry') }}</BsButton>
    </section>

    <EmptyState
      v-else-if="!filteredRows.length"
      :title="t(rows.length ? 'clientPortfolio.noMatches' : 'clientPortfolio.empty')"
      :description="t(rows.length ? 'clientPortfolio.noMatchesHint' : 'clientPortfolio.emptyHint')"
    />

    <section v-else class="ls-card overflow-hidden" aria-labelledby="client-portfolio-table-heading">
      <h2 id="client-portfolio-table-heading" class="sr-only">{{ t('clientPortfolio.tableLabel') }}</h2>
      <div class="overflow-x-auto">
        <BsDataTable :value="filteredRows" data-key="id" :table-props="{ 'aria-label': t('clientPortfolio.tableLabel') }">
          <Column body-class="min-w-60">
            <template #header>{{ t('clientPortfolio.client') }}</template>
            <template #body="{ data: row }">
              <p class="font-semibold">{{ row.name }}</p>
              <p v-if="row.legalName" class="text-xs text-fg-muted">{{ row.legalName }}</p>
              <p class="text-xs text-fg-muted">{{ roleLabel(row.role, row.roleId) }} · {{ row.baseCurrency }}</p>
            </template>
          </Column>
          <Column>
            <template #header>{{ t('clientPortfolio.health') }}</template>
            <template #body="{ data: row }">
              <StatusBadge class="whitespace-nowrap" :status="row.health" :label="t(`clientPortfolio.healthStates.${row.health}`)" :tone="healthTone(row.health)" />
            </template>
          </Column>
          <Column body-class="whitespace-nowrap">
            <template #header>{{ t('clientPortfolio.period') }}</template>
            <template #body="{ data: row }">{{ signalText(row.period, 'clientPortfolio.periodStates') }}</template>
          </Column>
          <Column body-class="whitespace-nowrap">
            <template #header>{{ t('clientPortfolio.reconciliation') }}</template>
            <template #body="{ data: row }">{{ signalText(row.reconciliation, 'clientPortfolio.reconciliationStates') }}</template>
          </Column>
          <Column body-class="whitespace-nowrap">
            <template #header>{{ t('clientPortfolio.lastActivity') }}</template>
            <template #body="{ data: row }">
              {{ row.lastActivity.state === 'unavailable'
                ? t('clientPortfolio.unavailable')
                : row.lastActivity.value
                  ? formatDate(row.lastActivity.value, locale)
                  : t('clientPortfolio.noActivity') }}
            </template>
          </Column>
          <Column header-class="text-end" body-class="text-end whitespace-nowrap">
            <template #header><span class="sr-only">{{ t('clientPortfolio.actions') }}</span></template>
            <template #body="{ data: row }">
              <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="Boolean(openingId)" @click="openClient(row)">
                {{ openingId === row.id ? t('clientPortfolio.opening') : t('clientPortfolio.openClient') }}
              </BsButton>
            </template>
          </Column>
        </BsDataTable>
      </div>
    </section>
  </div>
</template>
