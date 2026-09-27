import { parseCsv, serializeCsv } from './csv.ts'
import { normalizeCsvNumber } from './localizedCsv.ts'
import { minorUnitFor, parseMoneyToMinor } from './money.ts'

export type BankLineStatus = 'matched' | 'unmatched' | 'unresolved'
export interface BankAccount { id: string, name: string, type: string, subtype: string, currency: string, role: string }
export interface BankReconciliationSummary { id: string, bank_account_id: string, currency_code: string, statement_start: string, statement_end: string, opening_balance_minor: string, closing_balance_minor: string, file_name: string, status: 'review' | 'completed' | 'reopened', import_errors: { code: string }[], completed_at: string | null }
export interface BankStatementLine { id: string, source_row: number, date: string | null, amount_minor: string | null, description: string, external_reference: string | null, status: BankLineStatus, validation_error: string | null, duplicate_of_line_id: string | null }
export interface BankCandidate { id: string, date: string, description: string, reference: string | null, effect_minor: string, type: string }
export interface BankMatch { id: string, active: boolean, statement_total_minor: string, ledger_total_minor: string, matched_at: string, unmatched_at: string | null, unmatch_reason: string | null, line_ids: string[], transaction_ids: string[] }
export interface BankOutstanding { id: string, transaction_id: string, bank_effect_minor: string, reason: string, active: boolean, created_at: string, removal_reason: string | null }
export interface BankEvent { id: number, event_type: string, statement_line_id: string | null, match_group_id: string | null, transaction_id: string | null, reason: string | null, before_data: unknown, after_data: unknown, occurred_at: string }
export interface BankWorkspace { accounts: BankAccount[], reconciliations: BankReconciliationSummary[], selected_id: string | null, lines: BankStatementLine[], candidates: BankCandidate[], matches: BankMatch[], outstanding: BankOutstanding[], events: BankEvent[], equation: { statement_minor: string, outstanding_minor: string, ledger_minor: string, difference_minor: string } | null }

const normalizeHeader = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, '')
export function parseBankStatementCsv(text: string, currency: string, labels: Record<string, string>) {
  const parsed = parseCsv(text)
  const aliases: Record<string, string[]> = {
    date: ['date', labels.date ?? 'date'], amount: ['amount', labels.amount ?? 'amount'], description: ['description', labels.description ?? 'description'],
    reference: ['reference', 'externalreference', labels.reference ?? 'reference'],
  }
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key,
    parsed.headers.find(header => names.filter(Boolean).map(normalizeHeader).includes(normalizeHeader(header)))]))
  if (!columns.date || !columns.amount || !columns.description) throw new Error('BANK_CSV_COLUMNS_INVALID')
  return parsed.rows.map(row => {
    let amount_minor: string
    try { amount_minor = parseMoneyToMinor(normalizeCsvNumber(row[columns.amount!] ?? ''), currency).toString() }
    catch { amount_minor = row[columns.amount!] ?? '' }
    return { date: row[columns.date!] ?? '', amount_minor, description: row[columns.description!] ?? '', external_reference: columns.reference ? row[columns.reference] ?? '' : '' }
  })
}

export function bankStatementTemplate(labels: Record<string, string>) {
  return serializeCsv([[labels.date ?? 'date', labels.amount ?? 'amount', labels.description ?? 'description', labels.reference ?? 'reference'], ['2026-09-01', '1250.00', labels.example ?? 'Customer receipt', 'BANK-001']])
}

export function selectedMinorTotal(ids: ReadonlySet<string>, rows: { id: string, amount_minor?: string | null, effect_minor?: string }[]) {
  return rows.filter(row => ids.has(row.id)).reduce((sum, row) => sum + BigInt(row.amount_minor ?? row.effect_minor ?? 0), 0n).toString()
}

export function minorToDecimalInput(value: string, currency: string) {
  const minor = BigInt(value)
  const exponent = minorUnitFor(currency)
  if (!exponent) return minor.toString()
  const negative = minor < 0n ? '-' : ''
  const digits = (minor < 0n ? -minor : minor).toString().padStart(exponent + 1, '0')
  return `${negative}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`
}
