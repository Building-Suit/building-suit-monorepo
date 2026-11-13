import type { ReceiptShareCopy, SaleReceiptSnapshot } from '~/types/receipt'

export function receiptLocale(locale: string) {
  return locale === 'ar' ? 'ar-EG' : 'en-EG'
}

export function formatReceiptMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(receiptLocale(locale), {
    style: 'currency',
    currency,
    // Render the issued amount without rounding it to a different currency's
    // precision. Intl still supplies the ISO currency's minimum fraction digits.
    maximumFractionDigits: 20,
  }).format(Number(value))
}

export function formatReceiptDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(receiptLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Cairo',
  }).format(new Date(value))
}

/** Thermal document ordering follows the reference: date then time stays one
 * LTR group, while Arabic's localized day period retains its RTL position. */
export function formatReceiptDocumentDate(value: string, locale: string) {
  const parts = new Intl.DateTimeFormat(receiptLocale(locale), {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit',
    hour12: true, numberingSystem: 'latn', calendar: 'gregory', timeZone: 'Africa/Cairo',
  }).formatToParts(new Date(value))
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === name)?.value ?? ''
  const dateTime = `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`
  return locale === 'ar' ? `\u2066${dateTime}\u2069 ${part('dayPeriod')}` : `${dateTime} ${part('dayPeriod')}`
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
    ...(receipt.presentation?.documentLabel ? [receipt.presentation.documentLabel] : []),
    `${receipt.presentation?.referenceLabel || copy.invoice}: ${receipt.invoiceNumber}`,
    `${copy.date}: ${formatReceiptDate(receipt.issuedAt, locale)}`,
    `${copy.location}: ${receipt.location.name}`,
    `${copy.staff}: ${receipt.staffName ?? '—'}`,
    `${copy.customer}: ${receipt.customer.name ?? copy.walkIn}`,
    '',
    copy.items,
    ...receipt.lines.map(line => `${line.name}${(line.measurement?.reelAllocations ?? []).map(piece => ` [${piece.barcode}: ${piece.soldQuantity} ${line.measurement?.baseUnitCode}]`).join('')}${receipt.presentation?.showDescriptions !== false && line.description ? ` (${line.description})` : ''} — ${copy.quantity} ${line.measurement ? `${line.measurement.enteredQuantity} ${line.measurement.packageName || (locale === 'ar' ? line.measurement.unitNameAr : line.measurement.unitNameEn)}` : line.quantity} — ${money(line.total)}`),
    '',
    ...(receipt.offers ?? []).map(offer => `${offer.name} × ${offer.quantity} — −${money(offer.saving)}`),
    ...receipt.payments.map(payment => `${copy.payment}: ${paymentLabel(payment.method)} — ${money(payment.amount)}`),
    ...(receipt.tax?.calculationEnabled ? [`${locale === 'ar' ? 'الضريبة' : 'Tax'}: ${money(receipt.tax.tax)}`] : []),
    `${copy.total}: ${money(receipt.total)}`,
    '',
    receipt.presentation?.notes ?? '',
    receipt.footer ?? '',
    copy.compliance,
  ]
  return lines.filter((line, index) => line !== '' || lines[index - 1] !== '').join('\n').trim()
}
