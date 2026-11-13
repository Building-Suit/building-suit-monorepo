export interface BsReportDocumentMetadata {
  title: string
  organization: string
  currency: string
  generatedAt: string
  direction: 'ltr' | 'rtl'
  labels: {
    organization: string
    currency: string
    generatedAt: string
    warning: string
  }
  filters: ReadonlyArray<{ label: string, value: string }>
  warning?: string
  isolateValues?: boolean
}

function html(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
export function renderReportDocument(headers: string[], rows: string[][], numericColumns: ReadonlySet<number>, metadata: BsReportDocumentMetadata): string {
  // This is a detached print document, not an application data grid. Keep a
  // semantic table so browsers can repeat headers across printed/PDF pages.
  const tableElement = 'table'
  const valueText = (value: string) => metadata.isolateValues ? `<bdi>${html(value)}</bdi>` : html(value)
  const detailRows: Array<readonly [string, string]> = [
    [metadata.labels.organization, metadata.organization],
    [metadata.labels.currency, metadata.currency],
    [metadata.labels.generatedAt, metadata.generatedAt],
    ...metadata.filters.map((filter): readonly [string, string] => [filter.label, filter.value]),
  ]
  return `<!doctype html><html lang="${metadata.direction === 'rtl' ? 'ar' : 'en'}" dir="${metadata.direction}"><head><meta charset="utf-8"><title>${html(metadata.title)}</title><style>
@page{size:landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,"IBM Plex Sans Arabic",sans-serif;color:#172033;margin:0}h1{font-size:22px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 24px;margin-bottom:14px;font-size:12px}.meta dt{font-weight:700}.meta dd{margin:0}.warning{border:1px solid #a56300;background:#fff7e6;padding:8px;margin:10px 0;font-weight:700}table{border-collapse:collapse;width:100%;font-size:10px}thead{display:table-header-group}th,td{border:1px solid #aab3c2;padding:5px 7px;text-align:start;vertical-align:top}th{background:#e8edf3;font-weight:700}.numeric{text-align:end;font-variant-numeric:tabular-nums;direction:ltr}tr{break-inside:avoid}@media screen{body{padding:20px;max-width:1600px;margin:auto}}</style></head><body><h1>${html(metadata.title)}</h1><dl class="meta">${detailRows.map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${valueText(value)}</dd></div>`).join('')}</dl>${metadata.warning ? `<p class="warning">${html(metadata.labels.warning)}: ${html(metadata.warning)}</p>` : ''}<${tableElement}><thead><tr>${headers.map(header => `<th>${html(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(values => `<tr>${values.map((value, index) => `<td${numericColumns.has(index) ? ' class="numeric"' : ''}>${valueText(value)}</td>`).join('')}</tr>`).join('')}</tbody></${tableElement}></body></html>`
}


export function renderPendingPrintDocument(title: string, direction: 'ltr' | 'rtl', message: string) {
 return `<!doctype html><html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}"><head><meta charset="utf-8"><title>${html(title)}</title></head><body><p>${html(message)}</p></body></html>`
}
