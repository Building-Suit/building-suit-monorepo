<script setup lang="ts">
import { resolveTemplateElement } from '~/utils/templateElement'
import { useLedgerAccountActivityDialogView } from '~/composables/useLedgerAccountActivityDialogView'
import { useLedgerCashFlowAllocationDialogView } from '~/composables/useLedgerCashFlowAllocationDialogView'
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
const ledgerPresentation = useLedgerPresentation()
</script>

<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="t('reports.title')"
      :subtitle="t('reports.csvExports')"
      :context="ledgerPresentation.context(tab === 'balance-sheet' ? undefined : from, tab === 'balance-sheet' ? undefined : to, tab === 'balance-sheet' ? asOf : undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsText v-if="exportError" role="alert" tone="danger">{{ exportError }}</BsText>
    <BsInline role="tablist" gap="xs" :wrap="false">
      <BsButton v-for="item in TABS" :key="item.key" variant="tab" type="button" role="tab" :aria-selected="tab === item.key" @click="selectTab(item.key)">{{ t(item.labelKey) }}</BsButton>
    </BsInline>
    <BsInline gap="md" :wrap="true" align="end">
      <template v-if="tab !== 'balance-sheet'">
        <BsFloatingField :label="t('reports.from')">
          <BsInput id="from" v-model="from" type="date" />
        </BsFloatingField>
        <BsFloatingField :label="t('reports.to')">
          <BsInput id="to" v-model="to" type="date" :min="from" />
        </BsFloatingField>
      </template>
      <BsFloatingField v-else :label="t('reports.asOf')">
        <BsInput id="asof" v-model="asOf" type="date" />
      </BsFloatingField>
      <BsFloatingField v-if="tab === 'ledger'" :label="t('reports.account')">
        <BsSelect id="ledger-account" v-model="ledgerAccountId" native>
          <BsSelectOption v-for="a in accounts" :key="a.id" :value="a.id">{{ a.code ? `${a.code} · ` : '' }}{{ a.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsTableDensity
        v-model="tableDensity"
        :disabled="!tablePreferenceHydrated"
        :label="ledgerPresentation.t('accountingTable.density')"
        :compact-label="ledgerPresentation.t('accountingTable.compact')"
        :comfortable-label="ledgerPresentation.t('accountingTable.comfortable')"
      />
    </BsInline>
    <!-- Overview -->
    <BsStack v-if="tab === 'overview'" role="tabpanel" :aria-label="t('reports.tabs.overview')" as="section" gap="md">
      <BsCard v-if="overviewError" role="alert" as="div" padding="lg">
        <BsStack gap="md">
          <BsText>{{ t('reports.loadError') }}</BsText>
          <BsButton type="button" @click="refreshOverview()">{{ t('accounts.retry') }}</BsButton>
        </BsStack>
      </BsCard>
      <template v-else>
        <BsBox v-if="integrity && integrity.balanced === false" role="alert" border radius="control">
          <BsText emphasis="bold">{{ t('reports.integrityTitle') }}</BsText>
          <BsText>{{ t('reports.integrityBody', {
            difference: formatMoney(Number(integrity.difference_minor), baseCurrency, locale),
          }) }}</BsText>
        </BsBox>
        <BsText
          v-if="statementReconciliation && (statementReconciliation.profit_loss_difference_minor !== 0 || statementReconciliation.balance_sheet_difference_minor !== 0 || !statementReconciliation.mapping_complete)"
          role="alert"
          tone="danger"
        >{{ t('financialMapping.reconciliationWarning') }}</BsText>
        <BsDisclosure v-if="statementReconciliation?.accounts?.length">
          <template #summary>{{ t('financialMapping.reconciliationDetails') }}</template>
          <BsDataTable
            :value="statementReconciliation.accounts"
            :label="t('financialMapping.reconciliationDetails')"
            :density="tableDensity"
            :columns="[{ key: 'column1', header: t('financialMapping.dimension') }, { key: 'column2', header: t('reports.account') }, { key: 'column3', header: t('financialMapping.statementAmount') }, { key: 'column4', header: t('financialMapping.ledgerAmount') }, { key: 'column5', header: t('financialMapping.difference') }]"
          >
            <template #cell-column1="{ row }">{{ t(`financialMapping.dimensions.${row.statement}`) }}</template>
            <template #cell-column2="{ row }">
              <BsButton variant="link" type="button" @click="openStatementDrilldown(row.account_id, row.statement === 'balance_sheet' ? 'asof' : 'range')">{{ accountName(row.account_id) }}</BsButton>
            </template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.statement_minor" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsMoneyText :amount="row.ledger_minor" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column5="{ row }">
              <BsMoneyText :amount="row.difference_minor" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
          </BsDataTable>
        </BsDisclosure>
        <BsSectionSkeleton v-if="balanceSheetPending || profitLossPending" variant="cards" />
        <BsGrid v-else :columns="4" gap="md">
          <BsKpiCard
            :title="t('reports.assets')"
            :change-label="ledgerPresentation.kpi(assets, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(assets, null, 'neutral').tone"
          >
            <BsMoneyText :amount="assets" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('reports.liabilities')"
            :change-label="ledgerPresentation.kpi(liabilities, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(liabilities, null, 'neutral').tone"
          >
            <BsMoneyText :amount="liabilities" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('reports.equity')"
            :change-label="ledgerPresentation.kpi(equity, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(equity, null, 'neutral').tone"
          >
            <BsMoneyText :amount="equity" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
          <BsKpiCard
            :title="t('reports.netProfitPeriod')"
            :change-label="ledgerPresentation.kpi(netProfit, null, 'neutral').label"
            :tone="ledgerPresentation.kpi(netProfit, null, 'neutral').tone"
          >
            <BsMoneyText :amount="netProfit" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </BsKpiCard>
        </BsGrid>
        <BsText v-if="periodInvalid" role="alert" tone="danger">{{ t('reports.invalidPeriod') }}</BsText>
        <BsCard v-else-if="trialBalanceError" role="alert" as="div" padding="lg">
          <BsStack gap="md">
            <BsText>{{ t('reports.trialBalanceError') }}</BsText>
            <BsButton type="button" @click="refreshTrialBalance()">{{ t('accounts.retry') }}</BsButton>
          </BsStack>
        </BsCard>
        <BsSectionSkeleton v-else-if="trialBalancePending" variant="table" :rows="7" />
        <BsEmptyState v-else-if="!trialBalance.length" :title="t('reports.emptyTitle')" :description="t('reports.emptyRange')" />
        <BsCard v-else aria-labelledby="tb-heading" as="section" padding="none" overflow="hidden">
          <BsInline gap="md" :wrap="true" justify="between">
            <BsHeading id="tb-heading" :level="2" size="body">{{ t('reports.trialBalance') }} · <BsText dir="ltr" as="span">{{ baseCurrency }}</BsText></BsHeading>
            <BsInline gap="md" :wrap="false">
              <BsText size="sm" emphasis="semibold" :tone="trialBalanced ? 'success' : 'danger'">{{ trialBalanced ? t('reports.inBalance') : t('reports.outOfBalance') }}</BsText>
              <template v-if="can('reports.export')">
                <BsButton type="button" :disabled="exportPending" size="sm" @click="exportReport('trial_balance')">{{ t('common.exportCsv') }}</BsButton>
                <BsButton type="button" :disabled="exportPending" size="sm" @click="exportReport('trial_balance', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
                <BsButton type="button" :disabled="exportPending" size="sm" @click="exportReport('trial_balance', 'print')">{{ t('reports.printPdf') }}</BsButton>
              </template>
            </BsInline>
          </BsInline>
          <BsBox>
            <BsDataTable
              :value="trialBalance"
              row-key="account_id"
              :label="t('reports.trialBalance')"
              :density="tableDensity"
              sticky-header
              sticky-footer
              max-height="38rem"
              :scroll-label="t('accountingTable.trialBalanceScroll')"
              :columns="[{ key: 'column1', header: (t('reports.account')), sticky: 'start' as const, width: 'lg' as const, footer: t('reports.total') }, ...(trialColumns ?? []).map((column) => ({ key: column.field, header: t(`reports.${column.label}`), align: 'end' as const }))]"
            >
              <template #header-column1>{{ t('reports.account') }}</template>
              <template #cell-column1="{ row }">
                <BsText as="span" emphasis="semibold">{{ row.name }}</BsText>
                <BsText dir="ltr" as="span" size="xs" tone="muted">{{ row.code || t('common.dash') }}</BsText>
              </template>
              <template v-for="column in trialColumns" :key="column.field" #[`cell-${column.field}`]="{ row }">
                <BsButton
                  variant="link"
                  type="button"
                  :aria-label="t('reports.drilldownAmount', { column: t(`reports.${column.label}`), account: row.name })"
                  @click="openTrialDrilldown(row, column.scope)"
                >
                  <BsMoneyText :amount="row[column.field]" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
                </BsButton>
              </template>
              <template v-for="column in trialColumns" :key="column.field" #[`footer-${column.field}`]>
                <BsMoneyText :amount="sumTrial(column.field)" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </template>
            </BsDataTable>
          </BsBox>
        </BsCard>
      </template>
    </BsStack>
    <!-- Profit & Loss -->
    <BsStack v-else-if="tab === 'profit-loss'" role="tabpanel" :aria-label="t('reports.tabs.profitLoss')" as="section" gap="md">
      <BsInline v-if="can('reports.export')" gap="sm" :wrap="true" justify="end">
        <BsButton type="button" :disabled="exportPending" @click="exportReport('profit_loss')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" :disabled="exportPending" @click="exportReport('profit_loss', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" :disabled="exportPending" @click="exportReport('profit_loss', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </BsInline>
      <BsCard v-if="profitLossError" role="alert" as="div" padding="lg">
        <BsStack gap="md">
          <BsText>{{ t('reports.loadError') }}</BsText>
          <BsButton type="button" @click="refreshProfitLoss()">{{ t('accounts.retry') }}</BsButton>
        </BsStack>
      </BsCard>
      <BsSectionSkeleton v-else-if="profitLossPending" variant="table" :rows="7" />
      <BsEmptyState v-else-if="!profitLoss?.length" :title="t('reports.emptyTitle')" :description="t('reports.emptyRange')" />
      <BsText v-if="!profitLossError && plMappingIncomplete" role="alert" tone="danger">{{ t('financialMapping.incomplete') }}</BsText>
      <BsCard v-if="!profitLossError && profitLoss?.length" as="div" padding="none" overflow="hidden">
        <BsDataTable
          :label="t('reports.tabs.profitLoss')"
          :value="plSections.flatMap(section => rowsIn(profitLoss, section.key).map(row => ({ ...row, groupKey: section.key, groupLabel: section.labelKey })))"
          :density="tableDensity"
          row-group-mode="subheader"
          group-rows-by="groupKey"
          :columns="[{ key: 'column1', header: t('reports.account') }, { key: 'column2', header: t('transactions.amount'), align: 'end' as const }]"
        >
          <template #cell-column1="{ row }">
            <BsButton variant="link" type="button" @click="openStatementDrilldown(row.account_id)">{{ row.name }}</BsButton>
          </template>
          <template #cell-column2="{ row }">
            <BsMoneyText :amount="row.amount_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </template>
          <template #groupheader="{ data: row }">
            <BsInline gap="md" :wrap="false" justify="between" surface="muted">
              <BsText as="span">{{ t(row.groupLabel) }}</BsText>
              <BsMoneyText :amount="sectionTotal(profitLoss, row.groupKey)" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsInline>
          </template>
          <template #footer>
            <BsInline gap="md" :wrap="false" justify="between">
              <BsText as="span">{{ t('reports.netProfit') }}</BsText>
              <BsMoneyText :amount="netProfit" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsInline>
          </template>
        </BsDataTable>
        <BsDescriptionList :columns="2">
          <BsInline gap="none" :wrap="false" justify="between">
            <BsDescriptionTerm>{{ t('financialMapping.grossProfit') }}</BsDescriptionTerm>
            <BsDescriptionValue>
              <BsMoneyText :amount="grossProfit" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsDescriptionValue>
          </BsInline>
          <BsInline gap="none" :wrap="false" justify="between">
            <BsDescriptionTerm>{{ t('financialMapping.operatingResult') }}</BsDescriptionTerm>
            <BsDescriptionValue>
              <BsMoneyText :amount="operatingResult" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </BsDescriptionValue>
          </BsInline>
        </BsDescriptionList>
      </BsCard>
    </BsStack>
    <!-- Balance sheet -->
    <BsStack v-else-if="tab === 'balance-sheet'" role="tabpanel" :aria-label="t('reports.tabs.balanceSheet')" as="section" gap="md">
      <BsInline v-if="can('reports.export')" gap="sm" :wrap="true" justify="end">
        <BsButton type="button" :disabled="exportPending" @click="exportReport('balance_sheet')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" :disabled="exportPending" @click="exportReport('balance_sheet', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" :disabled="exportPending" @click="exportReport('balance_sheet', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </BsInline>
      <BsText size="sm" tone="muted">{{ t('statementClassification.reportHint', { date: formatDate(asOf, locale) }) }}</BsText>
      <BsCard v-if="balanceSheetError" role="alert" as="div" padding="lg">
        <BsStack gap="md">
          <BsText tone="danger">{{ t('statementClassification.reportError') }}</BsText>
          <BsButton type="button" @click="refreshBalanceSheet()">{{ t('statementClassification.reload') }}</BsButton>
        </BsStack>
      </BsCard>
      <BsSectionSkeleton v-else-if="balanceSheetPending" variant="table" :rows="7" />
      <BsEmptyState v-else-if="!balanceSheet?.length" :title="t('reports.emptyTitle')" :description="t('reports.emptyAsOf')" />
      <template v-else>
        <BsText v-if="bsMappingIncomplete" role="alert" tone="danger">{{ t('financialMapping.incomplete') }}</BsText>
        <BsCard as="div" padding="none" overflow="hidden">
          <BsDataTable
            :label="t('reports.tabs.balanceSheet')"
            :value="bsRows"
            :density="tableDensity"
            row-group-mode="subheader"
            group-rows-by="statement_line"
            :columns="[{ key: 'column1', header: t('reports.account') }, { key: 'column2', header: t('statementClassification.effectiveFrom') }, { key: 'column3', header: t('transactions.amount'), align: 'end' as const }]"
          >
            <template #cell-column1="{ row }">
              <BsButton v-if="row.account_id" variant="link" type="button" @click="openStatementDrilldown(row.account_id, 'asof')">{{ row.displayName }}</BsButton>
              <BsText v-else as="span">{{ row.displayName }}</BsText>
            </template>
            <template #cell-column2="{ row }">{{ row.effective_from ? formatDate(row.effective_from, locale) : t('common.dash') }}</template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.amount_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #groupheader="{ data: row }">
              <BsInline gap="md" :wrap="false" justify="between" surface="muted">
                <BsText as="span">{{ t(`statementClassification.lines.${row.statement_line}`) }}</BsText>
                <BsMoneyText
                  :amount="sumStatementAmounts(balanceSheet, row.statement_line, 'statement_line')"
                  :currency="ledgerPresentation.currency()"
                  :locale="ledgerPresentation.locale"
                />
              </BsInline>
            </template>
          </BsDataTable>
        </BsCard>
        <BsText size="sm" :tone="BigInt(assets) === BigInt(liabilities) + BigInt(equity) ? 'muted' : 'danger'">{{ t('reports.equation', {
            assets: formatMoney(assets, baseCurrency, locale),
            liabilities: formatMoney(liabilities, baseCurrency, locale),
            equity: formatMoney(equity, baseCurrency, locale),
          }) }}</BsText>
      </template>
    </BsStack>
    <!-- Cash flow -->
    <BsStack v-else-if="tab === 'cash-flow'" role="tabpanel" :aria-label="t('reports.tabs.cashFlow')" as="section" gap="md">
      <BsInline v-if="can('reports.export')" gap="sm" :wrap="true" justify="end">
        <BsButton type="button" :disabled="exportPending" @click="exportReport('cash_flow')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" :disabled="exportPending" @click="exportReport('cash_flow', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" :disabled="exportPending" @click="exportReport('cash_flow', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </BsInline>
      <BsCard v-if="cashFlowError || cashDetailError" role="alert" as="div" padding="lg">
        <BsStack gap="md">
          <BsText>{{ t('reports.loadError') }}</BsText>
          <BsButton type="button" @click="refreshCashFlowSurface">{{ t('accounts.retry') }}</BsButton>
        </BsStack>
      </BsCard>
      <BsSectionSkeleton v-else-if="cashFlowPending" variant="table" :rows="5" />
      <BsEmptyState v-else-if="!cashFlow" :title="t('reports.emptyCashTitle')" :description="t('reports.emptyCashHint')" />
      <BsCard v-else as="div" padding="md">
        <BsStack gap="md">
          <BsText v-if="!cashFlow.classification_complete || !cashFlow.reconciled" role="alert" tone="danger">{{ t('financialMapping.cashIncomplete') }}</BsText>
          <BsDescriptionList :columns="2">
            <BsInline
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
          ]"
              :key="item[0]"
              gap="none"
              :wrap="false"
              justify="between"
            >
              <BsDescriptionTerm>{{ t(`financialMapping.cashLines.${item[0]}`) }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsMoneyText :amount="item[1]" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
              </BsDescriptionValue>
            </BsInline>
          </BsDescriptionList>
          <BsText size="sm" tone="muted">{{ t('financialMapping.cashDiagnostic', { difference: formatMoney(cashFlow.operating_adjustment_difference_minor, baseCurrency, locale) }) }}</BsText>
          <BsHeading :level="3" size="body">{{ t('financialMapping.adjustmentSources') }}</BsHeading>
          <BsDataTable
            :value="cashFlow.operating_adjustments"
            row-key="account_id"
            :label="t('financialMapping.adjustmentSources')"
            :density="tableDensity"
            :columns="[{ key: 'column1', header: t('reports.account') }, { key: 'column2', header: t('transactions.amount') }]"
          >
            <template #cell-column1="{ row }">
              <BsButton variant="link" type="button" @click="openStatementDrilldown(row.account_id)">{{ row.code }} · {{ row.name }}</BsButton>
            </template>
            <template #cell-column2="{ row }">
              <BsMoneyText :amount="row.amount_minor" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
          </BsDataTable>
          <BsHeading :level="3" size="body">{{ t('financialMapping.cashSources') }}</BsHeading>
          <BsDataTable
            :value="cashDetail ?? []"
            :label="t('financialMapping.cashSources')"
            :density="tableDensity"
            :columns="[{ key: 'column1', header: t('reports.account') }, { key: 'column2', header: t('reports.activity') }, { key: 'column3', header: t('transactions.amount') }, ...((can('accounts.update')) ? [{ key: 'column4', header: t('financialMapping.allocate') }] : [])]"
          >
            <template #cell-column1="{ row }">
              <BsButton variant="link" type="button" @click="openStatementDrilldown(row.account_id)">{{ accountName(row.account_id) }}</BsButton>
            </template>
            <template #cell-column2="{ row }">{{ t(`financialMapping.lines.${row.section}`) }}</template>
            <template #cell-column3="{ row }">
              <BsMoneyText :amount="row.amount_minor" signed :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row }">
              <BsButton type="button" size="sm" @click="allocationEntry = row">{{ t('financialMapping.allocate') }}</BsButton>
            </template>
          </BsDataTable>
        </BsStack>
      </BsCard>
    </BsStack>
    <!-- General ledger -->
    <BsStack v-else role="tabpanel" :aria-label="t('reports.tabs.ledger')" as="section" gap="md">
      <BsInline v-if="can('reports.export')" gap="sm" :wrap="true" justify="end">
        <BsButton type="button" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger')">{{ t('common.exportCsv') }}</BsButton>
        <BsButton type="button" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger', 'excel')">{{ t('reports.exportExcel') }}</BsButton>
        <BsButton type="button" :disabled="exportPending || !ledgerAccountId" @click="exportReport('general_ledger', 'print')">{{ t('reports.printPdf') }}</BsButton>
      </BsInline>
      <BsCard v-if="ledgerError" role="alert" as="div" padding="lg">
        <BsStack gap="md">
          <BsText>{{ t('reports.loadError') }}</BsText>
          <BsButton type="button" @click="refreshLedger()">{{ t('accounts.retry') }}</BsButton>
        </BsStack>
      </BsCard>
      <BsSectionSkeleton v-else-if="ledgerPending" variant="table" :rows="8" />
      <BsEmptyState v-else-if="!ledger?.length" :title="t('reports.emptyLedgerTitle')" :description="t('reports.emptyLedgerHint')" />
      <BsCard v-else as="div" padding="none">
        <BsDataTable
          :value="ledger"
          row-key="entry_id"
          :label="t('reports.tabs.ledger')"
          :density="tableDensity"
          :columns="[{ key: 'column1', header: (t('transactions.date')) }, { key: 'column2', header: (t('transactions.reference')) }, { key: 'column3', header: (t('transactions.description')) }, { key: 'column4', header: (t('detail.debit')), align: 'end' as const }, { key: 'column5', header: (t('detail.credit')), align: 'end' as const }, { key: 'column6', header: (t('reports.runningBalance')), align: 'end' as const }]"
        >
          <template #header-column1>{{ t('transactions.date') }}</template>
          <template #cell-column1="{ row }">{{ formatDate(row.entry_date, locale) }}</template>
          <template #header-column2>{{ t('transactions.reference') }}</template>
          <template #cell-column2="{ row }">{{ row.reference || t('common.dash') }}</template>
          <template #header-column3>{{ t('transactions.description') }}</template>
          <template #cell-column3="{ row }">{{ row.description || row.memo || t('common.dash') }}</template>
          <template #header-column4>{{ t('detail.debit') }}</template>
          <template #cell-column4="{ row }">
            <BsMoneyText v-if="Number(row.debit_minor)" :amount="row.debit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            <BsText v-else as="span">{{ t('common.dash') }}</BsText>
          </template>
          <template #header-column5>{{ t('detail.credit') }}</template>
          <template #cell-column5="{ row }">
            <BsMoneyText v-if="Number(row.credit_minor)" :amount="row.credit_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
            <BsText v-else as="span">—</BsText>
          </template>
          <template #header-column6>{{ t('reports.runningBalance') }}</template>
          <template #cell-column6="{ row }">
            <BsMoneyText :amount="row.running_balance_minor" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
          </template>
        </BsDataTable>
      </BsCard>
    </BsStack>
    <BsWorkflowScope
      v-if="allocationEntry"
      :factory="useLedgerCashFlowAllocationDialogView"
      :input="{ entryId: (allocationEntry.entry_id), accountName: (accountName(allocationEntry.account_id)) }"
      @close="allocationEntry = null"
      @saved="() => { refreshCashFlow(); refreshCashDetail() }"
    >
      <template #default="{ state: ledgerView14 }">
        <BsRecordActionDialog
          :visible="true"
          :title="ledgerView14.t('financialMapping.allocate')"
          size="md"
          :dirty="ledgerView14.dirty"
          :pending="ledgerView14.pending"
          :error="ledgerView14.error"
          :submit-label="ledgerView14.t('common.save')"
          :cancel-label="ledgerView14.t('common.cancel')"
          :submit-disabled="!ledgerView14.valid || ledgerView14.loading"
          @update:visible="(value: boolean) => { if (!value) ledgerView14.emit('close') }"
          @submit="ledgerView14.save"
        >
          <BsText>{{ ledgerView14.accountName }}</BsText>
          <BsSectionSkeleton v-if="ledgerView14.loading" variant="table" :rows="3" />
          <template v-else-if="ledgerView14.context">
            <BsText>{{ ledgerView14.t('financialMapping.sourceAmount') }}: <BsMoneyText :amount="ledgerView14.context.amount_minor" :currency="ledgerView14.ledgerPresentation.currency()" :locale="ledgerView14.ledgerPresentation.locale" /></BsText>
            <BsBox v-if="ledgerView14.context.decision_id">
              <BsText>{{ ledgerView14.t('financialMapping.previousAllocation') }}</BsText>
              <BsText v-for="(value, section) in ledgerView14.context.allocations" :key="section">{{ ledgerView14.t(`financialMapping.lines.${section}`) }}: <BsMoneyText :amount="value" :currency="ledgerView14.ledgerPresentation.currency()" :locale="ledgerView14.ledgerPresentation.locale" /></BsText>
            </BsBox>
            <BsStack gap="md">
              <BsFloatingField v-for="key in (['operating', 'investing', 'financing'] as const)" :key="key" :label="ledgerView14.t(`financialMapping.lines.${key}`)">
                <BsInput v-model="ledgerView14.amounts[key]" type="text" inputmode="decimal" :disabled="ledgerView14.pending" />
              </BsFloatingField>
              <BsFloatingField :label="ledgerView14.t('statementClassification.reason')">
                <BsTextarea v-model="ledgerView14.reason" required maxlength="1000" :disabled="ledgerView14.pending" />
              </BsFloatingField>
              <BsText v-if="ledgerView14.total !== BigInt(ledgerView14.context.amount_minor)" role="alert" tone="danger">{{ ledgerView14.t('financialMapping.allocationMismatch') }}</BsText>
            </BsStack>
          </template>
        </BsRecordActionDialog>
      </template>
    </BsWorkflowScope>
    <BsWorkflowScope
      v-if="trialDrilldown"
      :factory="useLedgerAccountActivityDialogView"
      :input="{ accountId: (trialDrilldown.accountId), scope: (trialScope), initialFrom: (trialDrilldown.from), initialTo: (trialDrilldown.to) }"
      @close="trialDrilldown = null"
    >
      <template #default="{ state: ledgerView15 }">
        <BsDialog :visible="true" :title="ledgerView15.title" size="lg" @update:visible="(value: boolean) => { if (!value) ledgerView15.emit('close') }">
          <BsStack :ref="el => { ledgerView15.content = resolveTemplateElement(el) }" gap="md">
            <BsButton v-if="ledgerView15.views.length > 1" type="button" size="sm" @click="ledgerView15.back"><BsText as="span"><BsIcon name="arrowRight" directional :size="16" /></BsText>{{ ledgerView15.t('accountActivity.back') }}</BsButton>
            <BsHeading :ref="el => { ledgerView15.heading = resolveTemplateElement(el) }" tabindex="-1" :level="2" size="h3">{{ ledgerView15.activity?.account.name || ledgerView15.journal?.description || ledgerView15.title }}</BsHeading>
            <template v-if="ledgerView15.current.kind === 'account'">
              <BsInline v-if="ledgerView15.activity" gap="sm" :wrap="true">
                <BsBadge v-if="ledgerView15.activity.account.code">{{ ledgerView15.activity.account.code }}</BsBadge>
                <BsText as="span">{{ ledgerView15.t(`accounts.groups.${ledgerView15.activity.account.type}`) }}</BsText>
                <BsBadge v-if="ledgerView15.activity.account.is_archived">{{ ledgerView15.t('accounts.archived') }}</BsBadge>
                <BsText as="span">{{ ledgerView15.t('accountActivity.baseCurrency', { currency: ledgerView15.activity.currency }) }}</BsText>
              </BsInline>
              <BsForm layout="grid" :columns="2" @submit.prevent="ledgerView15.applyPeriod">
                <BsFloatingField :label="ledgerView15.t('reports.from')">
                  <BsInput id="activity-from" v-model="ledgerView15.current.from" type="date" required :disabled="ledgerView15.loading" />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView15.t('reports.to')">
                  <BsInput id="activity-to" v-model="ledgerView15.current.to" type="date" required :min="ledgerView15.current.from" :disabled="ledgerView15.loading" />
                </BsFloatingField>
                <BsButton type="submit" :disabled="ledgerView15.loading || ledgerView15.periodInvalid" variant="primary">{{ ledgerView15.t('accountActivity.apply') }}</BsButton>
              </BsForm>
            </template>
            <BsText v-if="ledgerView15.error" role="alert" tone="danger">{{ ledgerView15.error }} <BsButton type="button" size="sm" @click="ledgerView15.load(true)">{{ ledgerView15.t('accounts.retry') }}</BsButton></BsText>
            <BsSectionSkeleton v-if="ledgerView15.loading" variant="table" :rows="5" />
            <template v-else-if="!ledgerView15.error && ledgerView15.activity">
              <BsText size="sm" tone="muted">{{ ledgerView15.t('accountActivity.period', { from: formatDate(ledgerView15.activity.from_date, ledgerView15.locale), to: formatDate(ledgerView15.activity.to_date, ledgerView15.locale) }) }}</BsText>
              <BsGrid :columns="4" gap="md">
                <BsCard v-for="card in ledgerView15.cards" :key="card.key" :data-testid="`activity-${card.key}`" as="div" variant="flat" padding="sm">
                  <BsText size="xs" tone="muted">{{ ledgerView15.t(`accountActivity.${card.key}`) }}</BsText>
                  <BsText emphasis="bold">
                    <BsMoneyText
                      :amount="card.signed ? accountBalanceDisplay(card.amount).amount : card.amount"
                      :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.activity.currency)"
                      :locale="ledgerView15.ledgerPresentation.locale"
                    />
                  </BsText>
                  <BsText v-if="card.signed" size="xs" tone="muted">{{ ledgerView15.t(`accounts.sides.${accountBalanceDisplay(card.amount).side}`) }}</BsText>
                </BsCard>
              </BsGrid>
              <BsText v-if="!ledgerView15.activity.total" size="sm">{{ ledgerView15.t('accountActivity.empty') }}</BsText>
              <BsBox v-else>
                <BsDataTable
                  :label="ledgerView15.t('accountActivity.title')"
                  :value="ledgerView15.activity.rows"
                  row-key="entry_id"
                  :columns="[{ key: 'column1', header: ledgerView15.t('transactions.date') }, { key: 'column2', header: ledgerView15.t('transactions.description') }, { key: 'column3', header: ledgerView15.t('detail.debit'), align: 'end' as const }, { key: 'column4', header: ledgerView15.t('detail.credit'), align: 'end' as const }, { key: 'column5', header: ledgerView15.t('accountActivity.running'), align: 'end' as const }]"
                >
                  <template #cell-column1="{ row }">
                    <BsText as="span" wrap="nowrap">{{ formatDate(row.entry_date, ledgerView15.locale) }}</BsText>
                  </template>
                  <template #cell-column2="{ row }">
                    <BsButton
                      variant="link"
                      type="button"
                      :data-nav-id="`entry-${row.entry_id}`"
                      align="start"
                      @click="ledgerView15.openJournal(row.transaction_id, row.entry_id)"
                    >{{ row.description || ledgerView15.t('accountActivity.journal') }}</BsButton>
                    <BsText v-if="row.reference || row.memo" size="xs" tone="muted">{{ row.reference || row.memo }}</BsText>
                  </template>
                  <template #cell-column3="{ row }">
                    <BsMoneyText
                      :amount="row.debit_minor"
                      :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.activity.currency)"
                      :locale="ledgerView15.ledgerPresentation.locale"
                    />
                  </template>
                  <template #cell-column4="{ row }">
                    <BsMoneyText
                      :amount="row.credit_minor"
                      :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.activity.currency)"
                      :locale="ledgerView15.ledgerPresentation.locale"
                    />
                  </template>
                  <template #cell-column5="{ row }">
                    <BsMoneyText
                      :amount="accountBalanceDisplay(row.balance_minor).amount"
                      :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.activity.currency)"
                      :locale="ledgerView15.ledgerPresentation.locale"
                    />
                    <BsText as="span" size="xs" tone="muted">{{ ledgerView15.t(`accounts.sides.${accountBalanceDisplay(row.balance_minor).side}`) }}</BsText>
                  </template>
                </BsDataTable>
                <BsInline
                  v-if="ledgerView15.current.kind === 'account'"
                  :aria-label="ledgerView15.t('accountActivity.pages')"
                  as="nav"
                  gap="md"
                  :wrap="true"
                  justify="between"
                >
                  <BsButton
                    type="button"
                    :disabled="ledgerView15.current.offset === 0"
                    size="sm"
                    @click="ledgerView15.page(Math.max(0, ledgerView15.current.offset - ledgerView15.pageSize))"
                  >{{ ledgerView15.t('accounts.previousPage') }}</BsButton>
                  <BsText as="span">{{ ledgerView15.t('accountActivity.showing', { from: ledgerView15.current.offset + 1, to: Math.min(ledgerView15.current.offset + ledgerView15.pageSize, ledgerView15.activity.total), total: ledgerView15.activity.total }) }}</BsText>
                  <BsButton
                    type="button"
                    :disabled="ledgerView15.current.offset + ledgerView15.pageSize >= ledgerView15.activity.total"
                    size="sm"
                    @click="ledgerView15.page(ledgerView15.current.offset + ledgerView15.pageSize)"
                  >{{ ledgerView15.t('accounts.nextPage') }}</BsButton>
                </BsInline>
              </BsBox>
            </template>
            <template v-else-if="!ledgerView15.error && ledgerView15.journal">
              <BsInline gap="md" :wrap="true">
                <BsText as="span">{{ formatDate(ledgerView15.journal.date, ledgerView15.locale) }}</BsText>
                <BsText v-if="ledgerView15.journal.reference" as="span">{{ ledgerView15.journal.reference }}</BsText>
                <BsText as="span">{{ ledgerView15.t(`types.${ledgerView15.journal.type}`) }}</BsText>
                <BsBadge>{{ ledgerView15.t(`status.${ledgerView15.journal.status}`) }}</BsBadge>
              </BsInline>
              <BsText v-if="ledgerView15.journal.reverses_transaction_id || ledgerView15.journal.reversed_by_transaction_id" size="sm">{{ ledgerView15.t('accountActivity.reversal') }}</BsText>
              <BsText size="sm" tone="muted">{{ ledgerView15.t('accountActivity.journalHint', { currency: ledgerView15.journal.currency }) }}</BsText>
              <BsBox>
                <BsDataTable
                  :label="ledgerView15.t('accountActivity.journal')"
                  :value="ledgerView15.journal.rows"
                  row-key="entry_id"
                  :columns="[{ key: 'column1', header: ledgerView15.t('detail.account') }, { key: 'column2', header: ledgerView15.t('detail.debit'), align: 'end' as const }, { key: 'column3', header: ledgerView15.t('detail.credit'), align: 'end' as const }]"
                >
                  <template #cell-column1="{ row }">
                    <BsButton
                      variant="link"
                      type="button"
                      :data-nav-id="`account-${row.entry_id}`"
                      align="start"
                      @click="ledgerView15.openAccount(row.account_id, row.entry_id)"
                    >{{ row.account_name }}</BsButton>
                    <BsText size="xs" tone="muted">{{ row.account_code }}<BsText v-if="row.memo" as="span"> · {{ row.memo }}</BsText></BsText>
                    <BsText v-if="row.original_currency !== ledgerView15.journal.currency" size="xs" tone="muted">
                      <BsMoneyText
                        :amount="row.original_amount_minor"
                        :currency="ledgerView15.ledgerPresentation.currency(row.original_currency)"
                        :locale="ledgerView15.ledgerPresentation.locale"
                      />
                    </BsText>
                  </template>
                  <template #cell-column2="{ row }">
                    <BsMoneyText
                      :amount="row.debit_minor"
                      :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.journal.currency)"
                      :locale="ledgerView15.ledgerPresentation.locale"
                    />
                  </template>
                  <template #cell-column3="{ row }">
                    <BsMoneyText
                      :amount="row.credit_minor"
                      :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.journal.currency)"
                      :locale="ledgerView15.ledgerPresentation.locale"
                    />
                  </template>
                </BsDataTable>
              </BsBox>
              <BsInline gap="md" :wrap="true" justify="between" padding="lg" surface="muted" radius="control">
                <BsText as="span">{{ ledgerView15.t('accountActivity.balanced') }}</BsText>
                <BsText as="span">{{ ledgerView15.t('detail.debit') }}: <BsMoneyText :amount="ledgerView15.journal.debit_minor" :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.journal.currency)" :locale="ledgerView15.ledgerPresentation.locale" /></BsText>
                <BsText as="span">{{ ledgerView15.t('detail.credit') }}: <BsMoneyText :amount="ledgerView15.journal.credit_minor" :currency="ledgerView15.ledgerPresentation.currency(ledgerView15.journal.currency)" :locale="ledgerView15.ledgerPresentation.locale" /></BsText>
              </BsInline>
            </template>
          </BsStack>
        </BsDialog>
      </template>
    </BsWorkflowScope>
  </BsStack>
</template>

undefined
