import { parseCsv, serializeCsv } from './csv'

export type MigrationSectionState = 'complete' | 'warning' | 'blocked' | 'not_applicable'
export type MigrationSourceKind = 'account' | 'customer' | 'supplier' | 'other_counterparty'

export interface MigrationProjectSummary {
  id: string
  name: string
  source_type: 'excel_csv' | 'other_system_export' | 'accountant_paper_workbook'
  cutover_date: string
  migration_depth: 'fast_cutover' | 'current_fiscal_year' | 'full_history'
  status: 'draft' | 'source_uploaded' | 'mapping' | 'validated'
  revision: number
  current_source_revision_id: string | null
  current_mapping_revision_id: string | null
  current_staging_batch_id: string | null
  opening_balance_batch_id: string | null
  updated_at: string
}

export interface MigrationSourceRow {
  source_row: number
  source_sheet: string
  source_kind: MigrationSourceKind
  source_key: string
  source_name: string
  raw_payload: Record<string, string | number>
}

export interface MigrationCenterContext {
  project: MigrationProjectSummary
  sources: Array<Record<string, unknown> & { id: string, revision: number, filename: string, content_sha256: string, uploaded_at: string }>
  original_rows: Array<Record<string, unknown> & { source_row: number, raw_payload: Record<string, string> }>
  mapping_revisions: Array<Record<string, unknown> & { id: string, revision: number, review_note: string, reviewed_at: string }>
  mapping_entries: Array<Record<string, unknown>>
  normalized_rows: Array<Record<string, unknown> & { source_row: number, validation_errors: string[] }>
  opening_batch: null | Record<string, unknown> & { id: string, status: string, validation_result?: MigrationOpeningReview }
  opening_candidates: Array<Record<string, unknown> & { id: string, source_filename: string, status: string, cutoff_date: string }>
  open_item_batches: Array<Record<string, unknown> & { id: string, status: string, revision: number }>
  operational_batches: Array<Record<string, unknown> & MigrationOperationalBatch>
  approval: null | Record<string, unknown> & { id: string, approved_by: string, approved_at: string }
}

export interface MigrationOperationalBatch {
  id: string
  status: string
  revision: number
  open_items_applicable: boolean
  assets_applicable: boolean
  bank_applicable: boolean
  inventory_applicable: boolean
  tax_applicable: boolean
}

export interface MigrationOpeningReview {
  debit_total_minor: string | number
  credit_total_minor: string | number
  difference_minor: string | number
  currency: string
}

export interface MigrationCutoverReview {
  valid: boolean
  approved: boolean
  approval_id: string | null
  approved_by: string | null
  approved_at: string | null
  source_revision: number
  cutover_date: string
  migration_depth: string
  opening_transaction_id: string | null
  operational_batch_id: string
  modules: Record<string, { state: MigrationSectionState, total_minor?: string, debit_total_minor?: string, credit_total_minor?: string, difference_minor?: string, currency?: string }>
  variances: Array<{ module: string, account_id: string, detail_minor: string, gl_minor: string, variance_minor: string }>
  errors: string[]
  warnings: string[]
  history_policy: 'source_archive_unless_separately_migrated'
  correction_policy: 'reviewed_reversal_or_replacement_only'
  gl_effect: 'opening_trial_balance_only'
}

export interface MigrationProgressSection {
  key: 'source' | 'cutover' | 'accounts' | 'opening' | 'ar' | 'ap' | 'assets' | 'bank' | 'inventory' | 'tax' | 'reconciliation' | 'final_review'
  state: MigrationSectionState
}

const SOURCE_HEADERS = ['source_kind', 'source_key', 'source_name', 'source_sheet'] as const

export function migrationSourceTemplate(locale: string) {
  const names = locale.startsWith('ar')
    ? ['حساب النقدية', 'عميل نموذجي', 'مورد نموذجي']
    : ['Cash account', 'Example customer', 'Example supplier']
  return serializeCsv([
    [...SOURCE_HEADERS],
    ['account', '1000', names[0]!, locale.startsWith('ar') ? 'دليل الحسابات' : 'Chart of accounts'],
    ['customer', 'CUST-001', names[1]!, locale.startsWith('ar') ? 'العملاء' : 'Customers'],
    ['supplier', 'SUP-001', names[2]!, locale.startsWith('ar') ? 'الموردون' : 'Suppliers'],
  ])
}

export function migrationOpenItemsTemplate() {
  return serializeCsv([
    ['source_row', 'item_type', 'source_counterparty_key', 'source_document_key', 'source_reference', 'document_date', 'due_date', 'original_minor', 'open_minor', 'currency_code', 'control_account_id', 'correction_account_id'],
    ['2', 'customer_invoice', 'CUST-001', 'INV-001', 'INV-001', '2026-01-01', '2026-01-31', '100000', '100000', 'EGP', '', ''],
  ])
}

export function migrationOperationalTemplate() {
  return serializeCsv([
    ['section', 'source_row', 'source_key', 'account_id', 'cutover_date', 'amount_minor', 'evidence_reference'],
    ['asset', '', '', '', '', '', ''],
    ['bank', '', '', '', '', '', ''],
    ['inventory', '', '', '', '', '', ''],
    ['tax', '', '', '', '', '', ''],
  ])
}

export function parseMigrationSource(text: string): MigrationSourceRow[] {
  const parsed = parseCsv(text)
  for (const header of SOURCE_HEADERS.slice(0, 3)) {
    if (!parsed.headers.includes(header)) throw new Error('MIGRATION_TEMPLATE_HEADERS_INVALID')
  }
  return parsed.rows.map((raw, index) => {
    const sourceKind = raw.source_kind as MigrationSourceKind
    if (!['account', 'customer', 'supplier', 'other_counterparty'].includes(sourceKind)
      || !raw.source_key?.trim() || !raw.source_name?.trim()) throw new Error('MIGRATION_SOURCE_ROW_INVALID')
    return {
      source_row: index + 1,
      source_sheet: raw.source_sheet?.trim() || 'Migration Center',
      source_kind: sourceKind,
      source_key: raw.source_key.trim(),
      source_name: raw.source_name.trim(),
      raw_payload: { ...raw, source_row: index + 1 },
    }
  })
}

export async function sha256Hex(content: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', content as BufferSource)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export function bytesToPostgresHex(content: Uint8Array) {
  return `\\x${[...content].map(value => value.toString(16).padStart(2, '0')).join('')}`
}

export function migrationProgress(context: MigrationCenterContext, review: MigrationCutoverReview | null): MigrationProgressSection[] {
  const project = context.project
  const operational = context.operational_batches[0]
  const moduleState = (key: string, applicable = true): MigrationSectionState => {
    if (applicable === false) return 'not_applicable'
    return review?.modules[key]?.state ?? 'blocked'
  }
  return [
    { key: 'source', state: project.current_source_revision_id ? 'complete' : 'blocked' },
    { key: 'cutover', state: project.cutover_date && project.migration_depth ? 'complete' : 'blocked' },
    { key: 'accounts', state: project.current_mapping_revision_id ? 'complete' : 'blocked' },
    { key: 'opening', state: moduleState('opening_trial_balance') },
    { key: 'ar', state: moduleState('ar', operational?.open_items_applicable) },
    { key: 'ap', state: moduleState('ap', operational?.open_items_applicable) },
    { key: 'assets', state: moduleState('assets', operational?.assets_applicable) },
    { key: 'bank', state: moduleState('bank', operational?.bank_applicable) },
    { key: 'inventory', state: moduleState('inventory', operational?.inventory_applicable) },
    { key: 'tax', state: moduleState('tax', operational?.tax_applicable) },
    { key: 'reconciliation', state: review?.valid ? (review.variances.some(item => item.variance_minor !== '0') ? 'warning' : 'complete') : 'blocked' },
    { key: 'final_review', state: review?.approved ? 'complete' : review?.valid ? 'warning' : 'blocked' },
  ]
}
