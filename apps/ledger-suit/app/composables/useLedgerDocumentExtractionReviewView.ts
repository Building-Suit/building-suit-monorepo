import type { ParsedCsv } from '~/utils/csv'
import type { DocumentExtractionCandidate, DocumentExtractionProposal } from '~/utils/documentExtraction'
import {
  DOCUMENT_EXTRACTION_MAX_PROPOSAL_BYTES,
  buildDocumentExtractionRows,
  cloneDocumentExtractionCandidates,
  documentExtractionRequiredFieldsComplete,
  parseDocumentExtractionProposal,
} from '~/utils/documentExtraction'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerDocumentExtractionReviewView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const emit = _emit as <K extends keyof ({ accepted: [payload: { parsed: ParsedCsv, file: File }] })>(event: K, ...args: ({ accepted: [payload: { parsed: ParsedCsv, file: File }] })[K]) => void
const { t } = useI18n()

const sourceFile = ref<File | null>(null)
const sourceSha256 = ref('')
const proposal = ref<DocumentExtractionProposal | null>(null)
const candidates = ref<DocumentExtractionCandidate[]>([])
const reviewed = ref(false)
const errorCode = ref('')
const hashing = ref(false)
const proposalInput = ref<HTMLInputElement | null>(null)
const documentInput = ref<HTMLInputElement | null>(null)
const fields = ['type', 'date', 'amount', 'account', 'category', 'description', 'reference', 'counterparty', 'currency', 'exchange_rate'] as const

const requiredComplete = computed(() => documentExtractionRequiredFieldsComplete(candidates.value))
const sourceMatches = computed(() => {
  if (!proposal.value?.source || !sourceFile.value) return true
  return proposal.value.source.fileName === sourceFile.value.name
    && (!proposal.value.source.sha256 || proposal.value.source.sha256 === sourceSha256.value)
})
const canAccept = computed(() => Boolean(sourceFile.value && proposal.value && sourceSha256.value && !hashing.value && sourceMatches.value && requiredComplete.value && reviewed.value))
watch(candidates, () => { reviewed.value = false }, { deep: true })

function readableError(code: string) {
  const key = `imports.extraction.errors.${code.split(':')[0]}`
  return t(key)
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function onDocumentSelected(event: Event) {
  errorCode.value = ''
  sourceFile.value = null
  sourceSha256.value = ''
  reviewed.value = false
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.name || file.name.length > 255 || file.size < 1 || file.size > 25 * 1024 * 1024) {
    errorCode.value = 'DOCUMENT_EXTRACTION_DOCUMENT_INVALID'
    return
  }
  hashing.value = true
  try {
    sourceSha256.value = await sha256(file)
    sourceFile.value = file
  }
  catch { errorCode.value = 'DOCUMENT_EXTRACTION_DOCUMENT_INVALID' }
  finally { hashing.value = false }
}

async function onProposalSelected(event: Event) {
  errorCode.value = ''
  proposal.value = null
  candidates.value = []
  reviewed.value = false
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    if (file.size < 1 || file.size > DOCUMENT_EXTRACTION_MAX_PROPOSAL_BYTES) throw new Error('DOCUMENT_EXTRACTION_PROPOSAL_FILE_INVALID')
    const parsed = parseDocumentExtractionProposal(await file.text())
    proposal.value = parsed
    candidates.value = cloneDocumentExtractionCandidates(parsed)
  }
  catch (error) { errorCode.value = error instanceof Error ? error.message : 'DOCUMENT_EXTRACTION_JSON_INVALID' }
}

function confidenceLabel(confidence: number | null) {
  if (confidence === null) return t('imports.extraction.confidence.none')
  if (confidence >= 0.85) return t('imports.extraction.confidence.high', { value: Math.round(confidence * 100) })
  if (confidence >= 0.6) return t('imports.extraction.confidence.medium', { value: Math.round(confidence * 100) })
  return t('imports.extraction.confidence.low', { value: Math.round(confidence * 100) })
}

function rejectProposal() {
  sourceFile.value = null
  sourceSha256.value = ''
  proposal.value = null
  candidates.value = []
  reviewed.value = false
  errorCode.value = ''
  if (proposalInput.value) proposalInput.value.value = ''
  if (documentInput.value) documentInput.value.value = ''
}

function acceptProposal() {
  if (!canAccept.value || !proposal.value || !sourceFile.value) return
  emit('accepted', {
    parsed: buildDocumentExtractionRows(proposal.value, candidates.value, {
      fileName: sourceFile.value.name,
      mimeType: sourceFile.value.type,
      sizeBytes: sourceFile.value.size,
      sha256: sourceSha256.value,
    }),
    file: sourceFile.value,
  })
}
return { DOCUMENT_EXTRACTION_MAX_PROPOSAL_BYTES, buildDocumentExtractionRows, cloneDocumentExtractionCandidates, documentExtractionRequiredFieldsComplete, parseDocumentExtractionProposal, emit, t, sourceFile, sourceSha256, proposal, candidates, reviewed, errorCode, hashing, proposalInput, documentInput, fields, requiredComplete, sourceMatches, canAccept, readableError, sha256, onDocumentSelected, onProposalSelected, confidenceLabel, rejectProposal, acceptProposal }
}
