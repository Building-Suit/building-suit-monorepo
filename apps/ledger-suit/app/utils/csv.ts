export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

/** Parse RFC 4180-style CSV, including quoted commas, quotes, and newlines. */
export function parseCsv(text: string, options: { allowEmpty?: boolean } = {}): ParsedCsv {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index++
      }
      else if (character === '"') quoted = false
      else field += character
      continue
    }

    if (character === '"' && field === '') quoted = true
    else if (character === ',') {
      record.push(field)
      field = ''
    }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index++
      record.push(field)
      if (record.some(value => value !== '')) records.push(record)
      record = []
      field = ''
    }
    else field += character
  }

  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE')
  record.push(field)
  if (record.some(value => value !== '')) records.push(record)
  if (!records.length || (records.length < 2 && !options.allowEmpty)) throw new Error('CSV_NO_DATA')

  const headers = records[0]!.map(value => value.trim())
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) {
    throw new Error('CSV_HEADERS_INVALID')
  }

  const rows = records.slice(1).map((values) => {
    if (values.length > headers.length) throw new Error('CSV_ROW_WIDTH_INVALID')
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
  return { headers, rows }
}

/** Values remain strings: never round financial amounts or strip formula protection. */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(value => /[,"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv.replace(/^\uFEFF/, '')}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}
