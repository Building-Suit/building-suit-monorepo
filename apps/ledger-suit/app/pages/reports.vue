<script setup lang="ts">
import { renderPendingPrintDocument } from '@building-suit/ui/utils/reportDocument'
import { formatPresentationMoney, openPrintSession } from '@building-suit/ux'
import type { BsFinancialReportCell, BsFinancialReportColumn, BsFinancialReportCopy, BsFinancialReportFilters, BsFinancialReportSection, BsFinancialReportsView } from '@building-suit/ui/types/financialReportsPresentation'
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
const statementReconciliation = computed(() => overview.value?.reconciliation ?? null)
const integrity = computed(() => overview.value?.integrity ?? null)

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
  const printWindow = format === 'print' ? openPrintSession(renderPendingPrintDocument(t('reports.preparing'), locale.value.startsWith('ar') ? 'rtl' : 'ltr', t('reports.preparing'))) : null
  if (format === 'print' && !printWindow) { exportError.value = t('reports.popupBlocked'); return }
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
      printWindow.print(buildPrintableReportHtml(localizedCsv, report, metadata))
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
const ledgerPresentation = useLedgerPresentation()
const activityPresentation = useLedgerActivityPresentation(reactive({ get accountId() { return trialDrilldown.value?.accountId ?? null }, get scope() { return trialScope.value }, get initialFrom() { return trialDrilldown.value?.from }, get initialTo() { return trialDrilldown.value?.to } }), () => { trialDrilldown.value = null })
const allocationPresentation = useLedgerCashAllocationPresentation(reactive({ get entryId() { return allocationEntry.value?.entry_id ?? null }, get accountName() { return allocationEntry.value ? accountName(allocationEntry.value.account_id) : '' } }), { close: () => { allocationEntry.value = null }, saved: () => { void refreshCashFlow(); void refreshCashDetail() } })
const activityForm = activityPresentation.form
const allocationForm = allocationPresentation.form
const financialFilters = computed<BsFinancialReportFilters>({ get: () => ({ tab: tab.value, from: from.value, to: to.value, asOf: asOf.value, account: ledgerAccountId.value, density: tableDensity.value }), set: value => { if (value.tab !== tab.value) selectTab(value.tab); from.value = value.from; to.value = value.to; asOf.value = value.asOf; ledgerAccountId.value = value.account; tableDensity.value = value.density } })
const financialCopy = computed<BsFinancialReportCopy>(() => ({ title: t('reports.title'), subtitle: t('reports.csvExports'), context: t('pageContext.label'), from: t('reports.from'), to: t('reports.to'), asOf: t('reports.asOf'), account: t('reports.account'), density: t('accountingTable.density'), compact: t('accountingTable.compact'), comfortable: t('accountingTable.comfortable'), retry: t('accounts.retry'), failed: t('reports.loadError'), empty: t('reports.emptyTitle'), emptyHint: t('reports.emptyRange'), total: t('reports.total'), csv: t('common.exportCsv'), excel: t('reports.exportExcel'), print: t('reports.printPdf'), allocate: t('financialMapping.allocate'), reconciliation: t('financialMapping.reconciliationDetails'), trialBalance: t('reports.trialBalance'), scroll: t('accountingTable.trialBalanceScroll') }))
function displayReportMoney(value: number | string | bigint, _signed = false) { return formatPresentationMoney(value, { currency: ledgerPresentation.currency(), locale: locale.value, unit: 'minor', numberingSystem: 'latn' }) }
function reportCell(value: string, account?: string | null, period: 'range' | 'asof' | 'opening' | 'period' | 'closing' = 'range', label?: string): BsFinancialReportCell { return { value, ...(account ? { action: { account, period } } : {}), ...(label ? { label } : {}) } }
const financialView = computed<BsFinancialReportsView>(() => {
 const active = tab.value
 const column = (key: string, label: string, total = '') => ({ key, label, total })
 const amountColumn = column('amount', t('transactions.amount'))
 let columns: BsFinancialReportColumn[] = [amountColumn]
 let sections: BsFinancialReportSection[] = []
 let failed = false; let loading = false; let empty = false; let errorLabel = t('reports.loadError'); let emptyHint = t('reports.emptyRange')
 const warnings: string[] = []
 const totals: { label: string; value: string }[] = []
 if (active === 'overview') {
  failed = !!overviewError.value; loading = overviewPending.value; empty = !trialBalance.value.length
  columns = trialColumns.map(item => column(item.field, t(`reports.${item.label}`), displayReportMoney(sumTrial(item.field))))
  sections = [{ id: 'trial', title: `${t('reports.trialBalance')} · ${baseCurrency.value}`, total: '', rows: trialBalance.value.map(row => ({ id: row.account_id, name: row.name, code: row.code || t('common.dash'), cells: trialColumns.map(item => reportCell(displayReportMoney(row[item.field]), row.account_id, item.scope, t('reports.drilldownAmount', { column: t(`reports.${item.label}`), account: row.name }))) })) }]
  if (integrity.value?.balanced === false) warnings.push(`${t('reports.integrityTitle')} ${t('reports.integrityBody', { difference: formatMoney(Number(integrity.value.difference_minor), baseCurrency.value, locale.value) })}`)
  if (statementReconciliation.value && (statementReconciliation.value.profit_loss_difference_minor !== 0 || statementReconciliation.value.balance_sheet_difference_minor !== 0 || !statementReconciliation.value.mapping_complete)) warnings.push(t('financialMapping.reconciliationWarning'))
 } else if (active === 'profit-loss') {
  failed = !!profitLossError.value; loading = profitLossPending.value; empty = !profitLoss.value.length
  if (plMappingIncomplete.value) warnings.push(t('financialMapping.incomplete'))
  sections = plSections.map(section => ({ id: section.key, title: t(section.labelKey), total: displayReportMoney(sectionTotal(profitLoss.value, section.key)), rows: rowsIn(profitLoss.value, section.key).map((row, index) => ({ id: row.account_id || `${section.key}-${index}`, name: row.name, code: row.code || '', cells: [reportCell(displayReportMoney(row.amount_minor), row.account_id)] })) })).filter(section => section.rows.length)
  totals.push({ label: t('reports.netProfit'), value: displayReportMoney(netProfit.value, true) }, { label: t('financialMapping.grossProfit'), value: displayReportMoney(grossProfit.value, true) }, { label: t('financialMapping.operatingResult'), value: displayReportMoney(operatingResult.value, true) })
 } else if (active === 'balance-sheet') {
  failed = !!balanceSheetError.value; loading = balanceSheetPending.value; empty = !balanceSheet.value.length; errorLabel = t('statementClassification.reportError'); emptyHint = t('reports.emptyAsOf')
  if (bsMappingIncomplete.value) warnings.push(t('financialMapping.incomplete'))
  columns = [column('effective', t('statementClassification.effectiveFrom')), amountColumn]
  sections = STATEMENT_LINES.map(line => ({ id: line, title: t(`statementClassification.lines.${line}`), total: displayReportMoney(sumStatementAmounts(balanceSheet.value, line, 'statement_line')), rows: bsRows.value.filter(row => row.statement_line === line).map((row, index) => ({ id: row.account_id || `${line}-${index}`, name: row.displayName, code: '', cells: [reportCell(row.effective_from ? formatDate(row.effective_from, locale.value) : t('common.dash')), reportCell(displayReportMoney(row.amount_minor), row.account_id, 'asof')] })) })).filter(section => section.rows.length)
 } else if (active === 'cash-flow') {
  failed = !!cashFlowError.value || !!cashDetailError.value; loading = cashFlowPending.value; empty = !cashFlow.value; emptyHint = t('reports.emptyCashHint')
  if (cashFlow.value && (!cashFlow.value.classification_complete || !cashFlow.value.reconciled)) warnings.push(t('financialMapping.cashIncomplete'))
  columns = [column('activity', t('reports.activity')), amountColumn]
  sections = [{ id: 'sources', title: '', total: '', rows: (cashDetail.value || []).map(row => ({ id: row.entry_id, name: accountName(row.account_id), code: '', cells: [reportCell(t(`financialMapping.lines.${row.section}`)), reportCell(displayReportMoney(row.amount_minor, true), row.account_id)], allocationId: row.entry_id })) }]
 } else {
  failed = !!ledgerError.value; loading = ledgerPending.value; empty = !ledger.value.length; emptyHint = t('reports.emptyLedgerHint')
  columns = [column('date', t('transactions.date')), column('reference', t('transactions.reference')), column('debit', t('detail.debit')), column('credit', t('detail.credit')), column('balance', t('reports.runningBalance'))]
  sections = [{ id: 'ledger', title: '', total: '', rows: ledger.value.map(row => ({ id: row.entry_id, name: row.description || row.memo || t('common.dash'), code: '', cells: [reportCell(formatDate(row.entry_date, locale.value)), reportCell(row.reference || t('common.dash')), reportCell(Number(row.debit_minor) ? displayReportMoney(row.debit_minor) : t('common.dash')), reportCell(Number(row.credit_minor) ? displayReportMoney(row.credit_minor) : t('common.dash')), reportCell(displayReportMoney(row.running_balance_minor))] })) }]
 }
 const cashKeys = ['net_profit', 'operating_adjustments', 'operating_cash', 'investing_cash', 'financing_cash', 'unclassified_cash', 'net_cash_change', 'opening_cash', 'closing_cash'] as const
 return { context: ledgerPresentation.context(active === 'balance-sheet' ? undefined : from.value, active === 'balance-sheet' ? undefined : to.value, active === 'balance-sheet' ? asOf.value : undefined), tabs: TABS.map(item => ({ value: item.key, label: t(item.labelKey) })), accounts: accounts.value.map(account => ({ value: account.id, label: `${account.code ? `${account.code} · ` : ''}${account.name}` })), preferenceReady: tablePreferenceHydrated.value, canExport: can('reports.export'), canAllocate: can('accounts.update'), exporting: exportPending.value, exportError: exportError.value, invalidPeriod: periodInvalid.value ? t('reports.invalidPeriod') : '', loading, failed, errorLabel, emptyHint, warnings, columns, sections, totals,
  metrics: active === 'overview' ? [['assets', assets.value], ['liabilities', liabilities.value], ['equity', equity.value], ['netProfitPeriod', netProfit.value]].map(([key, value]) => ({ id: key!, label: t(`reports.${key}`), value: displayReportMoney(value!), hint: ledgerPresentation.kpi(value!, null, 'neutral').label || '', tone: 'neutral' as const })) : [],
  equation: active === 'balance-sheet' ? `${t('statementClassification.reportHint', { date: formatDate(asOf.value, locale.value) })} ${t('reports.equation', { assets: formatMoney(assets.value, baseCurrency.value, locale.value), liabilities: formatMoney(liabilities.value, baseCurrency.value, locale.value), equity: formatMoney(equity.value, baseCurrency.value, locale.value) })}` : '', equationTone: BigInt(assets.value) === BigInt(liabilities.value) + BigInt(equity.value) ? 'muted' : 'danger',
  reconciliation: active === 'overview' ? (statementReconciliation.value?.accounts || []).map((row, index) => ({ id: `${row.account_id}-${index}`, name: accountName(row.account_id), code: '', cells: [reportCell(t(`financialMapping.dimensions.${row.statement}`), row.account_id, row.statement === 'balance_sheet' ? 'asof' : 'range'), reportCell(displayReportMoney(row.statement_minor, true)), reportCell(displayReportMoney(row.ledger_minor, true)), reportCell(displayReportMoney(row.difference_minor, true))] })) : [], reconciliationColumns: [column('dimension', t('financialMapping.dimension')), column('statement', t('financialMapping.statementAmount')), column('ledger', t('financialMapping.ledgerAmount')), column('difference', t('financialMapping.difference'))],
  diagnostic: active === 'cash-flow' && cashFlow.value ? t('financialMapping.cashDiagnostic', { difference: formatMoney(cashFlow.value.operating_adjustment_difference_minor, baseCurrency.value, locale.value) }) : '', cashSummary: active === 'cash-flow' && cashFlow.value ? cashKeys.map(key => ({ label: t(`financialMapping.cashLines.${key}`), value: displayReportMoney(cashFlow.value![`${key}_minor`], true) })) : [],
  adjustments: active === 'cash-flow' ? (cashFlow.value?.operating_adjustments || []).map(row => ({ id: row.account_id, name: `${row.code} · ${row.name}`, code: '', cells: [reportCell('', row.account_id), reportCell(displayReportMoney(row.amount_minor, true), row.account_id)] })) : [], adjustmentTitle: t('financialMapping.adjustmentSources'), cashSourceTitle: t('financialMapping.cashSources'), balanceLabel: active === 'overview' ? t(trialBalanced.value ? 'reports.inBalance' : 'reports.outOfBalance') : '', balanced: trialBalanced.value, empty,
 }
})
function reportDrilldown(accountId: string, period: 'range' | 'asof' | 'opening' | 'period' | 'closing') { if (['opening', 'period', 'closing'].includes(period)) { const row = trialBalance.value.find(row => row.account_id === accountId); if (row) openTrialDrilldown(row, period as 'opening' | 'period' | 'closing') } else openStatementDrilldown(accountId, period as 'range' | 'asof') }
function reportAllocate(id: string) { allocationEntry.value = cashDetail.value?.find(row => row.entry_id === id) ?? null }
function retryReport() { if (tab.value === 'overview') return refreshOverview(); if (tab.value === 'profit-loss') return refreshProfitLoss(); if (tab.value === 'balance-sheet') return refreshBalanceSheet(); if (tab.value === 'cash-flow') return refreshCashFlowSurface(); return refreshLedger() }
function exportCurrentReport(format: ExportFormat) { const reports: Record<TabKey, ExportReport> = { overview: 'trial_balance', 'profit-loss': 'profit_loss', 'balance-sheet': 'balance_sheet', 'cash-flow': 'cash_flow', ledger: 'general_ledger' }; return exportReport(reports[tab.value], format) }
</script>
<template>
 <BsReportsPage v-model:financial-filters="financialFilters" v-model:activity-form="activityForm" v-model:allocation-form="allocationForm" :financial="{ copy: financialCopy, view: financialView }" :activity="{ copy: activityPresentation.copy.value, view: activityPresentation.view.value }" :allocation="{ copy: allocationPresentation.copy.value, view: allocationPresentation.view.value }" @financial-export="exportCurrentReport" @financial-retry="retryReport" @drilldown="reportDrilldown" @allocate="reportAllocate" @close-activity="trialDrilldown = null" @activity-back="activityPresentation.back" @activity-apply="activityPresentation.apply" @activity-retry="activityPresentation.retry" @activity-page="activityPresentation.page" @activity-journal="activityPresentation.journal" @activity-account="activityPresentation.account" @close-allocation="allocationEntry = null" @save-allocation="allocationPresentation.save"/>
</template>
