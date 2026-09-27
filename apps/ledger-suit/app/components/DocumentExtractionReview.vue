<script setup lang="ts">
import type { ParsedCsv } from '~/utils/csv'
import type { DocumentExtractionCandidate, DocumentExtractionProposal } from '~/utils/documentExtraction'
import {
  DOCUMENT_EXTRACTION_MAX_PROPOSAL_BYTES,
  buildDocumentExtractionRows,
  cloneDocumentExtractionCandidates,
  documentExtractionRequiredFieldsComplete,
  parseDocumentExtractionProposal,
} from '~/utils/documentExtraction'

const emit = defineEmits<{ accepted: [payload: { parsed: ParsedCsv, file: File }] }>()
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
</script>

<template>
  <section class="ls-card p-6" aria-labelledby="document-extraction-title">
    <h2 id="document-extraction-title" class="text-h2 font-bold">{{ t('imports.extraction.title') }}</h2>
    <p class="mt-2 text-sm text-fg-muted">{{ t('imports.extraction.hint') }}</p>
    <div class="mt-4 rounded-control border border-[var(--bs-status-info)] bg-[var(--bs-status-info-bg)] p-4 text-sm">
      <p class="font-semibold">{{ t('imports.extraction.providerBoundaryTitle') }}</p>
      <p class="mt-1">{{ t('imports.extraction.providerBoundaryBody') }}</p>
    </div>

    <p v-if="errorCode" class="ls-error mt-4" role="alert">{{ readableError(errorCode) }}</p>
    <p v-if="proposal?.source && sourceFile && !sourceMatches" class="ls-error mt-4" role="alert">{{ t('imports.extraction.sourceMismatch') }}</p>

    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      <div>
        <label for="document-source-file" class="font-semibold">{{ t('imports.extraction.documentLabel') }}</label>
        <p class="mt-1 text-xs text-fg-muted">{{ t('imports.extraction.documentHint') }}</p>
        <input id="document-source-file" ref="documentInput" class="ls-input mt-2" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" @change="onDocumentSelected">
        <p v-if="sourceFile" class="mt-2 text-xs text-fg-muted">{{ sourceFile.name }} · {{ sourceFile.size.toLocaleString() }} {{ t('imports.extraction.bytes') }}</p>
      </div>
      <div>
        <label for="document-proposal-file" class="font-semibold">{{ t('imports.extraction.proposalLabel') }}</label>
        <p class="mt-1 text-xs text-fg-muted">{{ t('imports.extraction.proposalHint') }}</p>
        <input id="document-proposal-file" ref="proposalInput" class="ls-input mt-2" type="file" accept="application/json,.json" @change="onProposalSelected">
      </div>
    </div>

    <div v-if="proposal" class="mt-6 space-y-4">
      <article v-for="(candidate, candidateIndex) in candidates" :key="candidateIndex" class="rounded-control border border-[var(--bs-border)] p-4" :aria-labelledby="`document-candidate-${candidateIndex}`">
        <h3 :id="`document-candidate-${candidateIndex}`" class="font-semibold">{{ t('imports.extraction.candidate', { number: candidateIndex + 1 }) }}</h3>
        <ul v-if="candidate.errors.length" class="mt-3 space-y-1 text-sm text-[var(--bs-status-danger)]">
          <li v-for="issue in candidate.errors" :key="`${issue.code}:${issue.message}`"><strong>{{ issue.code }}</strong> — {{ issue.message }}</li>
        </ul>
        <p v-else class="mt-2 text-xs text-fg-muted">{{ t('imports.extraction.noExtractionErrors') }}</p>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div v-for="field in fields" :key="field">
            <FloatingField :label="t(`imports.fields.${field}`)">
              <select v-if="field === 'type'" v-model="candidate.fields[field]!.value" class="ls-input">
                <option value="">{{ t('common.select') }}</option>
                <option value="income">{{ t('types.income') }}</option>
                <option value="expense">{{ t('types.expense') }}</option>
              </select>
              <input v-else v-model="candidate.fields[field]!.value" class="ls-input" type="text">
            </FloatingField>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span :class="candidate.fields[field]!.confidence !== null && candidate.fields[field]!.confidence! < 0.6 ? 'text-[var(--bs-status-danger)]' : 'text-fg-muted'">
                {{ confidenceLabel(candidate.fields[field]!.confidence) }}
              </span>
              <span v-if="candidate.fields[field]!.evidence" class="text-fg-muted">{{ t('imports.extraction.evidence') }}: {{ candidate.fields[field]!.evidence }}</span>
            </div>
          </div>
        </div>
      </article>

      <label class="flex items-start gap-2 rounded-control bg-surface-muted p-4 text-sm">
        <input v-model="reviewed" type="checkbox" class="mt-1">
        <span>{{ t('imports.extraction.attestation') }}</span>
      </label>
      <p v-if="!requiredComplete" class="text-sm text-[var(--bs-status-danger)]">{{ t('imports.extraction.requiredIncomplete') }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="ls-btn" @click="rejectProposal">{{ t('imports.extraction.reject') }}</button>
        <button type="button" class="ls-btn ls-btn-accent" :disabled="!canAccept" @click="acceptProposal">{{ t('imports.extraction.accept') }}</button>
      </div>
    </div>
  </section>
</template>
