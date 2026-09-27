import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPrintableReportHtml, buildReportXlsx } from '../../app/utils/reportFormats.ts'

const metadata = {
  title: 'Trial Balance ميزان المراجعة',
  organization: 'Alpha شركة ألفا',
  currency: 'EGP',
  generatedAt: '27 Sep 2026, 12:30',
  direction: 'rtl',
  labels: { organization: 'المنشأة', currency: 'العملة', generatedAt: 'وقت الإنشاء', warning: 'تحذير التعيين' },
  filters: [
    { label: 'الفترة', value: '01 Jan 2026 – 31 Dec 2026' },
    { label: 'القيود', value: 'القيود المُرحّلة فقط' },
  ],
  warning: 'توجد حسابات غير معيّنة.',
}

function zipFiles(bytes) {
  const decoder = new TextDecoder()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const files = new Map()
  let offset = 0
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength))
    files.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + size)))
    offset = dataStart + size
  }
  return files
}

test('Excel workbook contains localized identity, filters, warnings and exact numeric cells', () => {
  const csv = [
    'الرمز,الحساب,نوع الحساب,مدين أول المدة,دائن أول المدة,مدين الفترة,دائن الفترة,مدين آخر المدة,دائن آخر المدة,العملة',
    "'=1+1,نقدية,أصل,9007199254740993.25,0.00,100.00,12.50,9007199254741080.75,0.00,EGP",
  ].join('\n')
  const files = zipFiles(buildReportXlsx(csv, 'trial_balance', metadata))
  assert.ok(files.has('[Content_Types].xml'))
  const sheet = files.get('xl/worksheets/sheet1.xml')
  assert.match(sheet, /rightToLeft="1"/)
  assert.match(sheet, /Alpha شركة ألفا/)
  assert.match(sheet, /القيود المُرحّلة فقط/)
  assert.match(sheet, /توجد حسابات غير معيّنة/)
  assert.match(sheet, /<c r="D10" s="4"><v>9007199254740993\.25<\/v><\/c>/)
  assert.match(sheet, /<t xml:space="preserve">&apos;=1\+1<\/t>/)
})

test('print/PDF document is RTL-readable and preserves report metadata and exact values', () => {
  const csv = 'الحساب,المبلغ\nإيراد & خدمات,9007199254740993.25'
  const output = buildPrintableReportHtml(csv, 'profit_loss', metadata)
  assert.match(output, /<html lang="ar" dir="rtl">/)
  assert.match(output, /Alpha شركة ألفا/)
  assert.match(output, /إيراد &amp; خدمات/)
  assert.match(output, />9007199254740993\.25<\/td>/)
  assert.match(output, /@page\{size:landscape/)
  const english = buildPrintableReportHtml('Account,Amount\nServices,123.45', 'profit_loss', {
    ...metadata, title: 'Profit & Loss', direction: 'ltr', warning: undefined,
  })
  assert.match(english, /<html lang="en" dir="ltr">/)
})

test('all five report contracts write authoritative money columns as workbook numbers', () => {
  const cases = {
    profit_loss: 'section,code,account,amount,currency\nrevenue,4000,Sales,123.45,EGP',
    balance_sheet: 'date,presentation,id,code,account,amount,currency,effective,classification\n2026-09-27,current,id,1000,Cash,123.45,EGP,2026-01-01,c1',
    trial_balance: 'code,account,type,opening_debit,opening_credit,period_debit,period_credit,closing_debit,closing_credit,currency\n1000,Cash,asset,123.45,0.00,0.00,0.00,123.45,0.00,EGP',
    cash_flow: 'line,id,account,amount,currency\noperating,id,Cash,123.45,EGP',
    general_ledger: 'date,reference,description,memo,debit,credit,running_balance,currency\n2026-09-27,REF,Entry,,123.45,0.00,123.45,EGP',
  }
  for (const [report, csv] of Object.entries(cases)) {
    const sheet = zipFiles(buildReportXlsx(csv, report, metadata)).get('xl/worksheets/sheet1.xml')
    assert.match(sheet, /<c r="[A-Z]+10" s="4"><v>123\.45<\/v><\/c>/, report)
  }
})

test('a 20,000-row tenant-scoped report remains practical without numeric coercion', () => {
  const rows = Array.from({ length: 20_000 }, (_, index) => `${index + 1},Account ${index + 1},asset,0.00,0.00,1.25,1.25,1.25,1.25,EGP`)
  const csv = ['code,account,type,opening_debit,opening_credit,period_debit,period_credit,closing_debit,closing_credit,currency', ...rows].join('\n')
  const started = performance.now()
  const workbook = buildReportXlsx(csv, 'trial_balance', metadata)
  const elapsed = performance.now() - started
  assert.ok(workbook.byteLength > 5_000_000)
  assert.ok(elapsed < 10_000, `20,000-row workbook took ${elapsed.toFixed(0)}ms`)
})
