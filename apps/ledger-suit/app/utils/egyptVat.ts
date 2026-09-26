export type VatDirection = 'output' | 'input'
export type VatDocumentKind = 'invoice' | 'credit' | 'reversal'

export interface VatDocumentRow {
  id: string
  direction: VatDirection
  kind: VatDocumentKind
  document_date: string
  tax_point_date: string
  reference: string
  counterparty_id: string | null
  base_account_id: string
  gross_account_id: string
  tax_account_id: string
  taxable_base_minor: string
  tax_minor: string
  gross_minor: string
  rate_basis_points: number
  transaction_id: string
  adjusts_document_id: string | null
  reason: string | null
}

export interface VatReport {
  from_date: string
  to_date: string
  registration_number: string
  jurisdiction: 'EG'
  currency: 'EGP'
  output_tax_minor: string
  input_tax_minor: string
  net_vat_minor: string
  output_taxable_base_minor: string
  input_taxable_base_minor: string
  output_gl_minor: string
  input_gl_minor: string
  output_difference_minor: string
  input_difference_minor: string
  reconciled: boolean
  documents: VatDocumentRow[]
}

export interface VatWorkspace {
  profiles: { id: string, registration_number: string, effective_from: string, output_vat_account_id: string, input_vat_account_id: string }[]
  rules: { id: string, code: string, name_en: string, name_ar: string, rate_basis_points: number, effective_from: string, evidence_verified_on: string, evidence_uri: string, scope_note: string }[]
  accounts: { id: string, code: string | null, name: string, type: string, subtype: string, role: string, currency: string, archived: boolean }[]
  counterparties: { id: string, name: string, type: string, archived: boolean }[]
  report: VatReport | null
}

export function calculateVatMinor(baseMinor: bigint, rateBasisPoints: bigint): bigint {
  if (baseMinor <= 0n || rateBasisPoints <= 0n) throw new RangeError('Positive base and rate are required')
  return (baseMinor * rateBasisPoints + 5000n) / 10000n
}

export function vatReportReconciles(report: VatReport | null): boolean {
  return Boolean(report?.reconciled
    && BigInt(report.output_difference_minor) === 0n
    && BigInt(report.input_difference_minor) === 0n)
}

