const MAX_IMPORT_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000

export const importTemplates = {
  products: ['name', 'sku', 'barcode', 'sale_price', 'opening_stock', 'opening_cost', 'category', 'supplier'],
  customers: ['name', 'phone', 'email', 'address', 'notes'],
  suppliers: ['name', 'contact_name', 'phone', 'email', 'address', 'tax_number', 'notes'],
}

function csvCell(value) {
  let text = String(value ?? '')
  // Spreadsheet programs interpret these prefixes as formulas. Preserve the
  // displayed value while ensuring exports cannot execute imported content.
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function encodeCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(headers.map(header => csvCell(row[header])).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function parseCsv(text, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_IMPORT_BYTES
  const maxRows = options.maxRows ?? MAX_IMPORT_ROWS
  if (new TextEncoder().encode(text).length > maxBytes) throw new Error('FILE_TOO_LARGE')

  const table = []
  let row = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++ }
      else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"' && cell === '') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') {
      row.push(cell.replace(/\r$/, '')); cell = ''
      if (row.some(value => value.trim() !== '')) table.push(row)
      row = []
      if (table.length > maxRows + 1) throw new Error('TOO_MANY_ROWS')
    }
    else cell += char
  }
  if (quoted) throw new Error('UNCLOSED_QUOTE')
  row.push(cell.replace(/\r$/, ''))
  if (row.some(value => value.trim() !== '')) table.push(row)
  if (!table.length) throw new Error('EMPTY_FILE')
  if (table.length - 1 > maxRows) throw new Error('TOO_MANY_ROWS')

  const headers = table[0].map(value => value.trim().toLocaleLowerCase().replaceAll(' ', '_'))
  if (headers.some((header, index) => !header || headers.indexOf(header) !== index)) throw new Error('INVALID_HEADERS')
  return table.slice(1).map((values, index) => Object.fromEntries([
    ['row_number', index + 2],
    ...headers.map((header, column) => [header, (values[column] ?? '').trim()]),
  ]))
}

export function validateImportHeaders(kind, rows) {
  const required = kind === 'products' ? ['name', 'sale_price'] : ['name']
  const first = rows[0] ?? {}
  return required.filter(header => !(header in first))
}

export function downloadCsv(filename, csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
