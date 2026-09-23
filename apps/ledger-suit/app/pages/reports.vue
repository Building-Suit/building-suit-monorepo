<script setup lang="ts">
import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: 'default' })

/**
 * One page, five tabs. Every figure is produced by a database function reading
 * posted ledger entries — drafts and scheduled transactions never appear here.
 */

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const { currentId, baseCurrency, can } = useTenant()
const { t, locale } = useI18n()

useHead({ title: () => `${t('reports.title')} · ${t('app.name')}` })

const TABS = [
  { key: 'overview', labelKey: 'reports.tabs.overview' },
  { key: 'profit-loss', labelKey: 'reports.tabs.profitLoss' },
  { key: 'balance-sheet', labelKey: 'reports.tabs.balanceSheet' },
  { key: 'cash-flow', labelKey: 'reports.tabs.cashFlow' },
  { key: 'ledger', labelKey: 'reports.tabs.ledger' },
] as const

type TabKey = (typeof TABS)[number]['key']

const tab = computed<TabKey>(() => {
  const requested = String(route.query.tab ?? 'overview')
  return (TABS.some(item => item.key === requested) ? requested : 'overview') as TabKey
})

function selectTab(key: TabKey) {
  router.replace({ query: { ...route.query, tab: key } })
}

// Default range: the year to date, which is what people check most often.
const now = new Date()
const today = now.toISOString().slice(0, 10)
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}
const from = ref(validDate(route.query.from) ? String(route.query.from) : `${now.getFullYear()}-01-01`)
const to = ref(validDate(route.query.to) ? String(route.query.to) : today)
const asOf = ref(validDate(route.query.asOf) ? String(route.query.asOf) : today)
const periodInvalid = computed(() => !validDate(from.value) || !validDate(to.value) || from.value > to.value)

watch([from, to, asOf], ([nextFrom, nextTo, nextAsOf]) => {
  if (!validDate(nextFrom) || !validDate(nextTo) || !validDate(nextAsOf)) return
  if (route.query.from === nextFrom && route.query.to === nextTo && route.query.asOf === nextAsOf) return
  void router.replace({ query: { ...route.query, from: nextFrom, to: nextTo, asOf: nextAsOf } })
})

const { data: accounts } = useOrgAccounts()
const ledgerAccountId = ref<string>('')

watchEffect(() => {
  if (!ledgerAccountId.value && accounts.value?.length) {
    ledgerAccountId.value = accounts.value.find(a => a.system_key === 'bank')?.id
      ?? accounts.value[0]!.id
  }
})

interface ReportRow {
  section: string
  account_id: string | null
  code: string | null
  name: string
  amount_minor: number
}

const { data: profitLoss, pending: profitLossPending } = useLazyAsyncData<ReportRow[]>('org:report-pl', async () => {
  if (!currentId.value || periodInvalid.value) return []
  const { data, error } = await supabase.rpc('report_profit_and_loss', {
    p_organization_id: currentId.value,
    p_from_date: from.value,
    p_to_date: to.value,
  })
  if (error) throw error
  return (data ?? []) as ReportRow[]
}, { watch: [currentId, from, to], default: () => [] })

interface ClassifiedRow {
  section: string
  account_id: string | null
  code: string | null
  name: string
  amount_minor: string
  statement_line: string
  classification_id: string | null
  effective_from: string | null
  report_date: string
}
const reportScope = computed(() => scopedQueryKey({
  environment: String(config.public.supabase.url), portal: 'ledger-suit',
  userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, 'classified-balance-sheet', { asOf: asOf.value }))
const balanceKey = computed(() => `org:${reportScope.value}`)
const { data: balanceResult, pending: balanceSheetPending, error: balanceSheetError, refresh: refreshBalanceSheet } = useLazyAsyncData(balanceKey, async (_app, { signal }) => {
  const scope = reportScope.value
  const organizationId = currentId.value
  if (!organizationId || !/^\d{4}-\d{2}-\d{2}$/.test(asOf.value)) return { scope, rows: [] as ClassifiedRow[] }
  const { data, error } = await supabase.rpc('report_classified_balance_sheet', {
    p_organization_id: organizationId, p_as_of_date: asOf.value,
  }).abortSignal(signal)
  if (error) throw error
  return { scope, rows: (data ?? []) as ClassifiedRow[] }
})
const balanceSheet = computed(() => balanceResult.value?.scope === reportScope.value ? (balanceResult.value?.rows ?? []) : [])

const { data: integrity } = useLazyAsyncData('org:report-integrity', async () => {
  if (!currentId.value) return null
  const { data, error } = await supabase.rpc('check_balance_sheet_integrity', {
    p_organization_id: currentId.value,
    p_as_of_date: asOf.value,
  })
  if (error) throw error
  return data as unknown as Record<string, number | boolean | string>
}, { watch: [currentId, asOf] })

const { data: cashFlow, pending: cashFlowPending } = useLazyAsyncData('org:report-cf', async () => {
  if (!currentId.value || periodInvalid.value) return []
  const { data, error } = await supabase.rpc('report_cash_flow', {
    p_organization_id: currentId.value,
    p_from_date: from.value,
    p_to_date: to.value,
  })
  if (error) throw error
  return data ?? []
}, { watch: [currentId, from, to], default: () => [] })

const { data: ledger, pending: ledgerPending } = useLazyAsyncData('org:report-ledger', async () => {
  if (!currentId.value || !ledgerAccountId.value || periodInvalid.value) return []
  const { data, error } = await supabase.rpc('report_general_ledger', {
    p_organization_id: currentId.value,
    p_account_id: ledgerAccountId.value,
    p_from_date: from.value,
    p_to_date: to.value,
  })
  if (error) throw error
  return data ?? []
}, { watch: [currentId, ledgerAccountId, from, to], default: () => [] })

interface TrialBalanceRow {
  account_id: string
  code: string | null
  name: string
  type: Database['public']['Enums']['account_type']
  parent_account_id: string | null
  account_role: string
  normal_balance: Database['public']['Enums']['normal_balance']
  contra_account_id: string | null
  opening_debit_minor: string
  opening_credit_minor: string
  period_debit_minor: string
  period_credit_minor: string
  closing_debit_minor: string
  closing_credit_minor: string
}
const trialScope = computed(() => scopedQueryKey({
  environment: String(config.public.supabase.url), portal: 'ledger-suit',
  userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, 'trial-balance', { from: from.value, to: to.value }))
const trialKey = computed(() => `org:${trialScope.value}`)
const { data: trialResult, pending: trialBalancePending, error: trialBalanceError, refresh: refreshTrialBalance } = useLazyAsyncData(trialKey, async (_app, { signal }) => {
  const scope = trialScope.value
  if (!currentId.value || periodInvalid.value) return { scope, rows: [] as TrialBalanceRow[] }
  const { data, error } = await supabase.rpc('report_trial_balance', {
    p_organization_id: currentId.value,
    p_from_date: from.value,
    p_to_date: to.value,
  }).abortSignal(signal)
  if (error) throw error
  return { scope, rows: (data ?? []) as TrialBalanceRow[] }
})
const trialBalance = computed(() => trialResult.value?.scope === trialScope.value ? (trialResult.value?.rows ?? []) : [])

function sectionTotal(rows: ReportRow[] | null, section: string) {
  return (rows ?? [])
    .filter(r => r.section === section)
    .reduce((sum, r) => sum + Number(r.amount_minor), 0)
}

const revenue = computed(() => sectionTotal(profitLoss.value, 'revenue'))
const costOfSales = computed(() => sectionTotal(profitLoss.value, 'cost_of_sales'))
const operatingExpenses = computed(() => sectionTotal(profitLoss.value, 'operating_expenses'))
const netProfit = computed(() => revenue.value - costOfSales.value - operatingExpenses.value)

const assets = computed(() => sumStatementAmounts(balanceSheet.value, 'asset'))
const liabilities = computed(() => sumStatementAmounts(balanceSheet.value, 'liability'))
const equity = computed(() => sumStatementAmounts(balanceSheet.value, 'equity'))

type TrialAmount = 'opening_debit_minor' | 'opening_credit_minor' | 'period_debit_minor' | 'period_credit_minor' | 'closing_debit_minor' | 'closing_credit_minor'
const trialColumns: ReadonlyArray<{ label: string, field: TrialAmount, scope: 'opening' | 'period' | 'closing' }> = [
  { label: 'openingDebit', field: 'opening_debit_minor', scope: 'opening' },
  { label: 'openingCredit', field: 'opening_credit_minor', scope: 'opening' },
  { label: 'periodDebit', field: 'period_debit_minor', scope: 'period' },
  { label: 'periodCredit', field: 'period_credit_minor', scope: 'period' },
  { label: 'closingDebit', field: 'closing_debit_minor', scope: 'closing' },
  { label: 'closingCredit', field: 'closing_credit_minor', scope: 'closing' },
]
const sumTrial = (field: TrialAmount) => trialBalance.value.reduce((sum, row) => sum + BigInt(row[field]), 0n).toString()
const trialTotals = computed(() => ({
  openingDebit: sumTrial('opening_debit_minor'), openingCredit: sumTrial('opening_credit_minor'),
  periodDebit: sumTrial('period_debit_minor'), periodCredit: sumTrial('period_credit_minor'),
  closingDebit: sumTrial('closing_debit_minor'), closingCredit: sumTrial('closing_credit_minor'),
}))
const trialBalanced = computed(() => trialTotals.value.openingDebit === trialTotals.value.openingCredit
  && trialTotals.value.periodDebit === trialTotals.value.periodCredit
  && trialTotals.value.closingDebit === trialTotals.value.closingCredit)
const trialTotalCells = computed(() => [
  { key: 'openingDebit', amount: trialTotals.value.openingDebit },
  { key: 'openingCredit', amount: trialTotals.value.openingCredit },
  { key: 'periodDebit', amount: trialTotals.value.periodDebit },
  { key: 'periodCredit', amount: trialTotals.value.periodCredit },
  { key: 'closingDebit', amount: trialTotals.value.closingDebit },
  { key: 'closingCredit', amount: trialTotals.value.closingCredit },
])

const trialDrilldown = ref<{ accountId: string, from: string, to: string } | null>(null)
function dayBefore(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
function openTrialDrilldown(row: TrialBalanceRow, scope: 'opening' | 'period' | 'closing') {
  trialDrilldown.value = {
    accountId: row.account_id,
    from: scope === 'period' ? from.value : '0001-01-01',
    to: scope === 'opening' ? dayBefore(from.value) : to.value,
  }
}

const plSections = [
  { key: 'revenue', labelKey: 'reports.revenue' },
  { key: 'cost_of_sales', labelKey: 'reports.costOfSales' },
  { key: 'operating_expenses', labelKey: 'reports.operatingExpenses' },
]

const bsRows = computed(() => STATEMENT_LINES.flatMap(line => balanceSheet.value
  .filter(row => row.statement_line === line)
  .map(row => ({ ...row, displayName: row.account_id ? row.name : t('statementClassification.lines.unclosed_profit') }))))

function rowsIn(rows: ReportRow[] | null, section: string) {
  return (rows ?? []).filter(r => r.section === section)
}

const exportPending = ref(false)
const exportError = ref('')
watch([reportScope, trialScope], () => { exportError.value = '' })

async function exportReport(report: 'profit_loss' | 'balance_sheet' | 'trial_balance' | 'cash_flow' | 'general_ledger') {
  if (!currentId.value || exportPending.value) return
  const requestedScope = JSON.stringify({ organization: currentId.value, report, from: from.value, to: to.value, asOf: asOf.value, account: ledgerAccountId.value })
  const exportLocale = locale.value
  const exportPeriod = ['profit_loss', 'trial_balance', 'cash_flow', 'general_ledger'].includes(report) ? `${from.value}_${to.value}` : asOf.value
  exportPending.value = true
  exportError.value = ''
  try {
    const { data, error } = report === 'balance_sheet'
      ? await supabase.rpc('export_classified_balance_sheet_csv', { p_organization_id: currentId.value, p_as_of_date: asOf.value, p_locale: locale.value })
      : await supabase.rpc('export_financial_report_csv', {
      p_organization_id: currentId.value,
      p_report: report,
      p_from_date: ['profit_loss', 'trial_balance', 'cash_flow', 'general_ledger'].includes(report) ? from.value : undefined,
      p_to_date: ['profit_loss', 'trial_balance', 'cash_flow', 'general_ledger'].includes(report) ? to.value : undefined,
      p_as_of_date: undefined,
      p_account_id: report === 'general_ledger' ? ledgerAccountId.value : undefined,
    })
    if (error) throw error
    const currentScope = JSON.stringify({ organization: currentId.value, report, from: from.value, to: to.value, asOf: asOf.value, account: ledgerAccountId.value })
    if (currentScope !== requestedScope || locale.value !== exportLocale) return
    downloadCsv(`${t(`csv.filenames.${report}`)}-${exportPeriod}.csv`, localizeReportCsv(data, report, t))
  }
  catch {
    const currentScope = JSON.stringify({ organization: currentId.value, report, from: from.value, to: to.value, asOf: asOf.value, account: ledgerAccountId.value })
    if (currentScope === requestedScope) exportError.value = t('reports.exportFailed')
  }
  finally {
    exportPending.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-6">
    <div>
      <h1 class="text-h1 font-bold">{{ t('reports.title') }}</h1>
      <p class="mt-1 text-sm text-fg-muted">{{ t('reports.csvExports') }}</p>
    </div>

    <p v-if="exportError" class="ls-error" role="alert">{{ exportError }}</p>

    <div class="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--bs-border)]" role="tablist">
      <button
        v-for="item in TABS"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="tab === item.key"
        class="ls-tab -mb-px"
        :class="{ 'ls-tab-active': tab === item.key }"
        @click="selectTab(item.key)"
      >
        {{ t(item.labelKey) }}
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <template v-if="tab !== 'balance-sheet'">
        <FloatingField :label="t('reports.from')"><input id="from" v-model="from" type="date" class="ls-input"></FloatingField>
        <FloatingField :label="t('reports.to')"><input id="to" v-model="to" type="date" :min="from" class="ls-input"></FloatingField>
      </template>
      <FloatingField v-else :label="t('reports.asOf')"><input id="asof" v-model="asOf" type="date" class="ls-input"></FloatingField>

      <FloatingField v-if="tab === 'ledger'" class="min-w-56" :label="t('reports.account')">
        <select id="ledger-account" v-model="ledgerAccountId" class="ls-input">
          <option v-for="a in accounts" :key="a.id" :value="a.id">
            {{ a.code ? `${a.code} · ` : '' }}{{ a.name }}
          </option>
        </select>
      </FloatingField>
    </div>

    <!-- Overview -->
    <section v-if="tab === 'overview'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.overview')">
      <div
        v-if="integrity && integrity.balanced === false"
        class="rounded-control border border-[var(--bs-status-error)] bg-[var(--bs-status-error-bg)] px-4 py-3 text-sm text-[var(--bs-status-error)]"
        role="alert"
      >
        <p class="font-bold">{{ t('reports.integrityTitle') }}</p>
        <p class="mt-1">
          {{ t('reports.integrityBody', {
            difference: formatMoney(Number(integrity.difference_minor), baseCurrency, locale),
          }) }}
        </p>
      </div>

      <SectionSkeleton v-if="balanceSheetPending || profitLossPending" variant="cards" />
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard :title="t('reports.assets')" :amount-minor="assets" good-direction="neutral" />
        <KpiCard :title="t('reports.liabilities')" :amount-minor="liabilities" good-direction="neutral" />
        <KpiCard :title="t('reports.equity')" :amount-minor="equity" good-direction="neutral" />
        <KpiCard :title="t('reports.netProfitPeriod')" :amount-minor="netProfit" good-direction="neutral" />
      </div>

      <p v-if="periodInvalid" role="alert" class="ls-error">{{ t('reports.invalidPeriod') }}</p>
      <div v-else-if="trialBalanceError" role="alert" class="ls-card space-y-3 p-6"><p>{{ t('reports.trialBalanceError') }}</p><button type="button" class="ls-btn" @click="refreshTrialBalance()">{{ t('accounts.retry') }}</button></div>
      <SectionSkeleton v-else-if="trialBalancePending" variant="table" :rows="7" />
      <EmptyState v-else-if="!trialBalance.length" :title="t('reports.emptyTitle')" :description="t('reports.emptyRange')" />
      <section v-else class="ls-card overflow-hidden" aria-labelledby="tb-heading">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h2 id="tb-heading" class="text-base font-bold">{{ t('reports.trialBalance') }}</h2>
          <div class="flex items-center gap-3">
            <p class="text-sm font-semibold" :class="trialBalanced ? 'text-[var(--bs-status-success)]' : 'text-[var(--bs-status-error)]'">
              {{ trialBalanced ? t('reports.inBalance') : t('reports.outOfBalance') }}
            </p>
            <button v-if="can('reports.export')" type="button" class="ls-btn ls-btn-sm" :disabled="exportPending" @click="exportReport('trial_balance')">{{ t('common.exportCsv') }}</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <BsDataTable :value="trialBalance" data-key="account_id" :label="t('reports.trialBalance')">
  <Column :header="t('accounts.code')" body-class="font-mono text-xs text-fg-muted"><template #body="{ data: row }"><span dir="ltr">{{ row.code || t('common.dash') }}</span></template></Column>
  <Column field="name" :header="t('reports.account')" />
  <Column v-for="column in trialColumns" :key="column.field" :header="t(`reports.${column.label}`)" header-class="min-w-36 whitespace-nowrap text-end" body-class="ls-num whitespace-nowrap">
    <template #body="{ data: row }"><button type="button" class="rounded-control px-1 text-link hover:underline focus-visible:outline focus-visible:outline-2" :aria-label="t('reports.drilldownAmount', { column: t(`reports.${column.label}`), account: row.name })" @click="openTrialDrilldown(row, column.scope)"><MoneyText :amount-minor="row[column.field]" /></button></template>
  </Column>
  <ColumnGroup type="footer"><Row><Column :footer="t('reports.total')" :colspan="2" /><Column v-for="total in trialTotalCells" :key="total.key" footer-class="ls-num whitespace-nowrap"><template #footer><MoneyText :amount-minor="total.amount" /></template></Column></Row></ColumnGroup>
</BsDataTable>
        </div>
      </section>
    </section>

    <!-- Profit & Loss -->
    <section v-else-if="tab === 'profit-loss'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.profitLoss')">
      <div class="flex justify-end">
        <button v-if="can('reports.export')" type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('profit_loss')">{{ t('common.exportCsv') }}</button>
      </div>

      <SectionSkeleton v-if="profitLossPending" variant="table" :rows="7" />

      <EmptyState
        v-else-if="!profitLoss?.length"
        :title="t('reports.emptyTitle')"
        :description="t('reports.emptyRange')"
      />

      <div v-else class="ls-card overflow-hidden">
        <BsDataTable :label="t('reports.tabs.profitLoss')" :value="plSections.flatMap(section => rowsIn(profitLoss, section.key).map(row => ({ ...row, groupKey: section.key, groupLabel: section.labelKey })))" row-group-mode="subheader" group-rows-by="groupKey">
  <Column field="name" :header="t('reports.account')" body-class="ps-8" />
  <Column :header="t('transactions.amount')" body-class="ls-num"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" /></template></Column>
  <template #groupheader="{ data: row }"><div class="flex justify-between gap-4 bg-surface-muted font-bold"><span>{{ t(row.groupLabel) }}</span><MoneyText :amount-minor="sectionTotal(profitLoss, row.groupKey)" /></div></template>
  <template #footer><div class="flex justify-between gap-4 text-base font-bold"><span>{{ t('reports.netProfit') }}</span><MoneyText :amount-minor="netProfit" signed /></div></template>
</BsDataTable>
      </div>
    </section>

    <!-- Balance sheet -->
    <section v-else-if="tab === 'balance-sheet'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.balanceSheet')">
      <div class="flex justify-end">
        <button v-if="can('reports.export')" type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('balance_sheet')">{{ t('common.exportCsv') }}</button>
      </div>

      <p class="text-sm text-fg-muted">{{ t('statementClassification.reportHint', { date: formatDate(asOf, locale) }) }}</p>
      <div v-if="balanceSheetError" class="ls-error" role="alert">{{ t('statementClassification.reportError') }} <button type="button" class="ls-btn" @click="refreshBalanceSheet()">{{ t('statementClassification.reload') }}</button></div>
      <SectionSkeleton v-else-if="balanceSheetPending" variant="table" :rows="7" />

      <EmptyState
        v-else-if="!balanceSheet?.length"
        :title="t('reports.emptyTitle')"
        :description="t('reports.emptyAsOf')"
      />

      <template v-else>
        <div class="ls-card overflow-hidden">
          <BsDataTable :label="t('reports.tabs.balanceSheet')" :value="bsRows" row-group-mode="subheader" group-rows-by="statement_line">
  <Column field="displayName" :header="t('reports.account')" body-class="ps-8" />
  <Column :header="t('statementClassification.effectiveFrom')"><template #body="{ data: row }">{{ row.effective_from ? formatDate(row.effective_from, locale) : t('common.dash') }}</template></Column>
  <Column :header="t('transactions.amount')" body-class="ls-num"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" /></template></Column>
  <template #groupheader="{ data: row }"><div class="flex justify-between gap-4 bg-surface-muted font-bold"><span>{{ t(`statementClassification.lines.${row.statement_line}`) }}</span><MoneyText :amount-minor="sumStatementAmounts(balanceSheet, row.statement_line, 'statement_line')" /></div></template>
</BsDataTable>
        </div>

        <p class="text-sm" :class="BigInt(assets) === BigInt(liabilities) + BigInt(equity) ? 'text-fg-muted' : 'text-[var(--bs-status-error)]'">
          {{ t('reports.equation', {
            assets: formatMoney(assets, baseCurrency, locale),
            liabilities: formatMoney(liabilities, baseCurrency, locale),
            equity: formatMoney(equity, baseCurrency, locale),
          }) }}
        </p>
      </template>
    </section>

    <!-- Cash flow -->
    <section v-else-if="tab === 'cash-flow'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.cashFlow')">
      <div class="flex justify-end">
        <button v-if="can('reports.export')" type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('cash_flow')">{{ t('common.exportCsv') }}</button>
      </div>
      <SectionSkeleton v-if="cashFlowPending" variant="table" :rows="5" />

      <EmptyState
        v-else-if="!cashFlow?.length"
        :title="t('reports.emptyCashTitle')"
        :description="t('reports.emptyCashHint')"
      />

      <div v-else class="ls-card overflow-hidden">
        <BsDataTable :value="cashFlow" data-key="section" :label="t('reports.tabs.cashFlow')">
  <Column :header="t('reports.activity')"><template #body="{ data: row }">{{ t(`reports.cashFlowSections.${row.section}`) }}</template></Column>
  <Column :header="t('reports.netMovement')" header-class="text-end" body-class="ls-num"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" signed explicit-sign /></template></Column>
  <template #footer><div class="flex justify-between gap-4 font-bold"><span>{{ t('reports.netChangeInCash') }}</span><MoneyText :amount-minor="cashFlow.reduce((s, r) => s + Number(r.amount_minor), 0)" signed explicit-sign /></div></template>
</BsDataTable>
      </div>
    </section>

    <!-- General ledger -->
    <section v-else class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.ledger')">
      <div class="flex justify-end">
        <button v-if="can('reports.export')" type="button" class="ls-btn" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger')">{{ t('common.exportCsv') }}</button>
      </div>
      <SectionSkeleton v-if="ledgerPending" variant="table" :rows="8" />

      <EmptyState
        v-else-if="!ledger?.length"
        :title="t('reports.emptyLedgerTitle')"
        :description="t('reports.emptyLedgerHint')"
      />

      <div v-else class="ls-card overflow-x-auto">
        <BsDataTable :value="ledger" data-key="entry_id" :label="t('reports.tabs.ledger')">
  <Column body-class="whitespace-nowrap">
    <template #header>{{ t('transactions.date') }}</template>
    <template #body="{ data: row }">{{ formatDate(row.entry_date, locale) }}</template>
  </Column>
  <Column body-class="text-fg-muted">
    <template #header>{{ t('transactions.reference') }}</template>
    <template #body="{ data: row }">{{ row.reference || t('common.dash') }}</template>
  </Column>
  <Column body-class="max-w-64 truncate">
    <template #header>{{ t('transactions.description') }}</template>
    <template #body="{ data: row }">{{ row.description || row.memo || t('common.dash') }}</template>
  </Column>
  <Column header-class="text-end" body-class="ls-num">
    <template #header>{{ t('detail.debit') }}</template>
    <template #body="{ data: row }"><MoneyText v-if="Number(row.debit_minor)" :amount-minor="row.debit_minor" />
                <span v-else class="text-fg-disabled">{{ t('common.dash') }}</span></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num">
    <template #header>{{ t('detail.credit') }}</template>
    <template #body="{ data: row }"><MoneyText v-if="Number(row.credit_minor)" :amount-minor="row.credit_minor" />
                <span v-else class="text-neutral-300">—</span></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num font-semibold">
    <template #header>{{ t('reports.runningBalance') }}</template>
    <template #body="{ data: row }"><MoneyText :amount-minor="row.running_balance_minor" /></template>
  </Column>
</BsDataTable>
      </div>
    </section>
    <AccountActivityDialog v-if="trialDrilldown" :account-id="trialDrilldown.accountId" :scope="trialScope" :initial-from="trialDrilldown.from" :initial-to="trialDrilldown.to" @close="trialDrilldown = null" />
  </div>
</template>
