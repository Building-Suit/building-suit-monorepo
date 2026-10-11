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
  <BsStack gap="lg">
    <BsHeading :level="1" size="h1">{{ t('dashboard.title') }}</BsHeading>
    <BsSetupChecklist
      data-setup-checklist
      :title="t('setupChecklist.title')"
      :progress-label="setupChecklist.progress"
      :description="t('setupChecklist.hint')"
      :steps="setupChecklist.steps"
      :loading="setupChecklist.pending"
      :error="setupChecklist.error ? t('setupChecklist.loadFailed') : null"
      :empty-label="t('setupChecklist.optional')"
      :retry-label="t('common.retry')"
      @retry="setupChecklist.refresh()"
    />
    <BsStack v-if="recentPending" gap="lg">
      <BsSectionSkeleton variant="cards" />
      <BsGrid :columns="3" gap="lg">
        <BsSectionSkeleton variant="chart" />
        <BsSectionSkeleton variant="table" :rows="4" />
      </BsGrid>
    </BsStack>
    <BsStateSurface
      v-else-if="recentError"
      state="error"
      :title="t('dashboard.recentLoadError')"
      :description="t('dashboard.loadErrorHint')"
      :action-label="t('common.retry')"
      @action="refreshRecent()"
    />
    <BsEmptyState
      v-else-if="!hasActivity"
      :title="t('dashboard.emptyTitle')"
      :description="t('dashboard.emptyHint')"
      :action-label="can('transactions.create') ? t('dashboard.emptyAction') : undefined"
      @action="start('expense')"
    />
    <template v-else>
      <BsSectionSkeleton v-if="summaryPending || commitmentsPending" variant="cards" />
      <BsStateSurface
        v-else-if="summaryError"
        state="error"
        :title="t('dashboard.summaryLoadError')"
        :description="t('dashboard.loadErrorHint')"
        :action-label="t('common.retry')"
        @action="refreshSummary()"
      />
      <BsStack v-else aria-labelledby="kpis" as="section" gap="md">
        <BsHeading id="kpis" :level="2" size="body">{{ t('dashboard.kpis') }}</BsHeading>
        <BsGrid :columns="4" gap="md">
          <BsKpiCard
            :title="t('dashboard.totalAssets')"
            :change-label="ledgerPresentation.kpi(summary?.total_assets_minor, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(summary?.total_assets_minor, null, 'neutral').tone"
          >
            <BsMoneyText :amount="summary?.total_assets_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.totalLiabilities')"
            :change-label="ledgerPresentation.kpi(summary?.total_liabilities_minor, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(summary?.total_liabilities_minor, null, 'neutral').tone"
          >
            <BsMoneyText :amount="summary?.total_liabilities_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.netWorth')"
            :hint="t('dashboard.netWorthHint')"
            :change-label="ledgerPresentation.kpi(summary?.net_worth_minor, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(summary?.net_worth_minor, null, 'neutral').tone"
          >
            <BsMoneyText :amount="summary?.net_worth_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.cashAndBank')"
            :change-label="ledgerPresentation.kpi(summary?.cash_and_bank_minor, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(summary?.cash_and_bank_minor, null, 'neutral').tone"
          >
            <BsMoneyText :amount="summary?.cash_and_bank_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.revenueThisMonth')"
            :change-label="ledgerPresentation.kpi(summary?.revenue_this_month_minor, summary?.revenue_previous_month_minor, 'up').label"
            :tone="ledgerPresentation.kpi(summary?.revenue_this_month_minor, summary?.revenue_previous_month_minor, 'up').tone"
          >
            <BsMoneyText :amount="summary?.revenue_this_month_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.expensesThisMonth')"
            :change-label="ledgerPresentation.kpi(summary?.expenses_this_month_minor, summary?.expenses_previous_month_minor, 'down').label"
            :tone="ledgerPresentation.kpi(summary?.expenses_this_month_minor, summary?.expenses_previous_month_minor, 'down').tone"
          >
            <BsMoneyText :amount="summary?.expenses_this_month_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.netProfitThisMonth')"
            :change-label="ledgerPresentation.kpi(summary?.net_profit_this_month_minor, summary?.net_profit_previous_month_minor, 'up').label"
            :tone="ledgerPresentation.kpi(summary?.net_profit_this_month_minor, summary?.net_profit_previous_month_minor, 'up').tone"
          >
            <BsMoneyText :amount="summary?.net_profit_this_month_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('dashboard.receivable')"
            :hint="payableHint"
            :change-label="ledgerPresentation.kpi(summary?.accounts_receivable_minor, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(summary?.accounts_receivable_minor, null, 'neutral').tone"
          >
            <BsMoneyText :amount="summary?.accounts_receivable_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            v-if="can('commitments.read') && !commitmentsError"
            :title="t('dashboard.upcomingCommitments')"
            :change-label="ledgerPresentation.kpi(upcomingCommitments, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(upcomingCommitments, null, 'neutral').tone"
          >
            <BsMoneyText :amount="upcomingCommitments" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            v-if="can('commitments.read') && !commitmentsError"
            :title="t('dashboard.overdueCommitments')"
            :change-label="ledgerPresentation.kpi(overdueCommitments, null, 'down').label"
            :tone="ledgerPresentation.kpi(overdueCommitments, null, 'down').tone"
          >
            <BsMoneyText :amount="overdueCommitments" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
        </BsGrid>
      </BsStack>
      <BsGrid :columns="3" gap="lg">
        <BsSectionSkeleton v-if="seriesPending" variant="chart" />
        <BsStateSurface
          v-else-if="seriesError"
          state="error"
          :title="t('dashboard.seriesLoadError')"
          :description="t('dashboard.loadErrorHint')"
          :action-label="t('common.retry')"
          @action="refreshSeries()"
        />
        <BsCard v-else aria-labelledby="chart-heading" as="section" padding="lg" :span="2">
          <BsInline gap="md" :wrap="true" justify="between">
            <BsHeading id="chart-heading" :level="2" size="body">{{ t('dashboard.revenueVsExpenses') }}</BsHeading>
            <BsInline role="group" :aria-label="t('dashboard.chartRange')" gap="xs" :wrap="false">
              <BsButton
                v-for="option in [3, 6, 12]"
                :key="option"
                variant="chip"
                type="button"
                :aria-pressed="months === option"
                @click="months = option; customRange = false"
              >{{ t('dashboard.months', { count: option }) }}</BsButton>
              <BsButton type="button" size="sm" :variant="(customRange ) ? 'primary' : 'default'" @click="customRange = !customRange">{{ t('dashboard.custom') }}</BsButton>
            </BsInline>
          </BsInline>
          <BsInline v-if="customRange" gap="sm" :wrap="true">
            <BsFloatingField :label="t('reports.from')">
              <BsInput v-model="customFrom" type="date" />
            </BsFloatingField>
            <BsFloatingField :label="t('reports.to')">
              <BsInput v-model="customTo" type="date" />
            </BsFloatingField>
          </BsInline>
          <BsMetricBarChart
            :points="ledgerPresentation.chartPoints(series ?? [])"
            :series="ledgerPresentation.chartSeries"
            :table-series="ledgerPresentation.chartTableSeries"
            :point-label="t('dashboard.month')"
            :label="ledgerPresentation.t('dashboard.revenueVsExpenses')"
            :table-label="ledgerPresentation.t('common.showAsTable')"
            :empty-label="ledgerPresentation.t('dashboard.noLiquidAccounts')"
          />
        </BsCard>
        <BsSectionSkeleton v-if="liquidPending" variant="table" :rows="4" />
        <BsCard v-else-if="liquidError" role="alert" aria-labelledby="liquid-error-heading" as="section" padding="lg">
          <BsStack gap="md">
            <BsHeading id="liquid-error-heading" :level="2" size="body">{{ t('dashboard.liquidLoadError') }}</BsHeading>
            <BsText size="sm" tone="muted">{{ t('dashboard.loadErrorHint') }}</BsText>
            <BsButton type="button" @click="refreshLiquid()">{{ t('common.retry') }}</BsButton>
          </BsStack>
        </BsCard>
        <BsCard v-else aria-labelledby="cash-heading" as="section" padding="lg">
          <BsHeading id="cash-heading" :level="2" size="body">{{ t('dashboard.cashPosition') }}</BsHeading>
          <BsDataTable
            v-if="liquid?.length"
            :value="liquid"
            :label="t('dashboard.cashPositionCaption')"
            :columns="[{ key: 'column1', header: '' }, { key: 'column2', header: '', align: 'end' as const }]"
          >
            <template #cell-column1="{ row: account }">{{ account.name }}</template>
            <template #cell-column2="{ row: account }">
              <BsMoneyText :amount="account.net_debit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
          </BsDataTable>
          <BsText v-else size="sm" tone="muted">{{ t('dashboard.noLiquidAccounts') }}</BsText>
        </BsCard>
      </BsGrid>
      <BsSectionSkeleton v-if="can('commitments.read') && commitmentsPending" variant="table" :rows="4" />
      <BsCard v-else-if="can('commitments.read') && commitmentsError" role="alert" aria-labelledby="commitments-error-heading" as="section" padding="lg">
        <BsStack gap="md">
          <BsHeading id="commitments-error-heading" :level="2" size="body">{{ t('dashboard.commitmentsLoadError') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('dashboard.loadErrorHint') }}</BsText>
          <BsButton type="button" @click="refreshCommitments()">{{ t('common.retry') }}</BsButton>
        </BsStack>
      </BsCard>
      <BsCard v-else-if="can('commitments.read')" aria-labelledby="commitments-heading" as="section" padding="none" overflow="hidden">
        <BsInline gap="none" :wrap="false" justify="between">
          <BsHeading id="commitments-heading" :level="2" size="body">{{ t('dashboard.commitments') }}</BsHeading>
          <BsButton type="submit" size="sm" @click="showOperations('commitments')">{{ t('dashboard.manage') }}</BsButton>
        </BsInline>
        <BsBox v-if="commitments.length">
          <BsDataTable :value="commitments" :columns="[{ key: 'column1', header: '' }, { key: 'column2', header: '' }, { key: 'column3', header: '' }, { key: 'column4', header: '', align: 'end' as const }]">
            <template #cell-column1="{ row: item }">{{ item.title }}</template>
            <template #cell-column2="{ row: item }">{{ formatDate(item.due_date, locale) }}</template>
            <template #cell-column3="{ row: item }">
              <BsStatusBadge :status="item.display_status ?? 'unknown'" />
            </template>
            <template #cell-column4="{ row: item }">
              <BsMoneyText
                :amount="item.outstanding_minor ?? 0"
                :currency="ledgerPresentation.currency(item.currency_code ?? undefined)"
                :locale="ledgerPresentation.locale"
              />
            </template>
          </BsDataTable>
        </BsBox>
        <BsText v-else size="sm" tone="muted">{{ t('dashboard.noCommitments') }}</BsText>
      </BsCard>
      <BsSectionSkeleton v-if="recentPending" variant="table" :rows="8" />
      <BsCard v-else aria-labelledby="recent-heading" as="section" padding="none" overflow="hidden">
        <BsInline gap="none" :wrap="false" justify="between">
          <BsHeading id="recent-heading" :level="2" size="body">{{ t('dashboard.recent') }}</BsHeading>
          <BsLink to="/transactions">{{ t('dashboard.viewAll') }}</BsLink>
        </BsInline>
        <BsBox>
          <BsDataTable
            :value="recent"
            row-key="id"
            :columns="[{ key: 'column1', header: (t('transactions.date')) }, { key: 'column2', header: (t('transactions.description')) }, { key: 'column3', header: (t('transactions.category')) }, { key: 'column4', header: (t('transactions.account')) }, { key: 'column5', header: (t('transactions.status')) }, { key: 'column6', header: (t('transactions.amount')), align: 'end' as const }]"
          >
            <template #header-column1>{{ t('transactions.date') }}</template>
            <template #cell-column1="{ row }">{{ formatDate(row.transaction_date, locale) }}</template>
            <template #header-column2>{{ t('transactions.description') }}</template>
            <template #cell-column2="{ row }">{{ row.description || t('common.dash') }}</template>
            <template #header-column3>{{ t('transactions.category') }}</template>
            <template #cell-column3="{ row }">{{ row.category_name || t('common.dash') }}</template>
            <template #header-column4>{{ t('transactions.account') }}</template>
            <template #cell-column4="{ row }">{{ row.from_account_name }} <BsIcon name="arrowRight" :size="14" directional /> {{ row.to_account_name }}</template>
            <template #header-column5>{{ t('transactions.status') }}</template>
            <template #cell-column5="{ row }">
              <BsStatusBadge :status="row.status" />
            </template>
            <template #header-column6>{{ t('transactions.amount') }}</template>
            <template #cell-column6="{ row }">
              <BsMoneyText :amount="row.amount_minor" :currency="ledgerPresentation.currency(row.currency_code)" :locale="ledgerPresentation.locale" />
            </template>
          </BsDataTable>
        </BsBox>
      </BsCard>
    </template>
  </BsStack>
</template>

undefined
undefined
