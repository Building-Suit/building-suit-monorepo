import { parseCsv } from './csv.ts'
import type { CsvReport } from './localizedCsv.ts'

export interface ReportFormatMetadata {
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
}

const monetaryColumns: Record<CsvReport, ReadonlySet<number>> = {
  profit_loss: new Set([3]),
  balance_sheet: new Set([5]),
  trial_balance: new Set([3, 4, 5, 6, 7, 8]),
  cash_flow: new Set([3]),
  general_ledger: new Set([4, 5, 6]),
}

const encoder = new TextEncoder()

function xml(value: string): string {
  const sanitized = Array.from(value, character => {
    const codePoint = character.codePointAt(0)!
    return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d || codePoint >= 0x20 ? character : ''
  }).join('')
  return sanitized.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function html(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function excelColumn(index: number): string {
  let column = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    column = String.fromCharCode(65 + ((value - 1) % 26)) + column
  }
  return column
}

function inlineCell(reference: string, value: string, style = 0): string {
  return `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

function dataRows(localizedCsv: string) {
  const parsed = parseCsv(localizedCsv, { allowEmpty: true })
  return { headers: parsed.headers, rows: parsed.rows.map(row => parsed.headers.map(header => row[header] ?? '')) }
}

function reportSheetXml(localizedCsv: string, report: CsvReport, metadata: ReportFormatMetadata): string {
  const { headers, rows } = dataRows(localizedCsv)
  const metadataRows: Array<[string, string, number?]> = [
    [metadata.title, '', 1],
    [metadata.labels.organization, metadata.organization],
    [metadata.labels.currency, metadata.currency],
    [metadata.labels.generatedAt, metadata.generatedAt],
    ...metadata.filters.map(filter => [filter.label, filter.value] as [string, string]),
  ]
  if (metadata.warning) metadataRows.push([metadata.labels.warning, metadata.warning, 3])
  const tableHeaderRow = metadataRows.length + 2
  if (tableHeaderRow + rows.length > 1_048_576) throw new RangeError('XLSX_ROW_LIMIT')
  const worksheetRows: string[] = metadataRows.map(([label, value, style], index) => {
    const row = index + 1
    return `<row r="${row}">${inlineCell(`A${row}`, label, style ?? 2)}${value ? inlineCell(`B${row}`, value, style ?? 0) : ''}</row>`
  })
  worksheetRows.push(`<row r="${tableHeaderRow}">${headers.map((header, index) => inlineCell(`${excelColumn(index)}${tableHeaderRow}`, header, 2)).join('')}</row>`)
  rows.forEach((values, rowIndex) => {
    const row = tableHeaderRow + rowIndex + 1
    const cells = values.map((value, columnIndex) => {
      const reference = `${excelColumn(columnIndex)}${row}`
      if (monetaryColumns[report].has(columnIndex) && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
        // Keep the database-derived decimal literal intact. Do not coerce through
        // JavaScript Number before writing the workbook's numeric cell.
        return `<c r="${reference}" s="4"><v>${value}</v></c>`
      }
      return inlineCell(reference, value)
    })
    worksheetRows.push(`<row r="${row}">${cells.join('')}</row>`)
  })
  const lastColumn = excelColumn(Math.max(headers.length - 1, 0))
  const lastRow = tableHeaderRow + Math.max(rows.length, 1)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="${metadata.direction === 'rtl' ? '1' : '0'}"><pane ySplit="${tableHeaderRow}" topLeftCell="A${tableHeaderRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="${Math.max(headers.length, 2)}" width="20" customWidth="1"/></cols>
  <sheetData>${worksheetRows.join('')}</sheetData>
  <autoFilter ref="A${tableHeaderRow}:${lastColumn}${lastRow}"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

function concatBytes(chunks: readonly Uint8Array[], size = chunks.reduce((total, chunk) => total + chunk.length, 0)) {
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function zipHeader(size: number, write: (view: DataView) => void) {
  const bytes = new Uint8Array(size)
  write(new DataView(bytes.buffer))
  return bytes
}

const crcTable = Array.from({ length: 256 }, (_, seed) => {
  let value = seed
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
  return value >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function storedZip(files: ReadonlyArray<{ path: string, contents: string }>): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.path)
    const data = encoder.encode(file.contents)
    const checksum = crc32(data)
    const localHeader = zipHeader(30, (view) => {
      view.setUint32(0, 0x04034b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 0x0800, true)
      view.setUint32(14, checksum, true)
      view.setUint32(18, data.length, true)
      view.setUint32(22, data.length, true)
      view.setUint16(26, name.length, true)
    })
    const local = concatBytes([localHeader, name, data])
    localParts.push(local)
    const centralHeader = zipHeader(46, (view) => {
      view.setUint32(0, 0x02014b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 20, true)
      view.setUint16(8, 0x0800, true)
      view.setUint32(16, checksum, true)
      view.setUint32(20, data.length, true)
      view.setUint32(24, data.length, true)
      view.setUint16(28, name.length, true)
      view.setUint32(42, offset, true)
    })
    centralParts.push(concatBytes([centralHeader, name]))
    offset += local.length
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end = zipHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true)
    view.setUint16(8, files.length, true)
    view.setUint16(10, files.length, true)
    view.setUint32(12, centralSize, true)
    view.setUint32(16, offset, true)
  })
  return concatBytes([...localParts, ...centralParts, end], offset + centralSize + end.length)
}

export function buildReportXlsx(localizedCsv: string, report: CsvReport, metadata: ReportFormatMetadata): Uint8Array {
  const sheet = reportSheetXml(localizedCsv, report, metadata)
  return storedZip([
    { path: '[Content_Types].xml', contents: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { path: '_rels/.rels', contents: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { path: 'docProps/core.xml', contents: `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(metadata.title)}</dc:title><dc:creator>Ledger Suit</dc:creator></cp:coreProperties>` },
    { path: 'docProps/app.xml', contents: '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Ledger Suit</Application></Properties>' },
    { path: 'xl/workbook.xml', contents: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(metadata.title.slice(0, 31) || 'Report')}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { path: 'xl/_rels/workbook.xml.rels', contents: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { path: 'xl/styles.xml', contents: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#0.00########"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"><alignment wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>' },
    { path: 'xl/worksheets/sheet1.xml', contents: sheet },
  ])
}

export function buildPrintableReportHtml(localizedCsv: string, report: CsvReport, metadata: ReportFormatMetadata): string {
  const { headers, rows } = dataRows(localizedCsv)
  // This is a detached print document, not an application data grid. Keep a
  // semantic table so browsers can repeat headers across printed/PDF pages.
  const tableElement = 'table'
  const detailRows: Array<readonly [string, string]> = [
    [metadata.labels.organization, metadata.organization],
    [metadata.labels.currency, metadata.currency],
    [metadata.labels.generatedAt, metadata.generatedAt],
    ...metadata.filters.map((filter): readonly [string, string] => [filter.label, filter.value]),
  ]
  return `<!doctype html><html lang="${metadata.direction === 'rtl' ? 'ar' : 'en'}" dir="${metadata.direction}"><head><meta charset="utf-8"><title>${html(metadata.title)}</title><style>
@page{size:landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,"IBM Plex Sans Arabic",sans-serif;color:#172033;margin:0}h1{font-size:22px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 24px;margin-bottom:14px;font-size:12px}.meta dt{font-weight:700}.meta dd{margin:0}.warning{border:1px solid #a56300;background:#fff7e6;padding:8px;margin:10px 0;font-weight:700}table{border-collapse:collapse;width:100%;font-size:10px}thead{display:table-header-group}th,td{border:1px solid #aab3c2;padding:5px 7px;text-align:start;vertical-align:top}th{background:#e8edf3;font-weight:700}.numeric{text-align:end;font-variant-numeric:tabular-nums;direction:ltr}tr{break-inside:avoid}@media screen{body{padding:20px;max-width:1600px;margin:auto}}</style></head><body><h1>${html(metadata.title)}</h1><dl class="meta">${detailRows.map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join('')}</dl>${metadata.warning ? `<p class="warning">${html(metadata.labels.warning)}: ${html(metadata.warning)}</p>` : ''}<${tableElement}><thead><tr>${headers.map(header => `<th>${html(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(values => `<tr>${values.map((value, index) => `<td${monetaryColumns[report].has(index) ? ' class="numeric"' : ''}>${html(value)}</td>`).join('')}</tr>`).join('')}</tbody></${tableElement}></body></html>`
}

export function downloadReportXlsx(filename: string, workbook: Uint8Array) {
  const bytes = new Uint8Array(workbook.byteLength)
  bytes.set(workbook)
  const url = URL.createObjectURL(new Blob([bytes.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
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
