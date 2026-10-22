import type { BsReceiptView, BsReceiptDocumentCopy } from '@building-suit/ui/types/receiptPresentation'
import type { SaleReceiptSnapshot } from '../types/receipt'
import { formatReceiptDocumentDate, formatReceiptMoney } from './receipt.ts'

export function projectReceipt(receipt: SaleReceiptSnapshot, language: string, translate: (key: string) => string): { view: BsReceiptView; copy: BsReceiptDocumentCopy } {
  const label = (key: string) => translate(`receipt.${key}`)
  const money = (value: number) => formatReceiptMoney(value, receipt.currency, language)
  const otherDiscount = Math.max(0, sumReceiptAmounts([receipt.discount, ...((receipt.offers ?? []).map(offer => -offer.saving))]))
  const paid = sumReceiptAmounts(receipt.payments.map(payment => payment.amount))
  // Receipt snapshots are issued when fully paid. Still display actual allocations
  // rather than claiming the invoice total was paid if a legacy payload differs.
  const balance = Math.max(0, sumReceiptAmounts([receipt.total, -paid]))
  return {
    view: {
      logoDataUrl: receipt.presentation?.logoDataUrl, notes: receipt.presentation?.notes,
      direction: receipt.presentation?.direction === 'auto' ? undefined : receipt.presentation?.direction,
      issuer: receipt.business.name, issuerDetails: [receipt.business.address, receipt.business.phone].filter((item): item is string => Boolean(item)),
      invoice: receipt.invoiceNumber, issued: formatReceiptDocumentDate(receipt.issuedAt, language), location: { ...receipt.location, address: receipt.location.address ?? receipt.business.address, phone: receipt.location.phone ?? receipt.business.phone },
      staff: receipt.staffName || '—', customer: receipt.customer.name || label('walkIn'),
      lines: receipt.lines.map(line => ({ id: line.id, label: line.name, description: receipt.presentation?.showDescriptions === false ? undefined : line.description || line.sku || undefined, quantity: line.measurement ? `${line.measurement.enteredQuantity} ${line.measurement.packageName || (language === 'ar' ? line.measurement.unitNameAr : line.measurement.unitNameEn)}` : String(Number(line.quantity)), unitPrice: money(Number(line.measurement?.enteredUnitPrice ?? line.unitPrice)), total: money(line.total) })),
      totals: [
        { id: 'subtotal', label: label('subtotal'), value: money(receipt.subtotal) },
        ...(receipt.offers ?? []).map(offer => ({ id: `offer-${offer.id}`, label: `${offer.name} × ${offer.quantity}`, value: `− ${money(offer.saving)}` })),
        ...(otherDiscount ? [{ id: 'discount', label: label('discount'), value: '− ' + money(otherDiscount) }] : []),
        ...(receipt.tax?.calculationEnabled ? [{ id: 'tax', label: label('tax'), value: money(receipt.tax.tax) }] : []),
        ...(paid !== receipt.total ? [{ id: 'invoice-total', label: label('saleTotal'), value: money(receipt.total) }] : []),
        ...(balance ? [{ id: 'balance', label: label('balance'), value: money(balance) }] : []),
        { id: 'total', label: label('total'), value: money(paid), emphasis: true },
      ],
      payments: receipt.payments.map(payment => ({ id: payment.id, summary: `${translate(`payments.methods.${payment.method}`)} · ${money(payment.amount)}`, reference: payment.reference })),
      footer: receipt.footer,
    },
    copy: projectReceiptCopy(receipt.presentation, translate),
  }
}

export function projectReceiptCopy(presentation: SaleReceiptSnapshot['presentation'], translate: (key: string) => string): BsReceiptDocumentCopy {
  const label = (key: string) => translate(`receipt.${key}`)
  return {
      title: presentation?.documentLabel || label('title'), reprintLabel: label('reprintLabel'),
      invoice: presentation?.referenceLabel || label('invoice'), date: label('date'), location: label('location'),
      address: label('address'), phone: label('phone'), staff: label('staff'), customer: label('customer'),
      items: label('items'), item: label('item'), quantity: label('quantity'), unitPrice: label('unitPrice'), lineTotal: label('lineTotal'),
      total: label('total'), payment: label('payment'), reference: label('reference'), thankYou: label('thankYou'), greeting: label('greeting'), issuedVia: label('issuedVia'), compliance: label('compliance'),
    }
}

// Sum issued decimal allocations without introducing binary floating point tails.
export function sumReceiptAmounts(values: number[]): number {
  const parts = values.map(value => {
    const [coefficient = '0', exponent = '0'] = String(value).toLowerCase().split('e')
    const [whole = '0', fraction = ''] = coefficient.split('.')
    return { integer: BigInt(whole + fraction), scale: fraction.length - Number(exponent) }
  })
  const scale = Math.max(0, ...parts.map(part => part.scale))
  const total = parts.reduce((sum, part) => sum + part.integer * 10n ** BigInt(scale - part.scale), 0n)
  return Number(total) / 10 ** scale
}
