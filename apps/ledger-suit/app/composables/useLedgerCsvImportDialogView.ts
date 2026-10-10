import type { Database, Json } from '~~/types/database.types'
import type { ParsedCsv } from '~/utils/csv'
import { parseCsv, parseSpreadsheetPaste, downloadCsv } from '~/utils/csv'
import { documentExtractionImportFilename } from '~/utils/documentExtraction'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerCsvImportDialogView(_values: (Record<string, unknown>) & { visible?: unknown }, _emit: (event: string, ...args: unknown[]) => void) {
const visible = computed<boolean>({ get: () => (_values.visible ?? false) as boolean, set: value => _emit('update:visible', value) })
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { writesAllowed } = useBilling()
const { markChanged } = useAddTransaction()

const supabase = useSupabaseClient<Database>()
const { currentId, can, baseCurrency } = useTenant()
const { t, te } = useI18n()
const translations = (['en', 'ar'] as const).map(language => (key: string) => t(key, {}, { locale: language }))
const describeError = useErrorMessage()
const { refresh: refreshPlanUsage } = usePlanUsage()
const { data: importsEnabled, pending: featurePending } = usePlanFeature('imports')

const scope = computed(() => `${user.value?.id ?? ''}:${currentId.value ?? ''}`)
let generation = 0
let reads = new AbortController()
const isCurrent = (version: number, requestScope: string) => version === generation && requestScope === scope.value && visible.value
watch(scope, () => { visible.value = false; reset() }, { flush: 'sync' })
watch(visible, opened => { if (!opened) reset() }, { flush: 'sync' })
onBeforeUnmount(() => { generation++; reads.abort() })

interface Batch {
  id: string
  filename: string
  status: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  posted_rows: number
  duplicate_rows: number
  failed_rows: number
}
interface ImportRow {
  id: string
  row_number: number
  status: string
  raw_data: Record<string, string>
  error_code: string | null
  transaction_id: string | null
}
interface DisplayRow {
  id: string
  rowNumber: number
  status: string
  issue: string
  typeValue: string
  dateValue: string
  amountValue: string
}
type Phase = 'upload' | 'mapping' | 'validated' | 'results'
type BusyAction = '' | 'validating' | 'confirming'
type ReviewFilter = 'all' | 'ready' | 'issues' | 'duplicates'

const REQUIRED_FIELDS = CSV_REQUIRED_FIELDS
const ALL_FIELDS = CSV_IMPORT_FIELDS
const METRICS = ['total_rows', 'valid_rows', 'invalid_rows', 'posted_rows', 'duplicate_rows', 'failed_rows'] as const

const phase = ref<Phase>('upload')
const busy = ref<BusyAction>('')
const filename = ref('')
const pasteText = ref('')
const headers = ref<string[]>([])
const sourceRows = ref<Record<string, string>[]>([])
const mapping = reactive<Record<string, string>>(Object.fromEntries(ALL_FIELDS.map(field => [field, ''])))
const batch = ref<Batch | null>(null)
const resultRows = ref<ImportRow[]>([])
const errorMessage = ref('')
const extractionFile = ref<File | null>(null)
const stagedBatchId = ref<string | null>(null)
const extractionAttachmentCommitted = ref(false)
const reviewFilter = ref<ReviewFilter>('all')
const reviewPage = ref(1)
const REVIEW_PAGE_SIZE = 100

const previewRows = computed(() => sourceRows.value.slice(0, 5))
const requiredMappingComplete = computed(() => REQUIRED_FIELDS.every(field => mapping[field]))
const canConfirm = computed(() => Boolean(batch.value && (
  batch.value.valid_rows > 0
  || (batch.value.total_rows > 0 && batch.value.duplicate_rows === batch.value.total_rows)
)))
const steps = computed(() => [
  { key: 'upload', done: phase.value !== 'upload' },
  { key: 'mapping', done: ['validated', 'results'].includes(phase.value) },
  { key: 'validation', done: ['validated', 'results'].includes(phase.value) },
  { key: 'confirmation', done: phase.value === 'results' },
  { key: 'results', done: phase.value === 'results' },
])
const filteredResultRows = computed(() => resultRows.value.filter((row) => {
  if (reviewFilter.value === 'ready') return ['valid', 'posted'].includes(row.status)
  if (reviewFilter.value === 'issues') return ['invalid', 'failed'].includes(row.status)
  if (reviewFilter.value === 'duplicates') return row.status === 'duplicate'
  return true
}))
const reviewPageCount = computed(() => Math.max(1, Math.ceil(filteredResultRows.value.length / REVIEW_PAGE_SIZE)))
const visibleResultRows = computed(() => filteredResultRows.value.slice((reviewPage.value - 1) * REVIEW_PAGE_SIZE, reviewPage.value * REVIEW_PAGE_SIZE))
const reviewRangeStart = computed(() => filteredResultRows.value.length ? (reviewPage.value - 1) * REVIEW_PAGE_SIZE + 1 : 0)
const reviewRangeEnd = computed(() => Math.min(reviewPage.value * REVIEW_PAGE_SIZE, filteredResultRows.value.length))
const reviewCounts = computed(() => ({
  all: resultRows.value.length,
  ready: resultRows.value.filter(row => ['valid', 'posted'].includes(row.status)).length,
  issues: resultRows.value.filter(row => ['invalid', 'failed'].includes(row.status)).length,
  duplicates: resultRows.value.filter(row => row.status === 'duplicate').length,
}))
const displayRows = computed<DisplayRow[]>(() => visibleResultRows.value.map((row) => {
  const raw = row.raw_data
  return {
    id: row.id,
    rowNumber: row.row_number,
    status: row.status,
    issue: localizedIssue(row.error_code),
    typeValue: mapping.type ? localizedType(raw[mapping.type] ?? '') : '',
    dateValue: mapping.date ? (raw[mapping.date] ?? '') : '',
    amountValue: mapping.amount ? (raw[mapping.amount] ?? '') : '',
  }
}))
watch(reviewFilter, () => { reviewPage.value = 1 })

function localizedType(value: string) {
  const type = csvImportType(value, translations)
  return ['income', 'expense'].includes(type) ? t(`types.${type}`) : value
}

function downloadTemplate() {
  downloadCsv(`${t('csv.filenames.template')}.csv`, csvImportTemplate(t, baseCurrency.value, new Date().toISOString().slice(0, 10)))
}

function isRequiredField(field: string) {
  return REQUIRED_FIELDS.some(required => required === field)
}

function localizedIssue(errorCode: string | null) {
  if (!errorCode) return ''
  const key = `imports.issues.${errorCode}`
  return te(key) ? t(key) : t('imports.issues.generic')
}

function reset() {
  generation++
  reads.abort()
  reads = new AbortController()
  phase.value = 'upload'
  busy.value = ''
  filename.value = ''
  pasteText.value = ''
  headers.value = []
  sourceRows.value = []
  batch.value = null
  resultRows.value = []
  errorMessage.value = ''
  extractionFile.value = null
  stagedBatchId.value = null
  extractionAttachmentCommitted.value = false
  reviewFilter.value = 'all'
  reviewPage.value = 1
  for (const field of ALL_FIELDS) mapping[field] = ''
}

function readableError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  if (message.includes('CSV_NO_DATA')) return t('imports.errors.noData')
  if (message.includes('CSV_HEADERS_INVALID')) return t('imports.errors.headers')
  if (message.includes('CSV_ROW_WIDTH_INVALID')) return t('imports.errors.rowWidth')
  if (message.includes('CSV_UNCLOSED_QUOTE')) return t('imports.errors.quote')
  if (message.includes('CSV_FILE_INVALID')) return t('imports.errors.file')
  if (message.includes('SPREADSHEET_TABS_REQUIRED')) return t('imports.errors.pasteTabs')
  return describeError(error)
}

function useParsedRows(parsed: ParsedCsv, sourceName: string) {
  if (parsed.rows.length > 10_000) throw new Error('CSV_FILE_INVALID')
  filename.value = sourceName
  headers.value = parsed.headers
  sourceRows.value = parsed.rows
  Object.assign(mapping, matchCsvColumns(parsed.headers, translations))
  phase.value = 'mapping'
}

async function onFileSelected(event: Event) {
  reset()
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const version = generation
  const requestScope = scope.value
  try {
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) {
      throw new Error('CSV_FILE_INVALID')
    }
    const text = await file.text()
    if (!isCurrent(version, requestScope)) return
    useParsedRows(parseCsv(text), file.name)
  }
  catch (error) {
    if (isCurrent(version, requestScope)) errorMessage.value = readableError(error)
  }
}

function usePastedRows() {
  errorMessage.value = ''
  try {
    if (new TextEncoder().encode(pasteText.value).byteLength > 5 * 1024 * 1024) throw new Error('CSV_FILE_INVALID')
    useParsedRows(parseSpreadsheetPaste(pasteText.value), t('imports.pasteFilename'))
  }
  catch (error) { errorMessage.value = readableError(error) }
}

function useExtractedRows(payload: { parsed: ParsedCsv, file: File }) {
  errorMessage.value = ''
  extractionFile.value = payload.file
  useParsedRows(payload.parsed, documentExtractionImportFilename(payload.file.name))
}

function onPasteKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') usePastedRows()
}

async function loadBatch(batchId: string, version: number, requestScope: string) {
  const batchResult = await supabase.from('import_batches').select('*').eq('id', batchId).abortSignal(reads.signal).single()
  if (!isCurrent(version, requestScope)) return false
  if (batchResult.error) throw batchResult.error
  batch.value = batchResult.data
  const rowRequests = []
  for (let start = 0; start < batchResult.data.total_rows; start += 1000) {
    rowRequests.push(supabase.from('import_rows')
      .select('id,row_number,status,raw_data,error_code,transaction_id')
      .eq('batch_id', batchId)
      .order('row_number')
      .range(start, Math.min(start + 999, batchResult.data.total_rows - 1))
      .abortSignal(reads.signal))
  }
  const rowResults = await Promise.all(rowRequests)
  if (!isCurrent(version, requestScope)) return false
  const rowError = rowResults.find(result => result.error)?.error
  if (rowError) throw rowError
  resultRows.value = rowResults.flatMap(result => result.data ?? []) as unknown as ImportRow[]
  reviewPage.value = 1
  return true
}

async function uploadImportAttachment(batchId: string, organizationId: string) {
  const file = extractionFile.value
  if (!file || extractionAttachmentCommitted.value) return
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const key = `${organizationId}/import/${batchId}/${crypto.randomUUID()}.${extension}`
  const { data: reservationId, error: reserveError } = await supabase.rpc('reserve_attachment_upload', {
    p_organization_id: organizationId,
    p_entity_type: 'import',
    p_entity_id: batchId,
    p_file_name: file.name,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_storage_key: key,
  })
  if (reserveError || !reservationId) throw reserveError ?? new Error('ATTACHMENT_RESERVATION_NOT_FOUND')

  const { error: uploadError } = await supabase.storage.from('attachments').upload(key, file, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    await supabase.rpc('abort_attachment_upload', { p_reservation_id: reservationId })
    throw uploadError
  }

  let { error: commitError } = await supabase.rpc('commit_attachment_upload', { p_reservation_id: reservationId })
  if (commitError) {
    const retry = await supabase.rpc('commit_attachment_upload', { p_reservation_id: reservationId })
    commitError = retry.error
  }
  if (commitError) {
    await supabase.storage.from('attachments').remove([key])
    await supabase.rpc('abort_attachment_upload', { p_reservation_id: reservationId })
    throw commitError
  }
  extractionAttachmentCommitted.value = true
  await refreshPlanUsage()
}

async function validateImport() {
  if (!currentId.value || !can('imports.create') || !writesAllowed.value || !importsEnabled.value || !requiredMappingComplete.value || busy.value) return
  if (extractionFile.value && !can('attachments.create')) return
  const version = generation
  const requestScope = scope.value
  const organizationId = currentId.value
  const prepared = prepareCsvImport(sourceRows.value, mapping, translations)
  busy.value = 'validating'
  errorMessage.value = ''
  try {
    let batchId = stagedBatchId.value
    if (!batchId) {
      const { data, error: createError } = await supabase.rpc('create_csv_import_batch', {
        p_organization_id: organizationId, p_filename: filename.value, p_rows: prepared.rows as Json,
      })
      if (!isCurrent(version, requestScope)) return
      if (createError) throw createError
      batchId = data
      stagedBatchId.value = data
    }
    if (!batchId) throw new Error('IMPORT_BATCH_NOT_FOUND')
    await uploadImportAttachment(batchId, organizationId)
    if (!isCurrent(version, requestScope)) return
    const { error: validationError } = await supabase.rpc('validate_csv_import_batch', {
      p_batch_id: batchId, p_mapping: prepared.mapping,
    })
    if (!isCurrent(version, requestScope)) return
    if (validationError) throw validationError
    if (await loadBatch(batchId, version, requestScope)) phase.value = 'validated'
  }
  catch (error) { if (isCurrent(version, requestScope)) errorMessage.value = readableError(error) }
  finally { if (isCurrent(version, requestScope)) busy.value = '' }
}

async function confirmImport() {
  if (!batch.value || !canConfirm.value || !can('imports.create') || !writesAllowed.value || !importsEnabled.value || busy.value) return
  const version = generation
  const requestScope = scope.value
  const batchId = batch.value.id
  busy.value = 'confirming'
  errorMessage.value = ''
  try {
    const { error } = await supabase.rpc('confirm_csv_import_batch', { p_batch_id: batchId })
    if (!isCurrent(version, requestScope)) return
    if (error) throw error
    await refreshPlanUsage()
    if (!isCurrent(version, requestScope)) return
    if (await loadBatch(batchId, version, requestScope)) {
      phase.value = 'results'
      markSaved()
      markChanged()
      const keys = Object.keys(nuxtApp.payload.data).filter(key => key.startsWith('org:') && !key.startsWith('org:record-page:'))
      await nuxtApp.runWithContext(() => refreshNuxtData(keys))
    }
  }
  catch (error) { if (isCurrent(version, requestScope)) errorMessage.value = readableError(error) }
  finally { if (isCurrent(version, requestScope)) busy.value = '' }
}

const { dirty, markSaved } = useRecordAction(() => ({ filename: filename.value, pasteText: pasteText.value, extractionFile: extractionFile.value?.name ?? '', mapping: { ...mapping } }), visible)
onMounted(markSaved)
const ledgerUsage = useLedgerUsagePresentation()
return { visible, parseCsv, parseSpreadsheetPaste, downloadCsv, documentExtractionImportFilename, nuxtApp, user, writesAllowed, markChanged, supabase, currentId, can, baseCurrency, t, te, translations, describeError, refreshPlanUsage, importsEnabled, featurePending, scope, generation, reads, isCurrent, REQUIRED_FIELDS, ALL_FIELDS, METRICS, phase, busy, filename, pasteText, headers, sourceRows, mapping, batch, resultRows, errorMessage, extractionFile, stagedBatchId, extractionAttachmentCommitted, reviewFilter, reviewPage, REVIEW_PAGE_SIZE, previewRows, requiredMappingComplete, canConfirm, steps, filteredResultRows, reviewPageCount, visibleResultRows, reviewRangeStart, reviewRangeEnd, reviewCounts, displayRows, localizedType, downloadTemplate, isRequiredField, localizedIssue, reset, readableError, useParsedRows, onFileSelected, usePastedRows, useExtractedRows, onPasteKeydown, loadBatch, uploadImportAttachment, validateImport, confirmImport, dirty, markSaved, ledgerUsage }
}
