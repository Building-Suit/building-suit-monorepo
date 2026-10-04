import type { ReceiptShareCopy, SaleReceiptSnapshot } from '~/types/receipt'

export function receiptLocale(locale: string) {
  return locale === 'ar' ? 'ar-EG' : 'en-EG'
}

export function formatReceiptMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(receiptLocale(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function formatReceiptDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(receiptLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(value))
}

export function buildReceiptShareText(
  receipt: SaleReceiptSnapshot,
  copy: ReceiptShareCopy,
  locale: string,
  paymentLabel: (method: SaleReceiptSnapshot['payments'][number]['method']) => string,
) {
  const money = (value: number) => formatReceiptMoney(value, receipt.currency, locale)
  const lines = [
    receipt.business.name,
    `${copy.invoice}: ${receipt.invoiceNumber}`,
    `${copy.date}: ${formatReceiptDate(receipt.issuedAt, locale)}`,
    `${copy.location}: ${receipt.location.name}`,
    `${copy.staff}: ${receipt.staffName ?? '—'}`,
    `${copy.customer}: ${receipt.customer.name ?? copy.walkIn}`,
    '',
    copy.items,
    ...receipt.lines.map(line => `${line.name} — ${copy.quantity} ${line.quantity} — ${money(line.total)}`),
    '',
    ...receipt.payments.map(payment => `${copy.payment}: ${paymentLabel(payment.method)} — ${money(payment.amount)}`),
    `${copy.total}: ${money(receipt.total)}`,
    '',
    receipt.footer ?? '',
    copy.compliance,
  ]
  return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n').trim()
}
