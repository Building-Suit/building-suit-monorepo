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

const clientViews = computed(() => filteredRows.value.map(row => ({ id: row.id, name: row.name, legalName: row.legalName ?? undefined, identity: `${roleLabel(row.role, row.roleId)} · ${row.baseCurrency}`, health: row.health, healthLabel: t(`clientPortfolio.healthStates.${row.health}`), healthTone: healthTone(row.health), period: signalText(row.period, 'clientPortfolio.periodStates'), reconciliation: signalText(row.reconciliation, 'clientPortfolio.reconciliationStates'), activity: row.lastActivity.state === 'unavailable' ? t('clientPortfolio.unavailable') : row.lastActivity.value ? formatDate(row.lastActivity.value, locale.value) : t('clientPortfolio.noActivity') })))
const metrics = computed(() => FILTER_OPTIONS.map(status => ({ id: status, label: t(`clientPortfolio.filters.${status}`), value: counts.value[status] })))
const copy = computed(() => ({
  title: t('clientPortfolio.title'),
  subtitle: t('clientPortfolio.subtitle'),
  summary: t('clientPortfolio.summary'),
  filters: t('clientPortfolio.filters.label'),
  searchLabel: t('clientPortfolio.searchLabel'),
  searchPlaceholder: t('clientPortfolio.searchPlaceholder'),
  healthFilter: t('clientPortfolio.healthFilter'),
  refresh: t('clientPortfolio.refresh'),
  signalNote: t('clientPortfolio.signalNote'),
  loadFailed: t('clientPortfolio.loadFailed'),
  loadFailedHint: t('clientPortfolio.loadFailedHint'),
  tableLabel: t('clientPortfolio.tableLabel'),
  client: t('clientPortfolio.client'),
  health: t('clientPortfolio.health'),
  period: t('clientPortfolio.period'),
  reconciliation: t('clientPortfolio.reconciliation'),
  lastActivity: t('clientPortfolio.lastActivity'),
  unavailable: t('clientPortfolio.unavailable'),
  noActivity: t('clientPortfolio.noActivity'),
  actions: t('clientPortfolio.actions'),
  opening: t('clientPortfolio.opening'),
  openClient: t('clientPortfolio.openClient'),
  retry: t('common.retry'), emptyTitle: t(rows.value.length ? 'clientPortfolio.noMatches' : 'clientPortfolio.empty'), emptyDescription: t(rows.value.length ? 'clientPortfolio.noMatchesHint' : 'clientPortfolio.emptyHint'),
}))
function setFilter(value: string) { if (FILTER_OPTIONS.includes(value as PortfolioFilter)) filter.value = value as PortfolioFilter }
function openClientById(id: string) { const row = rows.value.find(row => row.id === id); if (row) return openClient(row) }
</script>
<template>
  <BsClientPortfolioPage v-model:query="query" :filter="filter" :items="clientViews" :copy="copy" :context="ledgerPresentation.context(undefined, undefined, undefined)" :context-label="ledgerPresentation.t('pageContext.label')" :metrics="metrics" :filter-options="filterOptions" :pending="pending" :error="Boolean(error)" :has-rows="Boolean(rows.length)" :opening-id="openingId" @update:filter="setFilter" @refresh="load" @open-client="openClientById" />
</template>
