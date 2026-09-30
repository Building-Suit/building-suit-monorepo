import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildReceiptShareText } from '../../app/utils/receipt.ts'

const migration = await readFile(new URL('../../supabase/migrations/20260928233000_immutable_sale_receipts.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_sale_receipts.sql', import.meta.url), 'utf8')
const receiptPage = await readFile(new URL('../../app/pages/sales/[id]/receipt.vue', import.meta.url), 'utf8')
const salePage = await readFile(new URL('../../app/pages/sales/[id]/index.vue', import.meta.url), 'utf8')
const posPage = await readFile(new URL('../../app/pages/pos.vue', import.meta.url), 'utf8')
const settingsPage = await readFile(new URL('../../app/pages/settings.vue', import.meta.url), 'utf8')

const receipt = {
  version: 1,
  invoiceId: 'invoice-1',
  invoiceNumber: 'SALE-000123',
  issuedAt: '2026-09-28T12:30:00.000Z',
  currency: 'EGP',
  business: { name: 'Snapshot Barber', address: null, phone: null },
  location: { name: 'Downtown', code: 'DT', address: null, phone: null },
  staffName: 'Mona',
  customer: { name: null, phone: null },
  lines: [{ id: 'line-1', itemType: 'service', name: 'Haircut', sku: null, quantity: 1, unitPrice: 75, discount: 5, total: 70 }],
  payments: [{ id: 'payment-1', amount: 70, method: 'cash', reference: 'COUNTER-1', paidAt: '2026-09-28T12:30:00.000Z' }],
  subtotal: 75,
  discount: 5,
  total: 70,
  footer: 'Thank you',
  paperSize: 'thermal_80',
}

const englishCopy = {
  invoice: 'Sale number', date: 'Date and time', location: 'Location', staff: 'Staff',
  customer: 'Customer', items: 'Items and services', payment: 'Payment', total: 'Total paid',
  quantity: 'Qty', compliance: 'Proof of sale only — not an Egyptian tax invoice or ETA e-Receipt.',
  walkIn: 'Walk-in customer',
}
const arabicCopy = {
  invoice: 'رقم البيعة', date: 'التاريخ والوقت', location: 'الفرع', staff: 'الموظف',
  customer: 'العميل', items: 'المنتجات والخدمات', payment: 'الدفع', total: 'إجمالي المدفوع',
  quantity: 'الكمية', compliance: 'إثبات بيع فقط — ليس فاتورة ضريبية مصرية أو إيصالًا إلكترونيًا معتمدًا من مصلحة الضرائب.',
  walkIn: 'عميل مباشر',
}

test('English share receipt matches the complete proof-of-sale snapshot', () => {
  assert.equal(buildReceiptShareText(receipt, englishCopy, 'en', () => 'Cash'), [
    'Snapshot Barber',
    'Sale number: SALE-000123',
    'Date and time: Sep 28, 2026, 3:30 PM',
    'Location: Downtown',
    'Staff: Mona',
    'Customer: Walk-in customer',
    '',
    'Items and services',
    'Haircut — Qty 1 — EGP\u00a070.00',
    '',
    'Payment: Cash — EGP\u00a070.00',
    'Total paid: EGP\u00a070.00',
    '',
    'Thank you',
    'Proof of sale only — not an Egyptian tax invoice or ETA e-Receipt.',
  ].join('\n'))
})

test('Arabic share receipt snapshot preserves Arabic numbers and customer-facing RTL copy', () => {
  assert.equal(buildReceiptShareText(receipt, arabicCopy, 'ar', () => 'نقدي'), [
    'Snapshot Barber',
    'رقم البيعة: SALE-000123',
    'التاريخ والوقت: ٢٨\u200f/٠٩\u200f/٢٠٢٦، ٣:٣٠ م',
    'الفرع: Downtown',
    'الموظف: Mona',
    'العميل: عميل مباشر',
    '',
    'المنتجات والخدمات',
    'Haircut — الكمية 1 — \u200f٧٠٫٠٠\u00a0ج.م.\u200f',
    '',
    'الدفع: نقدي — \u200f٧٠٫٠٠\u00a0ج.م.\u200f',
    'إجمالي المدفوع: \u200f٧٠٫٠٠\u00a0ج.م.\u200f',
    '',
    'Thank you',
    'إثبات بيع فقط — ليس فاتورة ضريبية مصرية أو إيصالًا إلكترونيًا معتمدًا من مصلحة الضرائب.',
  ].join('\n'))
})

test('receipt storage is immutable, tenant-scoped, and captures only fully-paid issued sales', () => {
  for (const evidence of [
    'create table public.sale_receipts',
    'shop_private\\.invoice_outstanding\\(v_invoice\\.id\\) <> 0',
    'trg_capture_paid_sale_receipt',
    'trg_capture_sale_receipt_at_issue',
    'SALE_RECEIPT_IMMUTABLE',
    'get_location_sale_receipt',
    'shop_private\\.assert_location_access',
    "copy\\('compliance'\\)",
  ]) assert.match(`${migration}\n${receiptPage}`, new RegExp(evidence))
  for (const evidence of [
    'settings or location change rewrote issued receipt snapshot',
    'settings changed after issue rewrote the finalized document',
    'issued receipt snapshot was mutable',
    'receipt internals are directly browser-accessible',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('thermal/A4 print and share actions are connected from POS completion and sale detail', () => {
  assert.match(receiptPage, /@page receipt-thermal \{ size: 80mm auto/)
  assert.match(receiptPage, /@page receipt-a4 \{ size: A4/)
  assert.match(receiptPage, /dir="receiptLanguage === 'ar' \? 'rtl' : 'ltr'"/)
  assert.match(receiptPage, /window\.print\(\)/)
  assert.match(receiptPage, /shareReceipt/)
  assert.match(receiptPage, /reprintLabel/)
  assert.match(posPage, /sales\/\$\{completedId\}\/receipt/)
  assert.match(salePage, /receipt\.reprint/)
  assert.match(salePage, /receipt\.share/)
  assert.match(settingsPage, /save_receipt_settings/)
  assert.match(settingsPage, /future receipt presentation/)
})
