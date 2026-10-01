<script setup lang="ts">
import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'
import type { AccountsReportsRpcDatabase } from '~~/types/accounts-reports-rpc.types'
import type { ReportFormatMetadata } from '../utils/reportFormats'

definePageMeta({ layout: 'default' })

/**
 * One page, five tabs. Every figure is produced by a database function reading
 * posted ledger entries — drafts and scheduled transactions never appear here.
 */

const supabase = useSupabaseClient<Database>()
const performanceRpc = useSupabaseClient<AccountsReportsRpcDatabase>()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const { currentId, current, baseCurrency, can } = useTenant()
const { t, locale } = useI18n()
const { density: tableDensity, hydrated: tablePreferenceHydrated } = useAccountingTablePreferences('financial-reports')

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
function scopedReportKey(feature: string, parameters: Record<string, string>) {
  return `org:${scopedQueryKey({
    environment: String(config.public.supabase.url), portal: 'ledger-suit',
    userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
  }, feature, parameters)}`
}

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

const profitLossKey = computed(() => scopedReportKey('profit-loss', { from: from.value, to: to.value }))
const { data: profitLossDetail, pending: profitLossDetailPending, error: profitLossError, refresh: refreshProfitLoss } = useLazyAsyncData<ReportRow[]>(profitLossKey, async () => {
  if (tab.value !== 'profit-loss' || !currentId.value || periodInvalid.value) return []
  const { data, error } = await supabase.rpc('report_profit_and_loss', {
    p_organization_id: currentId.value,
    p_from_date: from.value,
    p_to_date: to.value,
  })
  if (error) throw error
  return (data ?? []) as ReportRow[]
}, { watch: [currentId, from, to, tab], default: () => [] })

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
const { data: balanceResult, pending: balanceSheetDetailPending, error: balanceSheetError, refresh: refreshBalanceSheet } = useLazyAsyncData(balanceKey, async (_app, { signal }) => {
  const scope = reportScope.value
  const organizationId = currentId.value
  if (tab.value !== 'balance-sheet' || !organizationId || !/^\d{4}-\d{2}-\d{2}$/.test(asOf.value)) return { scope, rows: [] as ClassifiedRow[] }
  const { data, error } = await supabase.rpc('report_classified_balance_sheet', {
    p_organization_id: organizationId, p_as_of_date: asOf.value,
  }).abortSignal(signal)
  if (error) throw error
  return { scope, rows: (data ?? []) as ClassifiedRow[] }
}, { watch: [tab] })
const balanceSheetDetail = computed(() => balanceResult.value?.scope === reportScope.value ? (balanceResult.value?.rows ?? []) : [])

interface StatementReconciliation { profit_loss_difference_minor: number, balance_sheet_difference_minor: number, mapping_complete: boolean, accounts: Array<{ statement: string, account_id: string, statement_minor: number, ledger_minor: number, difference_minor: number }> }

interface CashAdjustment { account_id: string, code: string | null, name: string, line: string, amount_minor: number }
interface IndirectCashFlow {
  net_profit_minor: number
  operating_adjustments: CashAdjustment[]
  operating_adjustments_minor: number
  operating_cash_minor: number
  investing_cash_minor: number
  financing_cash_minor: number
  unclassified_cash_minor: number
  unclassified_entry_count: number
  net_cash_change_minor: number
  opening_cash_minor: number
  closing_cash_minor: number
  operating_adjustment_difference_minor: number
  classification_difference_minor: number
  classification_complete: boolean
  reconciled: boolean
}
interface CashDetail { transaction_id: string, entry_id: string, account_id: string, section: string, amount_minor: number, classification_source: string }
const cashFlowKey = computed(() => scopedReportKey('cash-flow', { from: from.value, to: to.value }))
const { data: cashFlow, pending: cashFlowPending, error: cashFlowError, refresh: refreshCashFlow } = useLazyAsyncData(cashFlowKey, async () => {
  if (tab.value !== 'cash-flow' || !currentId.value || periodInvalid.value) return null
  const { data, error } = await supabase.rpc('report_indirect_cash_flow', {
    p_organization_id: currentId.value, p_from_date: from.value, p_to_date: to.value,
  })
  if (error) throw error
  return data as unknown as IndirectCashFlow
}, { watch: [currentId, from, to, tab] })
const cashDetailKey = computed(() => scopedReportKey('cash-flow-detail', { from: from.value, to: to.value }))
const { data: cashDetail, error: cashDetailError, refresh: refreshCashDetail } = useLazyAsyncData(cashDetailKey, async () => {
  if (tab.value !== 'cash-flow' || !currentId.value || periodInvalid.value) return [] as CashDetail[]
  const { data, error } = await supabase.rpc('report_cash_flow_detail', {
    p_organization_id: currentId.value, p_from_date: from.value, p_to_date: to.value,
  })
  if (error) throw error
  return (data ?? []) as CashDetail[]
}, { watch: [currentId, from, to, tab], default: () => [] })
function refreshCashFlowSurface() {
  void refreshCashFlow()
  void refreshCashDetail()
}

const ledgerKey = computed(() => scopedReportKey('general-ledger', { account: ledgerAccountId.value, from: from.value, to: to.value }))
const { data: ledger, pending: ledgerPending, error: ledgerError, refresh: refreshLedger } = useLazyAsyncData(ledgerKey, async () => {
  if (tab.value !== 'ledger' || !currentId.value || !ledgerAccountId.value || periodInvalid.value) return []
  const { data, error } = await supabase.rpc('report_general_ledger', {
    p_organization_id: currentId.value,
    p_account_id: ledgerAccountId.value,
    p_from_date: from.value,
    p_to_date: to.value,
  })
  if (error) throw error
  return data ?? []
}, { watch: [currentId, ledgerAccountId, from, to, tab], default: () => [] })

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
interface FinancialOverview {
  profit_loss: ReportRow[]
  balance_sheet: ClassifiedRow[]
  trial_balance: TrialBalanceRow[]
  integrity: Record<string, number | boolean | string>
  reconciliation: StatementReconciliation
}
const overviewScope = computed(() => scopedQueryKey({
  environment: String(config.public.supabase.url), portal: 'ledger-suit',
  userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, 'financial-overview', { from: from.value, to: to.value, asOf: asOf.value }))
const overviewKey = computed(() => `org:${overviewScope.value}`)
const { data: overviewResult, pending: overviewPending, error: overviewError, refresh: refreshOverview } = useLazyAsyncData(overviewKey, async (_app, { signal }) => {
  const scope = overviewScope.value
  const organizationId = currentId.value
  if (tab.value !== 'overview' || !organizationId || periodInvalid.value || !validDate(asOf.value)) {
    return { scope, payload: null as FinancialOverview | null }
  }
  const { data, error } = await performanceRpc.rpc('report_financial_overview', {
    p_organization_id: organizationId,
    p_from_date: from.value,
    p_to_date: to.value,
    p_as_of_date: asOf.value,
  }).abortSignal(signal)
  if (error) throw error
  return { scope, payload: data as unknown as FinancialOverview }
}, { watch: [tab] })
const overview = computed(() => overviewResult.value?.scope === overviewScope.value ? (overviewResult.value?.payload ?? null) : null)
const profitLoss = computed(() => tab.value === 'overview' ? (overview.value?.profit_loss ?? []) : (profitLossDetail.value ?? []))
const profitLossPending = computed(() => tab.value === 'overview' ? overviewPending.value : profitLossDetailPending.value)
const balanceSheet = computed(() => tab.value === 'overview' ? (overview.value?.balance_sheet ?? []) : balanceSheetDetail.value)
const balanceSheetPending = computed(() => tab.value === 'overview' ? overviewPending.value : balanceSheetDetailPending.value)
const trialBalance = computed(() => overview.value?.trial_balance ?? [])
const trialBalancePending = computed(() => overviewPending.value)
const trialBalanceError = computed(() => overviewError.value)
const statementReconciliation = computed(() => overview.value?.reconciliation ?? null)
const integrity = computed(() => overview.value?.integrity ?? null)
function refreshTrialBalance() { return refreshOverview() }

function sectionTotal(rows: ReportRow[] | null, section: string) {
  return (rows ?? []).filter(r => r.section === section)
    .reduce((sum, r) => sum + BigInt(r.amount_minor), 0n).toString()
}
const revenue = computed(() => (BigInt(sectionTotal(profitLoss.value, 'operating_revenue')) + BigInt(sectionTotal(profitLoss.value, 'other_income')) + BigInt(sectionTotal(profitLoss.value, 'unclassified_revenue'))).toString())
const costOfSales = computed(() => sectionTotal(profitLoss.value, 'cost_of_sales'))
const operatingExpenses = computed(() => sectionTotal(profitLoss.value, 'operating_expenses'))
const grossProfit = computed(() => (BigInt(sectionTotal(profitLoss.value, 'operating_revenue')) - BigInt(costOfSales.value)).toString())
const operatingResult = computed(() => (BigInt(grossProfit.value) - BigInt(operatingExpenses.value)).toString())
const netProfit = computed(() => (BigInt(revenue.value) - BigInt(costOfSales.value) - BigInt(operatingExpenses.value)
  - BigInt(sectionTotal(profitLoss.value, 'other_expenses')) - BigInt(sectionTotal(profitLoss.value, 'unclassified_expense'))).toString())
const plMappingIncomplete = computed(() => (profitLoss.value ?? []).some(row => row.section.startsWith('unclassified_')))
const bsMappingIncomplete = computed(() => balanceSheet.value.some(row => row.statement_line.startsWith('unclassified_')))

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

const allocationEntry = ref<CashDetail | null>(null)
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
  { key: 'operating_revenue', labelKey: 'financialMapping.lines.operating_revenue' },
  { key: 'cost_of_sales', labelKey: 'financialMapping.lines.cost_of_sales' },
  { key: 'operating_expenses', labelKey: 'financialMapping.lines.operating_expenses' },
  { key: 'other_income', labelKey: 'financialMapping.lines.other_income' },
  { key: 'other_expenses', labelKey: 'financialMapping.lines.other_expenses' },
  { key: 'unclassified_revenue', labelKey: 'financialMapping.lines.unclassified_revenue' },
  { key: 'unclassified_expense', labelKey: 'financialMapping.lines.unclassified_expense' },
]
function openStatementDrilldown(accountId: string | null, period: 'range' | 'asof' = 'range') {
  if (!accountId) return
  trialDrilldown.value = { accountId, from: period === 'asof' ? '0001-01-01' : from.value,
    to: period === 'asof' ? asOf.value : to.value }
}
function accountName(accountId: string) {
  const account = accounts.value?.find(item => item.id === accountId)
  return account ? `${account.code ?? ''} · ${account.name}` : accountId
}

const bsRows = computed(() => STATEMENT_LINES.flatMap(line => balanceSheet.value
  .filter(row => row.statement_line === line)
  .map(row => ({ ...row, displayName: row.account_id ? row.name : t('statementClassification.lines.unclosed_profit') }))))

function rowsIn(rows: ReportRow[] | null, section: string) {
  return (rows ?? []).filter(r => r.section === section)
}

const exportPending = ref(false)
const exportError = ref('')
watch([reportScope, trialScope], () => { exportError.value = '' })

type ExportReport = 'profit_loss' | 'balance_sheet' | 'trial_balance' | 'cash_flow' | 'general_ledger'
type ExportFormat = 'csv' | 'excel' | 'print'

function exportScope(report: ExportReport) {
  return JSON.stringify({ organization: currentId.value, report, from: from.value, to: to.value, asOf: asOf.value, account: ledgerAccountId.value })
}

function exportTitle(report: ExportReport) {
  if (report === 'trial_balance') return t('reports.trialBalance')
  if (report === 'general_ledger') return t('reports.tabs.ledger')
  const key = { profit_loss: 'profitLoss', balance_sheet: 'balanceSheet', cash_flow: 'cashFlow' }[report]
  return t(`reports.tabs.${key}`)
}

function exportWarning(report: ExportReport) {
  if (report === 'profit_loss' && plMappingIncomplete.value) return t('financialMapping.incomplete')
  if (report === 'balance_sheet' && bsMappingIncomplete.value) return t('financialMapping.incomplete')
  if (report === 'cash_flow' && cashFlow.value && (!cashFlow.value.classification_complete || !cashFlow.value.reconciled)) return t('financialMapping.cashIncomplete')
  return undefined
}

function exportMetadata(report: ExportReport, exportLocale: string): ReportFormatMetadata {
  const isBalanceSheet = report === 'balance_sheet'
  const filters = [{
    label: isBalanceSheet ? t('reports.asOf') : t('reports.period'),
    value: isBalanceSheet ? formatDate(asOf.value, exportLocale) : `${formatDate(from.value, exportLocale)} – ${formatDate(to.value, exportLocale)}`,
  }]
  if (report === 'general_ledger') filters.push({ label: t('reports.account'), value: accountName(ledgerAccountId.value) })
  filters.push({ label: t('reports.entriesFilter'), value: t('reports.postedOnly') })
  return {
    title: exportTitle(report),
    organization: current.value?.legal_name || current.value?.name || '',
    currency: baseCurrency.value,
    generatedAt: new Intl.DateTimeFormat(exportLocale.startsWith('ar') ? 'ar-EG-u-nu-latn' : exportLocale, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: current.value?.timezone || 'UTC', timeZoneName: 'short',
    }).format(new Date()),
    direction: exportLocale.startsWith('ar') ? 'rtl' : 'ltr',
    labels: {
      organization: t('reports.organization'),
      currency: t('reports.currency'),
      generatedAt: t('reports.generatedAt'),
      warning: t('reports.mappingWarning'),
    },
    filters,
    warning: exportWarning(report),
  }
}

async function exportReport(report: ExportReport, format: ExportFormat = 'csv') {
  if (!currentId.value || exportPending.value) return
  const printWindow = format === 'print' ? window.open('', '_blank') : null
  if (format === 'print' && !printWindow) {
    exportError.value = t('reports.popupBlocked')
    return
  }
  if (printWindow) {
    printWindow.opener = null
    printWindow.document.write(`<!doctype html><html lang="${locale.value}" dir="${locale.value.startsWith('ar') ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${t('reports.preparing')}</title></head><body><p>${t('reports.preparing')}</p></body></html>`)
    printWindow.document.close()
  }
  const requestedScope = exportScope(report)
  const exportLocale = locale.value
  const exportPeriod = ['profit_loss', 'trial_balance', 'cash_flow', 'general_ledger'].includes(report) ? `${from.value}_${to.value}` : asOf.value
  const filename = `${t(`csv.filenames.${report}`)}-${exportPeriod}`
  const metadata = exportMetadata(report, exportLocale)
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
    if (exportScope(report) !== requestedScope || locale.value !== exportLocale) {
      printWindow?.close()
      return
    }
    const localizedCsv = localizeReportCsv(data, report, t)
    if (format === 'csv') downloadCsv(`${filename}.csv`, localizedCsv)
    else if (format === 'excel') downloadReportXlsx(`${filename}.xlsx`, buildReportXlsx(localizedCsv, report, metadata))
    else if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(buildPrintableReportHtml(localizedCsv, report, metadata))
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }
  catch {
    printWindow?.close()
    if (exportScope(report) === requestedScope) exportError.value = t('reports.exportFailed')
  }
  finally {
    exportPending.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-6">
    <LedgerPageHeader
      :title="t('reports.title')"
      :subtitle="t('reports.csvExports')"
      :from="tab === 'balance-sheet' ? undefined : from"
      :to="tab === 'balance-sheet' ? undefined : to"
      :as-of="tab === 'balance-sheet' ? asOf : undefined"
    />

    <p v-if="exportError" class="ls-error" role="alert">{{ exportError }}</p>

    <div class="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--bs-border)]" role="tablist">
      <BsButton
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
      </BsButton>
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
      <AccountingTableDensity v-model="tableDensity" :disabled="!tablePreferenceHydrated" />
    </div>

    <!-- Overview -->
    <section v-if="tab === 'overview'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.overview')">
      <div v-if="overviewError" role="alert" class="ls-card space-y-3 p-6">
        <p>{{ t('reports.loadError') }}</p>
        <BsButton type="button" class="ls-btn" @click="refreshOverview()">{{ t('accounts.retry') }}</BsButton>
      </div>
      <template v-else>
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

      <p v-if="statementReconciliation && (statementReconciliation.profit_loss_difference_minor !== 0 || statementReconciliation.balance_sheet_difference_minor !== 0 || !statementReconciliation.mapping_complete)" role="alert" class="ls-error">{{ t('financialMapping.reconciliationWarning') }}</p>
      <details v-if="statementReconciliation?.accounts?.length" class="ls-card p-4">
        <summary class="cursor-pointer font-semibold">{{ t('financialMapping.reconciliationDetails') }}</summary>
        <BsDataTable :value="statementReconciliation.accounts" :label="t('financialMapping.reconciliationDetails')" :density="tableDensity" class="mt-3">
          <Column :header="t('financialMapping.dimension')"><template #body="{ data: row }">{{ t(`financialMapping.dimensions.${row.statement}`) }}</template></Column>
          <Column :header="t('reports.account')"><template #body="{ data: row }"><BsButton type="button" class="text-link underline" @click="openStatementDrilldown(row.account_id, row.statement === 'balance_sheet' ? 'asof' : 'range')">{{ accountName(row.account_id) }}</BsButton></template></Column>
          <Column :header="t('financialMapping.statementAmount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.statement_minor" signed /></template></Column>
          <Column :header="t('financialMapping.ledgerAmount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.ledger_minor" signed /></template></Column>
          <Column :header="t('financialMapping.difference')"><template #body="{ data: row }"><MoneyText :amount-minor="row.difference_minor" signed /></template></Column>
        </BsDataTable>
      </details>
      <SectionSkeleton v-if="balanceSheetPending || profitLossPending" variant="cards" />
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard :title="t('reports.assets')" :amount-minor="assets" good-direction="neutral" />
        <KpiCard :title="t('reports.liabilities')" :amount-minor="liabilities" good-direction="neutral" />
        <KpiCard :title="t('reports.equity')" :amount-minor="equity" good-direction="neutral" />
        <KpiCard :title="t('reports.netProfitPeriod')" :amount-minor="netProfit" good-direction="neutral" />
      </div>

      <p v-if="periodInvalid" role="alert" class="ls-error">{{ t('reports.invalidPeriod') }}</p>
      <div v-else-if="trialBalanceError" role="alert" class="ls-card space-y-3 p-6"><p>{{ t('reports.trialBalanceError') }}</p><BsButton type="button" class="ls-btn" @click="refreshTrialBalance()">{{ t('accounts.retry') }}</BsButton></div>
      <SectionSkeleton v-else-if="trialBalancePending" variant="table" :rows="7" />
      <EmptyState v-else-if="!trialBalance.length" :title="t('reports.emptyTitle')" :description="t('reports.emptyRange')" />
      <section v-else class="ls-card overflow-hidden" aria-labelledby="tb-heading">
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h2 id="tb-heading" class="text-base font-bold">{{ t('reports.trialBalance') }} · <span dir="ltr">{{ baseCurrency }}</span></h2>
          <div class="flex items-center gap-3">
            <p class="text-sm font-semibold" :class="trialBalanced ? 'text-[var(--bs-status-success)]' : 'text-[var(--bs-status-error)]'">
              {{ trialBalanced ? t('reports.inBalance') : t('reports.outOfBalance') }}
            </p>
            <template v-if="can('reports.export')">
              <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="exportPending" @click="exportReport('trial_balance')">{{ t('common.exportCsv') }}</BsButton>
              <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="exportPending" @click="exportReport('trial_balance', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
              <BsButton type="button" class="ls-btn ls-btn-sm" :disabled="exportPending" @click="exportReport('trial_balance', 'print')">{{ t('reports.printPdf') }}</BsButton>
            </template>
          </div>
        </div>
        <div>
          <BsDataTable :value="trialBalance" data-key="account_id" :label="t('reports.trialBalance')" :density="tableDensity" sticky-header sticky-footer max-height="38rem" :scroll-label="t('accountingTable.trialBalanceScroll')">
  <Column header-class="ls-sticky-start" body-class="ls-sticky-start">
    <template #header>{{ t('reports.account') }}</template>
    <template #body="{ data: row }"><span class="block font-semibold">{{ row.name }}</span><span class="block font-mono text-xs text-fg-muted" dir="ltr">{{ row.code || t('common.dash') }}</span></template>
  </Column>
  <Column v-for="column in trialColumns" :key="column.field" :header="t(`reports.${column.label}`)" header-class="min-w-36 whitespace-nowrap text-end" body-class="ls-num whitespace-nowrap">
    <template #body="{ data: row }"><BsButton type="button" class="rounded-control px-1 text-link hover:underline focus-visible:outline focus-visible:outline-2" :aria-label="t('reports.drilldownAmount', { column: t(`reports.${column.label}`), account: row.name })" @click="openTrialDrilldown(row, column.scope)"><MoneyText :amount-minor="row[column.field]" /></BsButton></template>
  </Column>
  <ColumnGroup type="footer"><Row><Column :footer="t('reports.total')" footer-class="ls-sticky-start font-bold" /><Column v-for="total in trialTotalCells" :key="total.key" footer-class="ls-num whitespace-nowrap"><template #footer><MoneyText :amount-minor="total.amount" /></template></Column></Row></ColumnGroup>
</BsDataTable>
        </div>
      </section>
      </template>
    </section>

    <!-- Profit & Loss -->
    <section v-else-if="tab === 'profit-loss'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.profitLoss')">
      <div v-if="can('reports.export')" class="flex flex-wrap justify-end gap-2">
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('profit_loss')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('profit_loss', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('profit_loss', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </div>

      <div v-if="profitLossError" role="alert" class="ls-card space-y-3 p-6"><p>{{ t('reports.loadError') }}</p><BsButton type="button" class="ls-btn" @click="refreshProfitLoss()">{{ t('accounts.retry') }}</BsButton></div>
      <SectionSkeleton v-else-if="profitLossPending" variant="table" :rows="7" />

      <EmptyState
        v-else-if="!profitLoss?.length"
        :title="t('reports.emptyTitle')"
        :description="t('reports.emptyRange')"
      />

      <p v-if="!profitLossError && plMappingIncomplete" role="alert" class="ls-error">{{ t('financialMapping.incomplete') }}</p>
      <div v-if="!profitLossError && profitLoss?.length" class="ls-card overflow-hidden">
        <BsDataTable :label="t('reports.tabs.profitLoss')" :value="plSections.flatMap(section => rowsIn(profitLoss, section.key).map(row => ({ ...row, groupKey: section.key, groupLabel: section.labelKey })))" :density="tableDensity" row-group-mode="subheader" group-rows-by="groupKey">
  <Column :header="t('reports.account')" body-class="ps-8"><template #body="{ data: row }"><BsButton type="button" class="text-link underline" @click="openStatementDrilldown(row.account_id)">{{ row.name }}</BsButton></template></Column>
  <Column :header="t('transactions.amount')" body-class="ls-num"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" /></template></Column>
  <template #groupheader="{ data: row }"><div class="flex justify-between gap-4 bg-surface-muted font-bold"><span>{{ t(row.groupLabel) }}</span><MoneyText :amount-minor="sectionTotal(profitLoss, row.groupKey)" /></div></template>
  <template #footer><div class="flex justify-between gap-4 text-base font-bold"><span>{{ t('reports.netProfit') }}</span><MoneyText :amount-minor="netProfit" signed /></div></template>
</BsDataTable>
        <dl class="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
          <div class="flex justify-between"><dt>{{ t('financialMapping.grossProfit') }}</dt><dd><MoneyText :amount-minor="grossProfit" signed /></dd></div>
          <div class="flex justify-between"><dt>{{ t('financialMapping.operatingResult') }}</dt><dd><MoneyText :amount-minor="operatingResult" signed /></dd></div>
        </dl>
      </div>
    </section>

    <!-- Balance sheet -->
    <section v-else-if="tab === 'balance-sheet'" class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.balanceSheet')">
      <div v-if="can('reports.export')" class="flex flex-wrap justify-end gap-2">
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('balance_sheet')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('balance_sheet', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('balance_sheet', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </div>

      <p class="text-sm text-fg-muted">{{ t('statementClassification.reportHint', { date: formatDate(asOf, locale) }) }}</p>
      <div v-if="balanceSheetError" class="ls-card space-y-3 p-6" role="alert"><p class="ls-error">{{ t('statementClassification.reportError') }}</p><BsButton type="button" class="ls-btn" @click="refreshBalanceSheet()">{{ t('statementClassification.reload') }}</BsButton></div>
      <SectionSkeleton v-else-if="balanceSheetPending" variant="table" :rows="7" />

      <EmptyState
        v-else-if="!balanceSheet?.length"
        :title="t('reports.emptyTitle')"
        :description="t('reports.emptyAsOf')"
      />

      <template v-else>
        <p v-if="bsMappingIncomplete" role="alert" class="ls-error">{{ t('financialMapping.incomplete') }}</p>
        <div class="ls-card overflow-hidden">
          <BsDataTable :label="t('reports.tabs.balanceSheet')" :value="bsRows" :density="tableDensity" row-group-mode="subheader" group-rows-by="statement_line">
  <Column :header="t('reports.account')" body-class="ps-8"><template #body="{ data: row }"><BsButton v-if="row.account_id" type="button" class="text-link underline" @click="openStatementDrilldown(row.account_id, 'asof')">{{ row.displayName }}</BsButton><span v-else>{{ row.displayName }}</span></template></Column>
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
      <div v-if="can('reports.export')" class="flex flex-wrap justify-end gap-2">
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('cash_flow')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('cash_flow', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending" @click="exportReport('cash_flow', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </div>
      <div v-if="cashFlowError || cashDetailError" role="alert" class="ls-card space-y-3 p-6"><p>{{ t('reports.loadError') }}</p><BsButton type="button" class="ls-btn" @click="refreshCashFlowSurface">{{ t('accounts.retry') }}</BsButton></div>
      <SectionSkeleton v-else-if="cashFlowPending" variant="table" :rows="5" />

      <EmptyState v-else-if="!cashFlow" :title="t('reports.emptyCashTitle')" :description="t('reports.emptyCashHint')" />
      <div v-else class="ls-card space-y-4 p-5">
        <p v-if="!cashFlow.classification_complete || !cashFlow.reconciled" role="alert" class="ls-error">{{ t('financialMapping.cashIncomplete') }}</p>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="item in [
            ['net_profit', cashFlow.net_profit_minor],
            ['operating_adjustments', cashFlow.operating_adjustments_minor],
            ['operating_cash', cashFlow.operating_cash_minor],
            ['investing_cash', cashFlow.investing_cash_minor],
            ['financing_cash', cashFlow.financing_cash_minor],
            ['unclassified_cash', cashFlow.unclassified_cash_minor],
            ['net_cash_change', cashFlow.net_cash_change_minor],
            ['opening_cash', cashFlow.opening_cash_minor],
            ['closing_cash', cashFlow.closing_cash_minor],
          ]" :key="item[0]" class="flex justify-between border-b border-line py-2">
            <dt>{{ t(`financialMapping.cashLines.${item[0]}`) }}</dt><dd><MoneyText :amount-minor="item[1]" signed /></dd>
          </div>
        </dl>
        <p class="text-sm text-fg-muted">{{ t('financialMapping.cashDiagnostic', { difference: formatMoney(cashFlow.operating_adjustment_difference_minor, baseCurrency, locale) }) }}</p>
        <h3 class="font-semibold">{{ t('financialMapping.adjustmentSources') }}</h3>
        <BsDataTable :value="cashFlow.operating_adjustments" data-key="account_id" :label="t('financialMapping.adjustmentSources')" :density="tableDensity">
          <Column :header="t('reports.account')"><template #body="{ data: row }"><BsButton type="button" class="text-link underline" @click="openStatementDrilldown(row.account_id)">{{ row.code }} · {{ row.name }}</BsButton></template></Column>
          <Column :header="t('transactions.amount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" signed /></template></Column>
        </BsDataTable>
        <h3 class="font-semibold">{{ t('financialMapping.cashSources') }}</h3>
        <BsDataTable :value="cashDetail ?? []" :label="t('financialMapping.cashSources')" :density="tableDensity">
          <Column :header="t('reports.account')"><template #body="{ data: row }"><BsButton type="button" class="text-link underline" @click="openStatementDrilldown(row.account_id)">{{ accountName(row.account_id) }}</BsButton></template></Column>
          <Column :header="t('reports.activity')"><template #body="{ data: row }">{{ t(`financialMapping.lines.${row.section}`) }}</template></Column>
          <Column :header="t('transactions.amount')"><template #body="{ data: row }"><MoneyText :amount-minor="row.amount_minor" signed /></template></Column>
          <Column v-if="can('accounts.update')" :header="t('financialMapping.allocate')"><template #body="{ data: row }"><BsButton type="button" class="ls-btn ls-btn-sm" @click="allocationEntry = row">{{ t('financialMapping.allocate') }}</BsButton></template></Column>
        </BsDataTable>
      </div>
    </section>

    <!-- General ledger -->
    <section v-else class="space-y-4" role="tabpanel" :aria-label="t('reports.tabs.ledger')">
      <div v-if="can('reports.export')" class="flex flex-wrap justify-end gap-2">
        <BsButton type="button" class="ls-btn" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" class="ls-btn" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </div>
      <div v-if="ledgerError" role="alert" class="ls-card space-y-3 p-6"><p>{{ t('reports.loadError') }}</p><BsButton type="button" class="ls-btn" @click="refreshLedger()">{{ t('accounts.retry') }}</BsButton></div>
      <SectionSkeleton v-else-if="ledgerPending" variant="table" :rows="8" />

      <EmptyState
        v-else-if="!ledger?.length"
        :title="t('reports.emptyLedgerTitle')"
        :description="t('reports.emptyLedgerHint')"
      />

      <div v-else class="ls-card overflow-x-auto">
        <BsDataTable :value="ledger" data-key="entry_id" :label="t('reports.tabs.ledger')" :density="tableDensity">
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
    <CashFlowAllocationDialog v-if="allocationEntry" :entry-id="allocationEntry.entry_id" :account-name="accountName(allocationEntry.account_id)" @close="allocationEntry = null" @saved="() => { refreshCashFlow(); refreshCashDetail() }" />
    <AccountActivityDialog v-if="trialDrilldown" :account-id="trialDrilldown.accountId" :scope="trialScope" :initial-from="trialDrilldown.from" :initial-to="trialDrilldown.to" @close="trialDrilldown = null" />
  </div>
</template>
