import type { ParsedCsv } from './csv.ts'
import { CSV_IMPORT_FIELDS, CSV_REQUIRED_FIELDS } from './localizedCsv.ts'

export const DOCUMENT_EXTRACTION_CONTRACT = 'ledger.document-extraction.v1'
export const DOCUMENT_EXTRACTION_MAX_PROPOSAL_BYTES = 1024 * 1024
export const DOCUMENT_EXTRACTION_MAX_CANDIDATES = 100

export interface DocumentExtractionField {
  value: string
  confidence: number | null
  evidence: string
}

export interface DocumentExtractionError {
  code: string
  message: string
}

export interface DocumentExtractionCandidate {
  fields: Record<string, DocumentExtractionField>
  errors: DocumentExtractionError[]
}

export interface DocumentExtractionProposal {
  contract: typeof DOCUMENT_EXTRACTION_CONTRACT
  source: {
    fileName: string
    sha256: string | null
  } | null
  candidates: DocumentExtractionCandidate[]
}

export interface DocumentExtractionSource {
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function boundedString(value: unknown, maximum: number, error: string, allowEmpty = true) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) throw new Error(error)
  return value
}

/**
 * Parses provider-neutral extraction output without coercing candidate values.
 * In particular, monetary values must arrive as strings so values above 2^53
 * remain exact all the way into the existing import validator.
 */
export function parseDocumentExtractionProposal(text: string): DocumentExtractionProposal {
  let input: unknown
  try { input = JSON.parse(text) }
  catch { throw new Error('DOCUMENT_EXTRACTION_JSON_INVALID') }
  if (!isRecord(input) || input.contract !== DOCUMENT_EXTRACTION_CONTRACT || !Array.isArray(input.candidates)) {
    throw new Error('DOCUMENT_EXTRACTION_CONTRACT_INVALID')
  }
  if (!input.candidates.length || input.candidates.length > DOCUMENT_EXTRACTION_MAX_CANDIDATES) {
    throw new Error('DOCUMENT_EXTRACTION_CANDIDATES_INVALID')
  }

  let source: DocumentExtractionProposal['source'] = null
  if (input.source !== undefined && input.source !== null) {
    if (!isRecord(input.source)) throw new Error('DOCUMENT_EXTRACTION_SOURCE_INVALID')
    const fileName = boundedString(input.source.file_name, 255, 'DOCUMENT_EXTRACTION_SOURCE_INVALID', false)
    const sha256 = input.source.sha256 === undefined || input.source.sha256 === null || input.source.sha256 === ''
      ? null
      : boundedString(input.source.sha256, 64, 'DOCUMENT_EXTRACTION_SOURCE_INVALID').toLowerCase()
    if (sha256 !== null && !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('DOCUMENT_EXTRACTION_SOURCE_INVALID')
    source = { fileName, sha256 }
  }

  const candidates = input.candidates.map((candidate, candidateIndex): DocumentExtractionCandidate => {
    if (!isRecord(candidate) || !isRecord(candidate.fields)) throw new Error(`DOCUMENT_EXTRACTION_CANDIDATE_INVALID:${candidateIndex + 1}`)
    const candidateFields = candidate.fields
    const fields = Object.fromEntries(CSV_IMPORT_FIELDS.map((field) => {
      const proposed = candidateFields[field]
      if (proposed === undefined || proposed === null) return [field, { value: '', confidence: null, evidence: '' }]
      if (!isRecord(proposed)) throw new Error(`DOCUMENT_EXTRACTION_FIELD_INVALID:${candidateIndex + 1}:${field}`)
      const value = boundedString(proposed.value, 1000, `DOCUMENT_EXTRACTION_FIELD_INVALID:${candidateIndex + 1}:${field}`)
      const confidence = proposed.confidence === undefined || proposed.confidence === null
        ? null
        : proposed.confidence
      if (confidence !== null && (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
        throw new Error(`DOCUMENT_EXTRACTION_CONFIDENCE_INVALID:${candidateIndex + 1}:${field}`)
      }
      const evidence = proposed.evidence === undefined
        ? ''
        : boundedString(proposed.evidence, 500, `DOCUMENT_EXTRACTION_EVIDENCE_INVALID:${candidateIndex + 1}:${field}`)
      return [field, { value, confidence, evidence }]
    }))
    const rawErrors = candidate.errors ?? []
    if (!Array.isArray(rawErrors) || rawErrors.length > 20) throw new Error(`DOCUMENT_EXTRACTION_ERRORS_INVALID:${candidateIndex + 1}`)
    const errors = rawErrors.map((error): DocumentExtractionError => {
      if (!isRecord(error)) throw new Error(`DOCUMENT_EXTRACTION_ERRORS_INVALID:${candidateIndex + 1}`)
      return {
        code: boundedString(error.code, 100, `DOCUMENT_EXTRACTION_ERRORS_INVALID:${candidateIndex + 1}`, false),
        message: boundedString(error.message, 500, `DOCUMENT_EXTRACTION_ERRORS_INVALID:${candidateIndex + 1}`, false),
      }
    })
    return { fields, errors }
  })
  return { contract: DOCUMENT_EXTRACTION_CONTRACT, source, candidates }
}

export function cloneDocumentExtractionCandidates(proposal: DocumentExtractionProposal): DocumentExtractionCandidate[] {
  return proposal.candidates.map(candidate => ({
    fields: Object.fromEntries(CSV_IMPORT_FIELDS.map(field => [field, { ...candidate.fields[field]! }])),
    errors: candidate.errors.map(error => ({ ...error })),
  }))
}

export function documentExtractionRequiredFieldsComplete(candidates: readonly DocumentExtractionCandidate[]) {
  return candidates.length > 0 && candidates.every(candidate => CSV_REQUIRED_FIELDS.every(field => candidate.fields[field]?.value.trim()))
}

export function buildDocumentExtractionRows(
  proposal: DocumentExtractionProposal,
  reviewed: readonly DocumentExtractionCandidate[],
  source: DocumentExtractionSource,
): ParsedCsv {
  if (reviewed.length !== proposal.candidates.length || !documentExtractionRequiredFieldsComplete(reviewed)) {
    throw new Error('DOCUMENT_EXTRACTION_REVIEW_INCOMPLETE')
  }
  const rows = reviewed.map((candidate, index) => {
    const original = proposal.candidates[index]!
    const correctedFields = CSV_IMPORT_FIELDS.filter(field => candidate.fields[field]!.value !== original.fields[field]!.value)
    const row: Record<string, string> = Object.fromEntries(CSV_IMPORT_FIELDS.map(field => [field, candidate.fields[field]!.value]))
    Object.assign(row, {
      __ledger_extraction_contract: proposal.contract,
      __ledger_extraction_document_name: source.fileName,
      __ledger_extraction_document_mime_type: source.mimeType,
      __ledger_extraction_document_size_bytes: String(source.sizeBytes),
      __ledger_extraction_document_sha256: source.sha256,
      __ledger_extraction_candidate: String(index + 1),
      __ledger_extraction_errors: JSON.stringify(candidate.errors),
      __ledger_extraction_corrected_fields: JSON.stringify(correctedFields),
    })
    for (const field of CSV_IMPORT_FIELDS) {
      const extracted = original.fields[field]!
      if (extracted.confidence !== null) row[`__ledger_extraction_confidence_${field}`] = String(extracted.confidence)
      if (extracted.evidence) row[`__ledger_extraction_evidence_${field}`] = extracted.evidence
      if (candidate.fields[field]!.value !== extracted.value) row[`__ledger_extraction_original_${field}`] = extracted.value
    }
    return row
  })
  return { headers: [...CSV_IMPORT_FIELDS], rows }
}

export function documentExtractionImportFilename(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'document'
  return `${base.slice(0, 235)}-extraction.csv`
}
