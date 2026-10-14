/** Financial report display contracts contain formatted values and opaque record identities only. */
export type BsFinancialReportTab = 'overview' | 'profit-loss' | 'balance-sheet' | 'cash-flow' | 'ledger'
export interface BsFinancialReportFilters { tab: BsFinancialReportTab; from: string; to: string; asOf: string; account: string; density: 'compact' | 'comfortable' }
export interface BsFinancialReportCopy {
 title: string; subtitle: string; context: string; from: string; to: string; asOf: string; account: string; density: string; compact: string; comfortable: string; retry: string; failed: string; empty: string; emptyHint: string; total: string; csv: string; excel: string; print: string; allocate: string; reconciliation: string; trialBalance: string; scroll: string
}
export interface BsFinancialReportCell { value: string; action?: { account: string; period: 'range' | 'asof' | 'opening' | 'period' | 'closing' }; label?: string }
export interface BsFinancialReportRow { id: string; name: string; code: string; cells: BsFinancialReportCell[]; allocationId?: string }
export interface BsFinancialReportColumn { key: string; label: string; total: string }
export interface BsFinancialReportSection { id: string; title: string; total: string; rows: BsFinancialReportRow[] }
export interface BsFinancialReportsView {
 context: { label: string; value: string }[]; tabs: { value: BsFinancialReportTab; label: string }[]; accounts: { value: string; label: string }[]; preferenceReady: boolean; canExport: boolean; canAllocate: boolean; exporting: boolean; exportError: string; invalidPeriod: string; loading: boolean; failed: boolean; errorLabel: string; emptyHint: string; warnings: string[]; metrics: { id: string; label: string; value: string; hint: string; tone: 'neutral' | 'success' | 'danger' | 'warning' }[]; columns: BsFinancialReportColumn[]; sections: BsFinancialReportSection[]; totals: { label: string; value: string }[]; equation: string; equationTone: 'muted' | 'danger'; reconciliation: BsFinancialReportRow[]; reconciliationColumns: BsFinancialReportColumn[]; diagnostic: string; cashSummary: { label: string; value: string }[]; adjustments: BsFinancialReportRow[]; adjustmentTitle: string; cashSourceTitle: string; balanceLabel: string; balanced: boolean; empty: boolean
}
