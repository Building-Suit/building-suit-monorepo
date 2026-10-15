export const receiptDocumentStyles = String.raw`
/* White monochrome output deliberately stays independent of the application theme. */
.bs-sale-receipt { box-sizing: border-box; width: 80mm; max-width: 100%; padding: 12px 11px; margin: 0 auto; color: var(--bs-component-receipt-ink); background: var(--bs-component-receipt-paper); font-family: var(--bs-component-receipt-font-family); font-size: 12px; line-height: 1.45; text-align: start; font-variant-numeric: tabular-nums; }
.bs-sale-receipt * { box-sizing: border-box; }
.bs-sale-receipt h1,.bs-sale-receipt h2,.bs-sale-receipt h3,.bs-sale-receipt p { margin: 0; color: inherit; font-family: inherit; line-height: inherit; }
.bs-sale-receipt bdi { unicode-bidi: isolate; }
.bs-receipt-heading { text-align: center; border-bottom: 1px dashed var(--bs-component-receipt-separator); padding-bottom: 13px; }
.bs-receipt-heading h1 { font-size: 28px; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
.bs-receipt-heading h2 { font-size: 17px; font-weight: 600; margin-top: 3px; overflow-wrap: anywhere; }
.bs-receipt-merchant-logo { display: block; width: 48px; height: 48px; object-fit: contain; margin: 0 auto 8px; filter: grayscale(1); }
.bs-sale-receipt .bs-receipt-title { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 2.6px; margin: 11px 0 12px; }
.bs-sale-receipt[lang='en'] .bs-receipt-title { text-transform: uppercase; }
.bs-sale-receipt[lang='en'] .bs-receipt-payments { padding-bottom: 6px; }
.bs-sale-receipt[lang='en'] .bs-receipt-footer { padding-top: 5px; }
.bs-sale-receipt[lang='en'] .bs-receipt-thanks { font-size: 15.5px; }
.bs-sale-receipt[lang='ar'] .bs-receipt-title { font-size: 23px; letter-spacing: normal; margin: 6px 0 7px; }
.bs-receipt-reprint { text-align: center; font-size: 9px; margin-bottom: 5px !important; }
.bs-receipt-details { padding-bottom: 9px; border-bottom: 1px dashed var(--bs-component-receipt-separator); margin-bottom: 11px; }
.bs-receipt-detail { display: grid; direction: ltr; grid-template-columns: 30% 10% minmax(0,1fr) 18px; align-items: center; min-height: 22px; column-gap: 2px; }
.bs-receipt-detail svg,.bs-receipt-payments svg { width: 18px; height: 18px; justify-self: end; }
.bs-receipt-label,.bs-receipt-value { overflow-wrap: anywhere; min-width: 0; }
.bs-receipt-value { text-align: start; }
.bs-sale-receipt[dir='rtl'] .bs-receipt-detail { grid-template-columns: minmax(0,1fr) 8% 34% 18px; }
.bs-sale-receipt[dir='rtl'] .bs-receipt-label { grid-column: 3; grid-row: 1; text-align: right; direction: rtl; font-weight: 600; }
.bs-sale-receipt[dir='rtl'] .bs-receipt-colon { grid-column: 2; grid-row: 1; text-align: center; }
.bs-sale-receipt[dir='rtl'] .bs-receipt-value { grid-column: 1; grid-row: 1; text-align: left; }
.bs-sale-receipt[dir='rtl'] .bs-receipt-detail svg { grid-column: 4; grid-row: 1; }
.bs-receipt-lines { font-family: var(--bs-component-receipt-table-font-family); width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; line-height: 1.45; }
.bs-receipt-product { width: 34%; }.bs-receipt-quantity { width: 12%; }
.bs-receipt-lines th { background: var(--bs-component-receipt-band); font-weight: 700; padding: 3px 3px; text-align: center; }
.bs-receipt-lines th:first-child,.bs-receipt-lines td:first-child { text-align: start; }
.bs-receipt-lines td { padding: 6px 3px; text-align: center; border-bottom: 1px dotted var(--bs-component-receipt-row-separator); overflow-wrap: anywhere; vertical-align: top; }
.bs-receipt-lines td:last-child { text-align: end; }
.bs-receipt-lines tr:last-child td { border-bottom: 1px dashed var(--bs-component-receipt-separator); }
.bs-receipt-lines small { display: block; font-size: 9px; white-space: pre-wrap; }
.bs-receipt-totals { padding-top: 4px; padding-bottom: 9px; border-bottom: 1px dashed var(--bs-component-receipt-separator); }
.bs-receipt-total { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 5px 3px; overflow-wrap: anywhere; }
.bs-receipt-total--strong { font-size: 16px; font-weight: 700; background: var(--bs-component-receipt-band); margin-top: 1px; padding: 3px 5px; }
.bs-receipt-payments { padding-top: 9px; padding-bottom: 13px; border-bottom: 1px dashed var(--bs-component-receipt-separator); }
.bs-receipt-payments h3 { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
.bs-receipt-payments h3 { display: grid; direction: ltr; grid-template-columns: 1fr 18px; }
.bs-sale-receipt[dir='rtl'] .bs-receipt-payments h3 span { text-align: right; padding-right: 6px; }
.bs-receipt-payment + .bs-receipt-payment { margin-top: 8px; }
.bs-receipt-payment .bs-receipt-detail { border-radius: 6px; background: var(--bs-component-receipt-payment-band); padding: 1px 8px; margin-top: 3px; grid-template-columns: 37% 10% minmax(0,1fr); }
.bs-sale-receipt[dir='rtl'] .bs-receipt-payment .bs-receipt-detail { grid-template-columns: minmax(0,1fr) 8% 43%; }
.bs-receipt-payment .bs-receipt-label { font-weight: 400 !important; }
.bs-sale-receipt .bs-receipt-footer { border: 0; font-size: 12px; text-align: center; padding-top: 9px; }
.bs-receipt-thanks { display: flex; align-items: center; justify-content: center; gap: 9px; font-size: 17px; font-weight: 700; }
.bs-receipt-thanks::before,.bs-receipt-thanks::after { content: ''; width: 20%; border-top: .5px solid var(--bs-component-receipt-separator); }
.bs-receipt-greeting { font-size: 11px; margin-bottom: 8px !important; }
.bs-receipt-merchant-text { font-size: 10px; white-space: pre-wrap; overflow-wrap: anywhere; margin: 5px 0 !important; }
.bs-receipt-credit { border-top: .5px solid var(--bs-component-receipt-separator); margin-top: 7px; padding: 5px 0; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 8px; }
.bs-receipt-credit img { width: 18px; height: 18px; filter: grayscale(1); object-fit: contain; }
.bs-receipt-compliance { border-top: 1px dashed var(--bs-component-receipt-footer-separator); padding-top: 6px; font-size: 8px; color: var(--bs-component-receipt-separator) !important; }
.bs-printable-document.bs-receipt-preview[data-format] .bs-printable-document__paper { padding: 0; border: 0; background: var(--bs-component-receipt-paper); }
@media print { .bs-sale-receipt { max-width: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .bs-receipt-lines tr,.bs-receipt-payments,.bs-receipt-footer { break-inside: avoid; } }
/* Thermal typography follows the supplied specimen; headings keep broad Latin forms. */
.bs-receipt-heading h1 { font-family: var(--bs-component-receipt-heading-font-family); font-size: 28px; }
.bs-receipt-heading h2 { font-family: var(--bs-component-receipt-heading-font-family); font-size: 16px; margin-top: 2px; }
.bs-receipt-heading { padding-bottom: 9px; }
.bs-sale-receipt { font-size: 12px; }
.bs-receipt-lines { font-size: 12px; }
.bs-sale-receipt[lang='ar'] .bs-receipt-detail { min-height: 23px; }
.bs-sale-receipt[lang='ar'] .bs-receipt-label { font-size: 13px; }
`
