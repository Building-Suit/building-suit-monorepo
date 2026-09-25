import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseCsv, serializeCsv } from '../../app/utils/csv.ts'
import { CSV_IMPORT_FIELDS, csvImportTemplate, matchCsvColumns, prepareCsvImport, localizeReportCsv, normalizeCsvNumber } from '../../app/utils/localizedCsv.ts'
const messages = Object.fromEntries(['en', 'ar'].map(locale => [locale, JSON.parse(readFileSync(new URL(`../../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))]))
const translate = locale => key => key.split('.').reduce((value, part) => value?.[part], messages[locale]) ?? key
const translations = [translate('en'), translate('ar')]

test('both localized templates parse and automatically map every required and optional column', () => {
  for (const locale of ['en', 'ar']) {
    const csv = parseCsv('\uFEFF' + csvImportTemplate(translate(locale), 'EGP', '2026-09-19'))
    const mapping = matchCsvColumns(csv.headers, translations)
    assert.equal(csv.rows.length, 2)
    assert.ok(CSV_IMPORT_FIELDS.every(field => mapping[field]))
    const prepared = prepareCsvImport(csv.rows, mapping, translations)
    assert.deepEqual(prepared.rows.map(row => row[prepared.mapping.type]), ['income', 'expense'])
    assert.equal(prepared.rows[0][mapping.description], translate(locale)('csv.example.incomeDescription'))
    assert.equal(mapping.account, translate(locale)('csv.columns.account'))
  }
})
test('localized values retain exact source cells and safe integers without overwriting colliding columns', () => {
  const row = { النوع: translate('ar')('types.income'), المبلغ: '٩٠٠٧١٩٩٢٥٤٧٤٠٩٩٣٫٢٥', تاريخ: '٢٠٢٦-٠٩-١٩', __ledger_normalized_type: 'keep me' }
  const result = prepareCsvImport([row], { type: 'النوع', amount: 'المبلغ', date: 'تاريخ' }, translations)
  assert.equal(result.rows[0][result.mapping.type], 'income')
  assert.equal(result.rows[0][result.mapping.amount], '9007199254740993.25')
  assert.equal(result.rows[0][result.mapping.date], '2026-09-19')
  for (const [key, value] of Object.entries(row)) assert.equal(result.rows[0][key], value)
  assert.equal(normalizeCsvNumber('١٬٢٣٤٫٥٠'), '1234.50')
  assert.equal(normalizeCsvNumber('۱۲۳٫۴۵'), '123.45')
  assert.equal(normalizeCsvNumber('١٬٢٫٥'), '1٬2.5') // invalid grouping is not silently repaired
  assert.equal(normalizeCsvNumber('1,23'), '1,23')
})
test('ambiguous bilingual headers require mapping; legacy machine headers still work', () => {
  assert.equal(matchCsvColumns(['type', 'نوع المعاملة'], translations).type, '')
  assert.equal(matchCsvColumns(['type', 'date', 'amount', 'account', 'category'], translations).account, 'account')
})
test('report localization preserves quoted names, formula protection and exact six-column amounts', () => {
  const input = serializeCsv([
    ['code', 'account', 'type', 'opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit', 'currency'],
    ["'=1+1", 'اسم, "مركب"\nسطر', 'asset', '9007199254740993.25', '0.00', '100.00', '12.50', '9007199254741080.75', '0.00', 'EGP'],
  ])
  for (const locale of ['en', 'ar']) {
    const t = translate(locale)
    const output = parseCsv(localizeReportCsv(input, 'trial_balance', t))
    assert.equal(output.headers[2], t('csv.columns.account_type'))
    const values = Object.values(output.rows[0])
    assert.deepEqual(values, ["'=1+1", 'اسم, "مركب"\nسطر', t('accounts.groups.asset'), '9007199254740993.25', '0.00', '100.00', '12.50', '9007199254741080.75', '0.00', 'EGP'])
  }
})
test('trial balance export localizes its totals row from the same column contract', () => {
  const input = 'code,account,type,opening_debit,opening_credit,period_debit,period_credit,closing_debit,closing_credit,currency\n,Total,,1.00,1.00,2.00,2.00,3.00,3.00,EGP'
  for (const locale of ['en', 'ar']) {
    const output = parseCsv(localizeReportCsv(input, 'trial_balance', translate(locale)))
    assert.equal(output.rows[0][translate(locale)('csv.columns.account')], translate(locale)('reports.total'))
  }
})
test('empty reports export localized headers; all report labels and audit columns remain present', () => {
  const t = translate('ar')
  const cases = [
    ['profit_loss', 'section,code,account,amount,currency\noperating_expenses,10,أتعاب,100.00,EGP', 'مصروفات التشغيل'],
    ['cash_flow', 'line,account_id,account,amount,currency\noperating_cash,,,100.00,EGP', t('financialMapping.cashLines.operating_cash')],
    ['general_ledger', 'date,reference,description,memo,debit,credit,running_balance,currency', t('csv.columns.running_balance')],
    ['balance_sheet', 'report_date,presentation,account_id,code,account,amount,currency,classification_effective_from,classification_id\n2026-09-19,أصول,id,100,اسم,10.00,EGP,2026-09-01,revision', t('csv.columns.classification_id')],
  ]
  for (const [report, input, expected] of cases) assert.ok(localizeReportCsv(input, report, t).includes(expected))
  assert.throws(() => localizeReportCsv('account,amount', 'trial_balance', t), /CSV_REPORT_COLUMNS_INVALID/)
  assert.throws(() => parseCsv('type,date,amount'), /CSV_NO_DATA/)
})
