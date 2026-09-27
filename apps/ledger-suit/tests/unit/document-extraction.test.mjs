import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DOCUMENT_EXTRACTION_CONTRACT,
  buildDocumentExtractionRows,
  cloneDocumentExtractionCandidates,
  documentExtractionImportFilename,
  documentExtractionRequiredFieldsComplete,
  parseDocumentExtractionProposal,
} from '../../app/utils/documentExtraction.ts'

const proposalJson = JSON.stringify({
  contract: DOCUMENT_EXTRACTION_CONTRACT,
  source: {
    file_name: 'فاتورة-١.pdf',
    sha256: 'a'.repeat(64),
  },
  candidates: [{
    fields: {
      type: { value: 'expense', confidence: 0.99, evidence: 'page 1: invoice heading' },
      date: { value: '2026-09-27', confidence: 0.92, evidence: 'page 1: issue date' },
      amount: { value: '9007199254740993.25', confidence: 0.55, evidence: 'page 1: total' },
      account: { value: '', confidence: null, evidence: '' },
      category: { value: 'Supplies', confidence: 0.4, evidence: 'machine suggestion only' },
      description: { value: 'Office supplies', confidence: 0.8 },
    },
    errors: [{ code: 'ACCOUNT_NOT_EXTRACTED', message: 'Choose an existing payment account.' }],
  }],
})

test('document proposal parsing preserves exact strings, confidence, evidence and extraction errors', () => {
  const proposal = parseDocumentExtractionProposal(proposalJson)
  assert.equal(proposal.source.fileName, 'فاتورة-١.pdf')
  assert.equal(proposal.candidates[0].fields.amount.value, '9007199254740993.25')
  assert.equal(proposal.candidates[0].fields.amount.confidence, 0.55)
  assert.equal(proposal.candidates[0].fields.amount.evidence, 'page 1: total')
  assert.deepEqual(proposal.candidates[0].errors, [{ code: 'ACCOUNT_NOT_EXTRACTED', message: 'Choose an existing payment account.' }])
  assert.equal(proposal.candidates[0].fields.currency.value, '')
})

test('review requires every normal import field and records corrections plus source provenance without coercing money', () => {
  const proposal = parseDocumentExtractionProposal(proposalJson)
  const reviewed = cloneDocumentExtractionCandidates(proposal)
  assert.equal(documentExtractionRequiredFieldsComplete(reviewed), false)
  reviewed[0].fields.account.value = 'Cash'
  reviewed[0].fields.amount.value = '9007199254740993.20'
  assert.equal(documentExtractionRequiredFieldsComplete(reviewed), true)

  const parsed = buildDocumentExtractionRows(proposal, reviewed, {
    fileName: 'فاتورة-١.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 12345,
    sha256: 'a'.repeat(64),
  })
  assert.equal(parsed.rows[0].amount, '9007199254740993.20')
  assert.equal(parsed.rows[0].__ledger_extraction_original_amount, '9007199254740993.25')
  assert.equal(parsed.rows[0].__ledger_extraction_confidence_amount, '0.55')
  assert.equal(parsed.rows[0].__ledger_extraction_evidence_amount, 'page 1: total')
  assert.equal(parsed.rows[0].__ledger_extraction_document_sha256, 'a'.repeat(64))
  assert.deepEqual(JSON.parse(parsed.rows[0].__ledger_extraction_corrected_fields), ['amount', 'account'])
  assert.deepEqual(parsed.headers, ['type', 'date', 'amount', 'account', 'category', 'description', 'reference', 'counterparty', 'currency', 'exchange_rate'])
})

test('proposal contract rejects numeric candidate values, unsafe confidence and source mismatches in metadata', () => {
  const numericMoney = JSON.parse(proposalJson)
  numericMoney.candidates[0].fields.amount.value = 9007199254740992
  assert.throws(() => parseDocumentExtractionProposal(JSON.stringify(numericMoney)), /DOCUMENT_EXTRACTION_FIELD_INVALID/)

  const invalidConfidence = JSON.parse(proposalJson)
  invalidConfidence.candidates[0].fields.amount.confidence = 1.1
  assert.throws(() => parseDocumentExtractionProposal(JSON.stringify(invalidConfidence)), /DOCUMENT_EXTRACTION_CONFIDENCE_INVALID/)

  const invalidDigest = JSON.parse(proposalJson)
  invalidDigest.source.sha256 = 'not-a-digest'
  assert.throws(() => parseDocumentExtractionProposal(JSON.stringify(invalidDigest)), /DOCUMENT_EXTRACTION_SOURCE_INVALID/)

  const tooManyCandidates = JSON.parse(proposalJson)
  tooManyCandidates.candidates = Array.from({ length: 101 }, () => tooManyCandidates.candidates[0])
  assert.throws(() => parseDocumentExtractionProposal(JSON.stringify(tooManyCandidates)), /DOCUMENT_EXTRACTION_CANDIDATES_INVALID/)
})

test('document import filenames remain valid CSV names for the existing batch contract', () => {
  assert.equal(documentExtractionImportFilename('invoice 2026.pdf'), 'invoice-2026-extraction.csv')
  assert.match(documentExtractionImportFilename('.pdf'), /\.csv$/)
  assert.ok(documentExtractionImportFilename('x'.repeat(400) + '.pdf').length <= 250)
})
