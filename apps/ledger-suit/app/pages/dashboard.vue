<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-h1 font-bold">{{ t('dashboard.title') }}</h1>
    <BsSetupChecklist data-setup-checklist :title="t('setupChecklist.title')" :progress-label="setupChecklist.progress" :description="t('setupChecklist.hint')" :steps="setupChecklist.steps" :loading="setupChecklist.pending" :error="setupChecklist.error ? t('setupChecklist.loadFailed') : null" :empty-label="t('setupChecklist.optional')" :retry-label="t('common.retry')" @retry="setupChecklist.refresh()" />

    <div v-if="recentPending" class="space-y-6">
      <BsSectionSkeleton variant="cards" />
      <div class="grid gap-6 xl:grid-cols-3">
        <BsSectionSkeleton class="xl:col-span-2" variant="chart" />
        <BsSectionSkeleton variant="table" :rows="4" />
      </div>
    </div>

    <BsStateSurface v-else-if="recentError" state="error" :title="t('dashboard.recentLoadError')" :description="t('dashboard.loadErrorHint')" :action-label="t('common.retry')" @action="refreshRecent()" />

    <BsEmptyState
      v-else-if="!hasActivity"
      :title="t('dashboard.emptyTitle')"
      :description="t('dashboard.emptyHint')"
      :action-label="can('transactions.create') ? t('dashboard.emptyAction') : undefined"
      @action="start('expense')"
    />

    <template v-else>
      <BsSectionSkeleton v-if="summaryPending || commitmentsPending" variant="cards" />
      <BsStateSurface v-else-if="summaryError" state="error" :title="t('dashboard.summaryLoadError')" :description="t('dashboard.loadErrorHint')" :action-label="t('common.retry')" @action="refreshSummary()" />
      <section v-else aria-labelledby="kpis" class="space-y-3">
        <h2 id="kpis" class="sr-only">{{ t('dashboard.kpis') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BsKpiCard :title="t('dashboard.totalAssets')"   :change-label="ledgerPresentation.kpi(summary?.total_assets_minor, null, 'neutral').label" :tone="ledgerPresentation.kpi(summary?.total_assets_minor, null, 'neutral').tone"><BsMoneyText :amount="summary?.total_assets_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard :title="t('dashboard.totalLiabilities')"   :change-label="ledgerPresentation.kpi(summary?.total_liabilities_minor, null, 'neutral').label" :tone="ledgerPresentation.kpi(summary?.total_liabilities_minor, null, 'neutral').tone"><BsMoneyText :amount="summary?.total_liabilities_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard :title="t('dashboard.netWorth')"   :hint="t('dashboard.netWorthHint')" :change-label="ledgerPresentation.kpi(summary?.net_worth_minor, null, 'neutral').label" :tone="ledgerPresentation.kpi(summary?.net_worth_minor, null, 'neutral').tone"><BsMoneyText :amount="summary?.net_worth_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard :title="t('dashboard.cashAndBank')"   :change-label="ledgerPresentation.kpi(summary?.cash_and_bank_minor, null, 'neutral').label" :tone="ledgerPresentation.kpi(summary?.cash_and_bank_minor, null, 'neutral').tone"><BsMoneyText :amount="summary?.cash_and_bank_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.revenueThisMonth')"

             :change-label="ledgerPresentation.kpi(summary?.revenue_this_month_minor, summary?.revenue_previous_month_minor, 'up').label" :tone="ledgerPresentation.kpi(summary?.revenue_this_month_minor, summary?.revenue_previous_month_minor, 'up').tone"><BsMoneyText :amount="summary?.revenue_this_month_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.expensesThisMonth')"

             :change-label="ledgerPresentation.kpi(summary?.expenses_this_month_minor, summary?.expenses_previous_month_minor, 'down').label" :tone="ledgerPresentation.kpi(summary?.expenses_this_month_minor, summary?.expenses_previous_month_minor, 'down').tone"><BsMoneyText :amount="summary?.expenses_this_month_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.netProfitThisMonth')"

             :change-label="ledgerPresentation.kpi(summary?.net_profit_this_month_minor, summary?.net_profit_previous_month_minor, 'up').label" :tone="ledgerPresentation.kpi(summary?.net_profit_this_month_minor, summary?.net_profit_previous_month_minor, 'up').tone"><BsMoneyText :amount="summary?.net_profit_this_month_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.receivable')"

            :hint="payableHint" :change-label="ledgerPresentation.kpi(summary?.accounts_receivable_minor, null, 'neutral').label" :tone="ledgerPresentation.kpi(summary?.accounts_receivable_minor, null, 'neutral').tone"><BsMoneyText :amount="summary?.accounts_receivable_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard v-if="can('commitments.read') && !commitmentsError" :title="t('dashboard.upcomingCommitments')"   :change-label="ledgerPresentation.kpi(upcomingCommitments, null, 'neutral').label" :tone="ledgerPresentation.kpi(upcomingCommitments, null, 'neutral').tone"><BsMoneyText :amount="upcomingCommitments" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
          <BsKpiCard v-if="can('commitments.read') && !commitmentsError" :title="t('dashboard.overdueCommitments')"   :change-label="ledgerPresentation.kpi(overdueCommitments, null, 'down').label" :tone="ledgerPresentation.kpi(overdueCommitments, null, 'down').tone"><BsMoneyText :amount="overdueCommitments" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></BsKpiCard>
        </div>
      </section>

      <div class="grid gap-6 xl:grid-cols-3">
        <BsSectionSkeleton v-if="seriesPending" class="xl:col-span-2" variant="chart" />
        <BsStateSurface v-else-if="seriesError" class="xl:col-span-2" state="error" :title="t('dashboard.seriesLoadError')" :description="t('dashboard.loadErrorHint')" :action-label="t('common.retry')" @action="refreshSeries()" />
        <section v-else class="ls-card min-w-0 p-6 xl:col-span-2" aria-labelledby="chart-heading">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="chart-heading" class="text-base font-bold">{{ t('dashboard.revenueVsExpenses') }}</h2>
            <div class="flex gap-1" role="group" :aria-label="t('dashboard.chartRange')">
              <BsButton
v-for="option in [3, 6, 12]"
                :key="option"
                variant="chip"
                type="button"
                :aria-pressed="months === option"
                @click="months = option; customRange = false"
              >
                {{ t('dashboard.months', { count: option }) }}
              </BsButton>
              <BsButton type="button" class="ls-btn ls-btn-sm" :class="{ 'ls-btn-primary': customRange }" @click="customRange = !customRange">{{ t('dashboard.custom') }}</BsButton>
            </div>
          </div>
          <div v-if="customRange" class="mb-4 flex flex-wrap gap-2"><BsFloatingField class="w-auto" :label="t('reports.from')"><input v-model="customFrom" type="date" class="ls-input w-auto"></BsFloatingField><BsFloatingField class="w-auto" :label="t('reports.to')"><input v-model="customTo" type="date" class="ls-input w-auto"></BsFloatingField></div>
          <BsMetricBarChart  :points="ledgerPresentation.chartPoints(series ?? [])" :series="ledgerPresentation.chartSeries" :table-series="ledgerPresentation.chartTableSeries" :point-label="t('dashboard.month')" :label="ledgerPresentation.t('dashboard.revenueVsExpenses')" :table-label="ledgerPresentation.t('common.showAsTable')" :empty-label="ledgerPresentation.t('dashboard.noLiquidAccounts')" />
        </section>

        <BsSectionSkeleton v-if="liquidPending" variant="table" :rows="4" />
        <section v-else-if="liquidError" class="ls-card space-y-3 p-6" role="alert" aria-labelledby="liquid-error-heading">
          <h2 id="liquid-error-heading" class="font-bold">{{ t('dashboard.liquidLoadError') }}</h2>
          <p class="text-sm text-fg-muted">{{ t('dashboard.loadErrorHint') }}</p>
          <BsButton type="button" class="ls-btn" @click="refreshLiquid()">{{ t('common.retry') }}</BsButton>
        </section>
        <section v-else class="ls-card min-w-0 p-6" aria-labelledby="cash-heading">
          <h2 id="cash-heading" class="mb-4 text-base font-bold">{{ t('dashboard.cashPosition') }}</h2>
          <BsDataTable v-if="liquid?.length" :value="liquid" :label="t('dashboard.cashPositionCaption')" :columns="[{ key: 'column1', header: '' }, { key: 'column2', header: '', align: 'end' as const }]">
            <template #cell-column1="{ row: account }">{{ account.name }}</template>
            <template #cell-column2="{ row: account }"><BsMoneyText :amount="account.net_debit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" /></template>

</BsDataTable>
          <p v-else class="text-sm text-fg-muted">{{ t('dashboard.noLiquidAccounts') }}</p>
        </section>
      </div>

      <BsSectionSkeleton v-if="can('commitments.read') && commitmentsPending" variant="table" :rows="4" />
      <section v-else-if="can('commitments.read') && commitmentsError" class="ls-card space-y-3 p-6" role="alert" aria-labelledby="commitments-error-heading">
        <h2 id="commitments-error-heading" class="font-bold">{{ t('dashboard.commitmentsLoadError') }}</h2>
        <p class="text-sm text-fg-muted">{{ t('dashboard.loadErrorHint') }}</p>
        <BsButton type="button" class="ls-btn" @click="refreshCommitments()">{{ t('common.retry') }}</BsButton>
      </section>
      <section v-else-if="can('commitments.read')" class="ls-card overflow-hidden" aria-labelledby="commitments-heading">
        <div class="flex items-center justify-between px-6 py-4"><h2 id="commitments-heading" class="text-base font-bold">{{ t('dashboard.commitments') }}</h2><BsButton type="submit" class="ls-btn ls-btn-sm" @click="showOperations('commitments')">{{ t('dashboard.manage') }}</BsButton></div>
        <div v-if="commitments.length" class="overflow-x-auto"><BsDataTable :value="commitments" :columns="[{ key: 'column1', header: '' }, { key: 'column2', header: '' }, { key: 'column3', header: '' }, { key: 'column4', header: '', align: 'end' as const }]">
          <template #cell-column1="{ row: item }">{{ item.title }}</template>
          <template #cell-column2="{ row: item }">{{ formatDate(item.due_date, locale) }}</template>
          <template #cell-column3="{ row: item }"><BsStatusBadge :status="item.display_status ?? 'unknown'" /></template>
          <template #cell-column4="{ row: item }"><BsMoneyText :amount="item.outstanding_minor ?? 0" :currency="ledgerPresentation.currency(item.currency_code ?? undefined)" :locale="ledgerPresentation.locale" /></template>

</BsDataTable></div>
        <p v-else class="px-6 pb-6 text-sm text-fg-muted">{{ t('dashboard.noCommitments') }}</p>
      </section>

      <BsSectionSkeleton v-if="recentPending" variant="table" :rows="8" />
      <section v-else class="ls-card overflow-hidden" aria-labelledby="recent-heading">
        <div class="flex items-center justify-between px-6 py-4">
          <h2 id="recent-heading" class="text-base font-bold">{{ t('dashboard.recent') }}</h2>
          <NuxtLink to="/transactions" class="text-sm font-semibold text-link hover:underline">
            {{ t('dashboard.viewAll') }}
          </NuxtLink>
        </div>
        <div class="overflow-x-auto">
          <BsDataTable :value="recent" row-key="id" :columns="[{ key: 'column1', header: (t('transactions.date')) }, { key: 'column2', header: (t('transactions.description')) }, { key: 'column3', header: (t('transactions.category')) }, { key: 'column4', header: (t('transactions.account')) }, { key: 'column5', header: (t('transactions.status')) }, { key: 'column6', header: (t('transactions.amount')), align: 'end' as const }]">
            <template #header-column1>{{ t('transactions.date') }}</template>
            <template #cell-column1="{ row }">{{ formatDate(row.transaction_date, locale) }}</template>
            <template #header-column2>{{ t('transactions.description') }}</template>
            <template #cell-column2="{ row }">{{ row.description || t('common.dash') }}</template>
            <template #header-column3>{{ t('transactions.category') }}</template>
            <template #cell-column3="{ row }">{{ row.category_name || t('common.dash') }}</template>
            <template #header-column4>{{ t('transactions.account') }}</template>
            <template #cell-column4="{ row }">{{ row.from_account_name }} <BsIcon name="arrowRight" :size="14" directional class="inline-block" /> {{ row.to_account_name }}</template>
            <template #header-column5>{{ t('transactions.status') }}</template>
            <template #cell-column5="{ row }"><BsStatusBadge :status="row.status" /></template>
            <template #header-column6>{{ t('transactions.amount') }}</template>
            <template #cell-column6="{ row }"><BsMoneyText :amount="row.amount_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" /></template>

</BsDataTable>
        </div>
      </section>
    </template>
  </div>
</template>

undefined
undefined
