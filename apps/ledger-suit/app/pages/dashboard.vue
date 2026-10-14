<script setup lang="ts">
import type { BsDashboardCopy, BsDashboardFilters, BsDashboardSetupForm, BsDashboardView, BsDashboardTable, BsDashboardMetric, BsDashboardRow } from '@building-suit/ui/types/dashboardPresentation'

import type { Database } from '~~/types/database.types'
import type { DashboardRpcDatabase } from '~~/types/dashboard-rpc.types'
import type { LedgerSeriesPoint as SeriesPoint } from '~/composables/useLedgerPresentation'

definePageMeta({ layout: 'default' }) // Authenticated workspace route.

const supabase = useSupabaseClient<Database>()
const dashboardRpc = useSupabaseClient<DashboardRpcDatabase>()
const { currentId, can, baseCurrency } = useTenant()
const { start } = useAddTransaction()
const { show: showOperations } = useOperationsCenter()
const { t, locale } = useI18n()

useHead({ title: () => `${t('dashboard.title')} · ${t('app.name')}` })

const months = ref(6)
const customRange = ref(false)
const customFrom = ref(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().slice(0, 10))
const customTo = ref(new Date().toISOString().slice(0, 10))
const seriesMonths = computed(() => {
  if (!customRange.value) return months.value
  const from = new Date(`${customFrom.value}T00:00:00`)
  const to = new Date(`${customTo.value}T00:00:00`)
  return Math.max(1, Math.min(60, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1))
})

interface Summary {
  base_currency: string
  total_assets_minor: number
  total_liabilities_minor: number
  net_worth_minor: number
  cash_and_bank_minor: number
  accounts_receivable_minor: number
  accounts_payable_minor: number
  revenue_this_month_minor: number
  expenses_this_month_minor: number
  net_profit_this_month_minor: number
  revenue_previous_month_minor: number
  expenses_previous_month_minor: number
  net_profit_previous_month_minor: number
}

// Every figure below is computed by the database. Nothing on this page
// recalculates a total from rows it fetched.
const { data: summary, pending: summaryPending, error: summaryError, refresh: refreshSummary } = useLazyAsyncData<Summary | null>('org:dashboard', async () => {
  if (!currentId.value) return null
  const { data, error } = await supabase.rpc('dashboard_summary', {
    p_organization_id: currentId.value,
  })
  if (error) throw error
  return data as unknown as Summary
}, { watch: [currentId] })

const { data: series, pending: seriesPending, error: seriesError, refresh: refreshSeries } = useLazyAsyncData<SeriesPoint[]>('org:dashboard-series', async () => {
  if (!currentId.value) return []
  const { data, error } = await supabase.rpc('report_monthly_series', {
    p_organization_id: currentId.value,
    p_months: seriesMonths.value,
    p_as_of_date: customRange.value ? customTo.value : undefined,
  })
  if (error) throw error
  return (data ?? []) as unknown as SeriesPoint[]
}, { watch: [currentId, months, customRange, customFrom, customTo], default: () => [] })

const { data: liquid, pending: liquidPending, error: liquidError, refresh: refreshLiquid } = useLazyAsyncData('org:cash-position', async () => {
  if (!currentId.value) return []
  if (!can('accounts.read')) return []
  const { data, error } = await dashboardRpc.rpc('dashboard_liquid_accounts', {
    p_organization_id: currentId.value,
  })
  if (error) throw error
  return data ?? []
}, { watch: [currentId, () => can('accounts.read')], default: () => [] })

const { data: recent, pending: recentPending, error: recentError, refresh: refreshRecent } = useLazyAsyncData('org:recent-transactions', async () => {
  if (!currentId.value) return []
  const { data, error } = await supabase.rpc('search_transactions', {
    p_organization_id: currentId.value,
    p_limit: 8,
  })
  if (error) throw error
  return data ?? []
}, { watch: [currentId], default: () => [] })

const hasActivity = computed(() => (recent.value?.length ?? 0) > 0)

const { data: commitments, pending: commitmentsPending, error: commitmentsError, refresh: refreshCommitments } = useLazyAsyncData('org:dashboard-commitments', async () => {
  if (!currentId.value || !can('commitments.read')) return []
  const { data, error } = await supabase.from('commitment_states').select('id,title,due_date,display_status,outstanding_minor,currency_code').eq('organization_id', currentId.value).in('display_status', ['due', 'due_soon', 'overdue', 'partially_paid']).order('due_date').limit(8)
  if (error) throw error
  return data ?? []
}, { watch: [currentId], default: () => [] })

const upcomingCommitments = computed(() => commitments.value.filter(c => c.display_status !== 'overdue').reduce((sum, c) => sum + Number(c.outstanding_minor ?? 0), 0))
const overdueCommitments = computed(() => commitments.value.filter(c => c.display_status === 'overdue').reduce((sum, c) => sum + Number(c.outstanding_minor ?? 0), 0))

const payableHint = computed(() =>
  t('dashboard.payableHint', {
    amount: formatMoney(summary.value?.accounts_payable_minor ?? 0, baseCurrency.value, locale.value),
  }),
)
const ledgerPresentation = useLedgerPresentation()
const setupChecklist = useLedgerSetupChecklist()

const dashboardSetupOpen = ref(false)
const dashboardSetupForm = ref<BsDashboardSetupForm>({ name: '', mode: '' })
const dashboardFilters = computed<BsDashboardFilters>({ get: () => ({ period: '', date: '', location: '', months: months.value, custom: customRange.value, from: customFrom.value, to: customTo.value }), set: value => { months.value = value.months; customRange.value = value.custom; customFrom.value = value.from; customTo.value = value.to } })
const dashboardMonths = computed(() => [3, 6, 12].map(value => ({ value, label: t('dashboard.months', { count: value }) })))
const dashboardCopy = computed<BsDashboardCopy>(() => ({ retry: t('common.retry'), cancel: t('common.cancel'), create: '', name: '', mode: '', plan: '', filters: '', location: '', date: '', range: t('dashboard.chartRange'), custom: t('dashboard.custom'), from: t('reports.from'), to: t('reports.to'), source: t('dashboard.viewAll'), manage: t('dashboard.manage'), start: t('dashboard.emptyAction') }))
const dashboardView = computed<BsDashboardView>(() => {
 const value = summary.value
 const metric = (id: string, title: string, amount: number | null | undefined, previous: number | null | undefined = null, direction: 'neutral' | 'up' | 'down' = 'neutral', hint = ''): BsDashboardMetric => ({ id, title, value: formatMoney(amount || 0, baseCurrency.value, locale.value), hint, changeLabel: ledgerPresentation.kpi(amount, previous, direction).label || '', tone: ledgerPresentation.kpi(amount, previous, direction).tone, to: '', source: null })
 const row = (id: string, name: string, cells: Record<string, string>, status = ''): BsDashboardRow => ({ id, name, cells, status, to: '', source: null })
 const table = (title: string, empty: string, rows: BsDashboardRow[], columns: BsDashboardTable['columns'], loading: boolean, error: string, to = '', action = false): BsDashboardTable => ({ title, empty, rows, columns, loading, error, to, action })
 return {
  title: t('dashboard.title'), subtitle: '', workspace: '', role: '', notice: '', available: true, loading: recentPending.value, error: recentError.value ? t('dashboard.recentLoadError') : '', denied: '', empty: !hasActivity.value && !recentPending.value && !recentError.value ? t('dashboard.emptyTitle') : '', emptyDescription: t('dashboard.emptyHint'), canStart: can('transactions.create'), errorDescription: t('dashboard.loadErrorHint'),
  checklist: { visible: true, title: t('setupChecklist.title'), description: t('setupChecklist.hint'), progress: setupChecklist.progress, steps: setupChecklist.steps, loading: setupChecklist.pending, error: setupChecklist.error ? t('setupChecklist.loadFailed') : null, empty: t('setupChecklist.optional') },
  setup: { title: '', description: '', trial: '', modeHelp: '', dirty: false, pending: false, error: '' }, plan: { visible: false, error: '', name: '', status: '', dateLabel: '', date: '' }, periodFilter: false,
  metricsLoading: summaryPending.value || commitmentsPending.value, metricsError: summaryError.value ? t('dashboard.summaryLoadError') : '', metricsTitle: t('dashboard.kpis'), metrics: [metric('assets', t('dashboard.totalAssets'), value?.total_assets_minor), metric('liabilities', t('dashboard.totalLiabilities'), value?.total_liabilities_minor), metric('worth', t('dashboard.netWorth'), value?.net_worth_minor, null, 'neutral', t('dashboard.netWorthHint')), metric('cash', t('dashboard.cashAndBank'), value?.cash_and_bank_minor), metric('revenue', t('dashboard.revenueThisMonth'), value?.revenue_this_month_minor, value?.revenue_previous_month_minor, 'up'), metric('expenses', t('dashboard.expensesThisMonth'), value?.expenses_this_month_minor, value?.expenses_previous_month_minor, 'down'), metric('profit', t('dashboard.netProfitThisMonth'), value?.net_profit_this_month_minor, value?.net_profit_previous_month_minor, 'up'), metric('receivable', t('dashboard.receivable'), value?.accounts_receivable_minor, null, 'neutral', payableHint.value), ...(can('commitments.read') && !commitmentsError.value ? [metric('upcoming', t('dashboard.upcomingCommitments'), upcomingCommitments.value), metric('overdue', t('dashboard.overdueCommitments'), overdueCommitments.value, null, 'down')] : [])], highlightsLoading: false, highlights: [],
  reportLink: { visible: false, title: '', description: '', to: '' }, chart: { visible: true, loading: seriesPending.value, error: seriesError.value ? t('dashboard.seriesLoadError') : '', title: t('dashboard.revenueVsExpenses'), pointLabel: t('dashboard.month'), tableLabel: t('common.showAsTable'), empty: t('dashboard.noLiquidAccounts'), points: ledgerPresentation.chartPoints(series.value || []), series: ledgerPresentation.chartSeries, tableSeries: ledgerPresentation.chartTableSeries },
  cashPosition: table(t('dashboard.cashPosition'), t('dashboard.noLiquidAccounts'), (liquid.value || []).map(account => row(String(account.account_id), account.name, { amount: formatMoney(account.net_debit_minor, baseCurrency.value, locale.value) })), [{ key: 'name', header: '' }, { key: 'amount', header: '', align: 'end' }], liquidPending.value, liquidError.value ? t('dashboard.liquidLoadError') : ''),
  commitments: can('commitments.read') ? table(t('dashboard.commitments'), t('dashboard.noCommitments'), commitments.value.map(item => row(String(item.id), item.title || '', { date: formatDate(item.due_date, locale.value), amount: formatMoney(item.outstanding_minor || 0, item.currency_code || baseCurrency.value, locale.value) }, item.display_status || 'unknown')), [{ key: 'name', header: '' }, { key: 'date', header: '' }, { key: 'status', header: '' }, { key: 'amount', header: '', align: 'end' }], commitmentsPending.value, commitmentsError.value ? t('dashboard.commitmentsLoadError') : '', '', true) : null,
  recent: table(t('dashboard.recent'), t('common.dash'), (recent.value || []).map(item => row(String(item.id), '', { date: formatDate(item.transaction_date, locale.value), description: item.description || t('common.dash'), category: item.category_name || t('common.dash'), account: `${item.from_account_name || ''} → ${item.to_account_name || ''}`, amount: formatMoney(Math.max(item.debit_minor, item.credit_minor), item.currency_code || baseCurrency.value, locale.value) }, item.status)), [{ key: 'date', header: t('transactions.date') }, { key: 'description', header: t('transactions.description') }, { key: 'category', header: t('transactions.category') }, { key: 'account', header: t('transactions.account') }, { key: 'status', header: t('transactions.status') }, { key: 'amount', header: t('transactions.amount'), align: 'end' }], false, '', '/transactions'),
  salesMix: { visible: false, title: '', empty: '', rows: [] }, paymentMix: { visible: false, title: '', empty: '', rows: [] }, appointments: { visible: false, title: '', empty: '', source: null, metrics: [], busiestTitle: '', busiest: [] }, cash: { visible: false, title: '', source: null, metrics: [] }, customers: null, staff: null, locations: null,
 }
})
</script>
<template>
  <BsDashboardPage v-model:filters="dashboardFilters" v-model:setup-form="dashboardSetupForm" v-model:setup-open="dashboardSetupOpen" :copy="dashboardCopy" :view="dashboardView" :locations="[]" :periods="[]" :month-options="dashboardMonths" :modes="[]" :constraints="{ nameMinimum: 2, nameMaximum: 120 }" @retry="refreshRecent()" @retry-checklist="setupChecklist.refresh()" @retry-metrics="refreshSummary()" @retry-chart="refreshSeries()" @retry-cash-position="refreshLiquid()" @retry-commitments="refreshCommitments()" @manage-commitments="showOperations('commitments')" @start="start('expense')"/>
</template>
