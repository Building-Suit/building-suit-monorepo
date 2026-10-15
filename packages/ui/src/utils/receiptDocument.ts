import { receiptDocumentStyles } from '../styles/receiptDocument.ts'
import type { BsReceiptView, BsReceiptDocumentCopy } from '../types/receiptPresentation'

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const text = (value: string) => `<bdi>${escape(value)}</bdi>`
// Monochrome document glyphs; independent of application theme and icon fonts.
const paths: Record<string, string> = {
  invoice: '<path d="M6 2h9l4 4v16H6z M14 2v5h5 M9 11h7 M9 15h7 M9 19h5"/>',
  date: '<rect x="3" y="5" width="18" height="17" rx="1"/><path d="M3 10h18 M7 2v6 M17 2v6 M7 14h1 M12 14h1 M17 14h1 M7 18h1 M12 18h1 M17 18h1"/>',
  branch: '<path d="M3 9l2-6h14l2 6 M3 9v3c0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 3 3 3 0V9z M5 15v7h14v-7 M10 22v-6h5v6 M9 3l-1 6 M15 3l1 6"/>',
  address: '<path fill="currentColor" stroke="none" d="M12 1a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8m0 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8"/>',
  phone: '<path fill="currentColor" stroke="none" d="M5 2 2 5c-1 7 10 18 17 17l3-3-5-5-3 2c-3-1-5-3-6-6l2-3z"/>',
  staff: '<circle cx="12" cy="6" r="4" fill="currentColor" stroke="none"/><path fill="currentColor" stroke="none" d="M3 22v-3a9 9 0 0 1 18 0v3z"/>',
  customer: '<circle cx="9" cy="6" r="4" fill="currentColor" stroke="none"/><circle cx="17" cy="7" r="3" fill="currentColor" stroke="none"/><path fill="currentColor" stroke="none" d="M1 22v-3a8 8 0 0 1 16 0v3z M18 22v-3a10 10 0 0 0-3-7c6-1 8 3 8 7v3z"/>',
  wallet: '<path d="M3 7 18 2l2 5 M3 7h18v15H3z M21 12h-7v6h7"/><circle cx="17" cy="15" r=".8"/>',
}
const icon = (name: string) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${paths[name] ?? ''}</svg>`

/** Pure shared presentation. All merchant data and financial values arrive formatted by the Suit. */
export function renderReceiptDocument(receipt: BsReceiptView, copy: BsReceiptDocumentCopy, language: string, reprint = false): string {
  const rtl = receipt.direction || (language === 'ar' ? 'rtl' : 'ltr')
  const details = [
    [copy.invoice, receipt.invoice, 'invoice'], [copy.date, receipt.issued, 'date'],
    [copy.location, [receipt.location.code, receipt.location.name].filter(Boolean).join(' · '), 'branch'],
    ...(receipt.location.address ? [[copy.address, receipt.location.address, 'address']] : []),
    ...(receipt.location.phone ? [[copy.phone, receipt.location.phone, 'phone']] : []),
    [copy.staff, receipt.staff, 'staff'], [copy.customer, receipt.customer, 'customer'],
  ]
  const row = (label: string, value: string, glyph?: string) => `<div class="bs-receipt-detail"><span class="bs-receipt-label">${escape(label)}</span><span class="bs-receipt-colon">:</span><span class="bs-receipt-value">${text(value)}</span>${glyph ? icon(glyph) : ''}</div>`
  // Only issued inline raster logos are accepted. Receipt generation never fetches merchant URLs.
  const logo = receipt.logoDataUrl && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(receipt.logoDataUrl) ? `<img class="bs-receipt-merchant-logo" alt="" src="${escape(receipt.logoDataUrl)}">` : ''
  return `<article class="bs-sale-receipt" data-receipt-document lang="${language === 'ar' ? 'ar' : 'en'}" dir="${rtl}" aria-label="${escape(copy.title)}"><style>${receiptDocumentStyles}</style>
<header class="bs-receipt-heading">${logo}<h1>${text(receipt.issuer)}</h1><h2>${text(receipt.location.name)}</h2></header>
<h3 class="bs-receipt-title">${escape(copy.title)}</h3>${reprint ? `<p class="bs-receipt-reprint">${escape(copy.reprintLabel)}</p>` : ''}
<section class="bs-receipt-details">${details.map(([label, value, glyph]) => row(label!, value!, glyph)).join('')}</section>
<table class="bs-receipt-lines" aria-label="${escape(copy.items)}"><colgroup><col class="bs-receipt-product"><col class="bs-receipt-quantity"><col><col></colgroup><thead><tr>${[copy.item, copy.quantity, copy.unitPrice, copy.lineTotal].map(label => `<th>${escape(label)}</th>`).join('')}</tr></thead><tbody>${receipt.lines.map(line => `<tr><td>${text(line.label)}${line.description ? `<small>${text(line.description)}</small>` : ''}</td><td>${text(line.quantity)}</td><td>${text(line.unitPrice)}</td><td>${text(line.total)}</td></tr>`).join('')}</tbody></table>
<section class="bs-receipt-totals" aria-label="${escape(copy.total)}">${receipt.totals.map(total => `<div class="bs-receipt-total${total.emphasis ? ' bs-receipt-total--strong' : ''}"><span>${escape(total.label)}</span><span>${text(total.value)}</span></div>`).join('')}</section>
<section class="bs-receipt-payments"><h3><span>${escape(copy.payment)}</span>${icon('wallet')}</h3>${receipt.payments.map(payment => `<div class="bs-receipt-payment">${row(copy.payment, payment.summary)}${payment.reference ? row(copy.reference, payment.reference) : ''}</div>`).join('')}</section>
<footer class="bs-receipt-footer"><h3 class="bs-receipt-thanks"><span>${escape(copy.thankYou)}</span></h3><p class="bs-receipt-greeting">${escape(copy.greeting)}</p>${receipt.notes ? `<p class="bs-receipt-merchant-text">${escape(receipt.notes)}</p>` : ''}${receipt.footer ? `<p class="bs-receipt-merchant-text">${escape(receipt.footer)}</p>` : ''}<div class="bs-receipt-credit"><img src="/brand/shop-suit-mark-light.svg" alt="" width="22" height="22"><span>${escape(copy.issuedVia)}</span></div><p class="bs-receipt-compliance">${escape(copy.compliance)}</p></footer></article>`
}
