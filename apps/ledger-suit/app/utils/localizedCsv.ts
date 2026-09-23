import { parseCsv, serializeCsv } from './csv.ts'

export const CSV_REQUIRED_FIELDS = ['type', 'date', 'amount', 'account', 'category'] as const
export const CSV_OPTIONAL_FIELDS = ['description', 'reference', 'counterparty', 'currency', 'exchange_rate'] as const
export const CSV_IMPORT_FIELDS = [...CSV_REQUIRED_FIELDS, ...CSV_OPTIONAL_FIELDS]
type Translate = (key: string) => string
export type CsvReport = 'profit_loss' | 'balance_sheet' | 'trial_balance' | 'cash_flow' | 'general_ledger'
const normalHeader = (value: string) => value.trim().replace(/\s*\*$/, '').toLocaleLowerCase()

export function matchCsvColumns(headers: readonly string[], translations: readonly Translate[]): Record<string, string> {
  return Object.fromEntries(CSV_IMPORT_FIELDS.map(field => {
    const aliases = [field, ...translations.flatMap(t => [t(`csv.columns.${field}`), t(`imports.fields.${field}`)])].map(normalHeader)
    const matches = headers.filter(header => aliases.includes(normalHeader(header)))
    // Ambiguous duplicate aliases require a deliberate choice in the mapping screen.
    return [field, matches.length === 1 ? matches[0]! : '']
  }))
}

export function csvImportType(value: string, translations: readonly Translate[]): string {
  const normalized = value.trim().toLocaleLowerCase()
  for (const type of ['income', 'expense']) {
    if ([type, ...translations.map(t => t(`types.${type}`))].some(alias => alias.toLocaleLowerCase() === normalized)) return type
  }
  return value
}

export function normalizeCsvNumber(value: string): string {
  const digits = value.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
  // Accept correctly grouped Arabic numbers without guessing a comma's decimal meaning.
  return (/^\d{1,3}(?:٬\d{3})+(?:[٫.]\d+)?$/.test(digits) ? digits.replaceAll('٬', '') : digits).replaceAll('٫', '.')
}

export function prepareCsvImport(rows: readonly Record<string, string>[], mapping: Record<string, string>, translations: readonly Translate[]) {
  const prepared = rows.map(row => ({ ...row }))
  const selectedMapping = Object.fromEntries(CSV_IMPORT_FIELDS.filter(field => mapping[field]).map(field => [field, mapping[field]!]))
  const used = new Set(rows.flatMap(row => Object.keys(row)))
  for (const field of ['type', 'date', 'amount', 'exchange_rate']) {
    const source = mapping[field]
    if (!source) continue
    const values = rows.map(row => field === 'type' ? csvImportType(row[source] ?? '', translations) : normalizeCsvNumber(row[source] ?? ''))
    if (values.every((value, index) => value === rows[index]![source])) continue
    let key = `__ledger_normalized_${field}`
    while (used.has(key)) key += '_'
    used.add(key)
    prepared.forEach((row, index) => { row[key] = values[index]! })
    selectedMapping[field] = key
  }
  // Preserve original source cells for review/audit; map only derived values to the existing validator.
  return { rows: prepared, mapping: selectedMapping }
}

export function csvImportTemplate(t: Translate, currency: string, date: string): string {
  return serializeCsv([
    CSV_IMPORT_FIELDS.map(field => t(`csv.columns.${field}`)),
    ...['income', 'expense'].map((type, index) => [
      t(`types.${type}`), date, index ? '25.00' : '100.00', t('csv.example.account'),
      t(`csv.example.${type}Category`), t(`csv.example.${type}Description`), '', '', currency, '1',
    ]),
  ])
}

const reportColumns: Record<CsvReport, readonly string[]> = {
  profit_loss: ['section', 'code', 'account', 'amount', 'currency'],
  balance_sheet: ['report_date', 'presentation', 'account_id', 'code', 'account', 'amount', 'currency', 'classification_effective_from', 'classification_id'],
  trial_balance: ['code', 'account', 'type', 'opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit', 'currency'],
  cash_flow: ['activity', 'net_movement', 'currency'],
  general_ledger: ['date', 'reference', 'description', 'memo', 'debit', 'credit', 'running_balance', 'currency'],
}

export function localizeReportCsv(csv: string, report: CsvReport, t: Translate): string {
  const parsed = parseCsv(csv, { allowEmpty: true })
  const columns = reportColumns[report]
  // Classified balance-sheet headers/labels already follow p_locale; the column contract is stable.
  if (parsed.headers.length !== columns.length || (report !== 'balance_sheet' && parsed.headers.some((header, i) => header !== columns[i]))) throw new Error('CSV_REPORT_COLUMNS_INVALID')
  return serializeCsv([
    columns.map(column => t(`csv.columns.${report === 'trial_balance' && column === 'type' ? 'account_type' : column}`)),
    ...parsed.rows.map(row => columns.map((column, index) => {
      const value = row[parsed.headers[index]!] ?? ''
      if (report === 'trial_balance' && column === 'type' && ['asset', 'liability', 'equity', 'revenue', 'expense'].includes(value)) return t(`accounts.groups.${value}`)
      if (report === 'trial_balance' && column === 'account' && value === 'Total' && !row.code) return t('reports.total')
      if (report === 'profit_loss' && column === 'section') {
        const section = { revenue: 'revenue', cost_of_sales: 'costOfSales', operating_expenses: 'operatingExpenses' }[value]
        if (section) return t(`reports.${section}`)
      }
      if (report === 'cash_flow' && column === 'activity' && ['operating', 'investing', 'financing', 'none'].includes(value)) return t(`reports.cashFlowSections.${value}`)
      return value
    })),
  ])
}
