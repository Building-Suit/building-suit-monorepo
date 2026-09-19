<script setup lang="ts">
import type { Database, Json } from '~~/types/database.types'
import { parseCsv, downloadCsv } from '~/utils/csv'

const visible = defineModel<boolean>('visible', { default: false })
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

const REQUIRED_FIELDS = CSV_REQUIRED_FIELDS
const ALL_FIELDS = CSV_IMPORT_FIELDS
const METRICS = ['total_rows', 'valid_rows', 'invalid_rows', 'posted_rows', 'duplicate_rows', 'failed_rows'] as const

const phase = ref<Phase>('upload')
const busy = ref<BusyAction>('')
const filename = ref('')
const headers = ref<string[]>([])
const sourceRows = ref<Record<string, string>[]>([])
const mapping = reactive<Record<string, string>>(Object.fromEntries(ALL_FIELDS.map(field => [field, ''])))
const batch = ref<Batch | null>(null)
const resultRows = ref<ImportRow[]>([])
const errorMessage = ref('')

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
const displayRows = computed<DisplayRow[]>(() => resultRows.value.map((row) => {
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
  headers.value = []
  sourceRows.value = []
  batch.value = null
  resultRows.value = []
  errorMessage.value = ''
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
  return describeError(error)
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
    const parsed = parseCsv(text)
    if (parsed.rows.length > 10_000) throw new Error('CSV_FILE_INVALID')
    filename.value = file.name
    headers.value = parsed.headers
    sourceRows.value = parsed.rows
    Object.assign(mapping, matchCsvColumns(parsed.headers, translations))
    phase.value = 'mapping'
  }
  catch (error) {
    if (isCurrent(version, requestScope)) errorMessage.value = readableError(error)
  }
}

async function loadBatch(batchId: string, version: number, requestScope: string) {
  const [batchResult, rowsResult] = await Promise.all([
    supabase.from('import_batches').select('*').eq('id', batchId).abortSignal(reads.signal).single(),
    supabase.from('import_rows')
      .select('id,row_number,status,raw_data,error_code,transaction_id')
      .eq('batch_id', batchId).order('row_number').range(0, 99).abortSignal(reads.signal),
  ])
  if (!isCurrent(version, requestScope)) return false
  if (batchResult.error) throw batchResult.error
  if (rowsResult.error) throw rowsResult.error
  batch.value = batchResult.data
  resultRows.value = (rowsResult.data ?? []) as unknown as ImportRow[]
  return true
}

async function validateImport() {
  if (!currentId.value || !can('imports.create') || !writesAllowed.value || !importsEnabled.value || !requiredMappingComplete.value || busy.value) return
  const version = generation
  const requestScope = scope.value
  const organizationId = currentId.value
  const prepared = prepareCsvImport(sourceRows.value, mapping, translations)
  busy.value = 'validating'
  errorMessage.value = ''
  try {
    const { data: batchId, error: createError } = await supabase.rpc('create_csv_import_batch', {
      p_organization_id: organizationId, p_filename: filename.value, p_rows: prepared.rows as Json,
    })
    if (!isCurrent(version, requestScope)) return
    if (createError) throw createError
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

const { dirty, markSaved } = useRecordAction(() => ({ filename: filename.value, mapping: { ...mapping } }), visible)
onMounted(markSaved)
</script>

<template>
  <BsDialog v-model:visible="visible" :title="t('imports.title')" size="lg" :dirty="phase !== 'results' && dirty" :pending="!!busy">
    <template #default="{ close }">
  <div class="space-y-5">
    <p class="text-sm text-fg-muted">{{ t('imports.subtitle') }}</p>
    <SectionSkeleton v-if="featurePending" variant="cards" />

    <div v-else-if="!can('imports.create') || !writesAllowed" class="ls-card p-6">
      <h2 class="font-semibold">{{ t('imports.noPermissionTitle') }}</h2>
      <p class="mt-2 text-sm text-fg-muted">{{ t('imports.noPermissionBody') }}</p>
    </div>

    <div v-else-if="!importsEnabled" class="ls-card p-6">
      <h2 class="font-semibold">{{ t('imports.upgradeTitle') }}</h2>
      <p class="mt-2 text-sm text-fg-muted">{{ t('imports.upgradeBody') }}</p>
      <NuxtLink v-if="can('billing.manage')" to="/billing" class="ls-btn ls-btn-accent mt-5">
        {{ t('imports.viewPlans') }}
      </NuxtLink>
    </div>

    <template v-else>
      <ol class="grid grid-cols-3 gap-2 sm:grid-cols-5" :aria-label="t('imports.progress')">
        <li
          v-for="(step, index) in steps"
          :key="step.key"
          class="rounded-control border px-3 py-2 text-sm"
          :class="step.done ? 'border-[var(--bs-status-success)] bg-[var(--bs-status-success-bg)]' : 'border-[var(--bs-border)] text-fg-muted'"
        >
          <span class="font-semibold">{{ index + 1 }}</span> · {{ t(`imports.steps.${step.key}`) }}
        </li>
      </ol>

      <p v-if="errorMessage" class="ls-error" role="alert">{{ errorMessage }}</p>

      <section v-if="phase === 'upload'" class="ls-card p-6">
        <h2 class="text-h2 font-bold">{{ t('imports.uploadTitle') }}</h2>
        <p class="mt-2 text-sm text-fg-muted">{{ t('imports.uploadHint') }}</p>
        <label class="ls-btn ls-btn-accent mt-5 cursor-pointer" for="csv-file">
          {{ t('imports.chooseFile') }}
        </label>
        <button type="button" class="ls-btn mt-5 ms-2" @click="downloadTemplate">{{ t('csv.downloadTemplate') }}</button>
        <p class="mt-3 text-sm text-fg-muted">{{ t('csv.templateHint') }}</p>
        <p class="mt-2 text-sm text-fg-muted">{{ t('csv.languageHint') }}</p>
        <input id="csv-file" class="sr-only" type="file" accept=".csv,text/csv" @change="onFileSelected">
        <p class="mt-4 text-xs text-fg-muted">{{ t('imports.formatHint') }}</p>
      </section>

      <template v-else>
        <section v-if="phase === 'mapping'" class="ls-card p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="text-h2 font-bold">{{ t('imports.mappingTitle') }}</h2>
              <p class="mt-1 text-sm text-fg-muted">{{ t('imports.fileSummary', { filename, count: sourceRows.length }) }}</p>
            </div>
            <button type="button" class="ls-btn ls-btn-sm" :disabled="!!busy" @click="reset">{{ t('imports.changeFile') }}</button>
          </div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FloatingField v-for="field in ALL_FIELDS" :key="field" :label="t(`imports.fields.${field}`)">
              <select v-model="mapping[field]" class="ls-input" :aria-required="isRequiredField(field)" :disabled="!!busy">
                <option value="">{{ isRequiredField(field) ? t('imports.selectColumn') : t('common.none') }}</option>
                <option v-for="header in headers" :key="header" :value="header" :disabled="Object.values(mapping).includes(header) && mapping[field] !== header">{{ header }}</option>
              </select>
            </FloatingField>
          </div>
        </section>

        <section v-if="phase === 'mapping'" class="ls-card overflow-hidden">
          <div class="p-4"><h2 class="font-semibold">{{ t('imports.previewTitle') }}</h2></div>
          <div class="overflow-x-auto">
            <BsDataTable :value="previewRows"><Column v-for="header in headers" :key="header" :field="header" :header="header"><template #body="{ data: row }">{{ row[header] || t('common.dash') }}</template></Column></BsDataTable>
          </div>
          <div class="flex justify-end border-t border-[var(--bs-border)] p-4">
            <button type="button" class="ls-btn ls-btn-accent" :disabled="!requiredMappingComplete || !!busy" @click="validateImport">
              {{ busy === 'validating' ? t('imports.validating') : t('imports.validate') }}
            </button>
          </div>
        </section>

        <section v-if="batch && (phase === 'validated' || phase === 'results')" class="space-y-4">
          <div class="ls-card p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 class="text-h2 font-bold">{{ phase === 'results' ? t('imports.resultsTitle') : t('imports.validationTitle') }}</h2>
                <p class="mt-1 text-sm text-fg-muted">{{ filename }}</p>
              </div>
              <StatusBadge :status="batch.status" />
            </div>
            <dl class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div v-for="metric in METRICS" :key="metric" class="rounded-control bg-surface-muted p-3">
                <dt class="text-xs text-fg-muted">{{ t(`imports.metrics.${metric}`) }}</dt>
                <dd class="mt-1 text-xl font-bold">{{ batch[metric] }}</dd>
              </div>
            </dl>
            <QuotaUsageMeter v-if="phase === 'validated'" quota-key="max_monthly_transactions" compact class="mt-5" />
            <div class="mt-5 flex flex-wrap justify-end gap-2">
              <button v-if="phase === 'results'" type="button" class="ls-btn" @click="reset">{{ t('imports.importAnother') }}</button>
              <button v-else type="button" class="ls-btn" :disabled="!!busy" @click="reset">{{ t('imports.startOver') }}</button>
              <button v-if="phase === 'validated' && canConfirm" type="button" class="ls-btn ls-btn-accent" :disabled="!!busy" @click="confirmImport">
                {{ busy === 'confirming' ? t('imports.confirming') : t('imports.confirm') }}
              </button>
            </div>
          </div>

          <div class="ls-card overflow-hidden">
            <div class="overflow-x-auto">
              <BsDataTable :value="displayRows" data-key="id" :label="t('imports.rowsCaption')">
  <Column >
    <template #header>{{ t('imports.row') }}</template>
    <template #body="{ data: row }">{{ row.rowNumber }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.status') }}</template>
    <template #body="{ data: row }"><StatusBadge :status="row.status" /></template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.type') }}</template>
    <template #body="{ data: row }">{{ row.typeValue }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.date') }}</template>
    <template #body="{ data: row }">{{ row.dateValue }}</template>
  </Column>
  <Column >
    <template #header>{{ t('transactions.amount') }}</template>
    <template #body="{ data: row }">{{ row.amountValue }}</template>
  </Column>
  <Column body-class="max-w-80 text-xs text-fg-muted">
    <template #header>{{ t('imports.issue') }}</template>
    <template #body="{ data: row }">{{ row.issue || t('common.dash') }}</template>
  </Column>
</BsDataTable>
            </div>
            <p v-if="batch.total_rows > resultRows.length" class="border-t border-[var(--bs-border)] p-3 text-xs text-fg-muted">{{ t('imports.firstRows', { count: resultRows.length }) }}</p>
          </div>
        </section>
      </template>
    </template>
    <div class="flex justify-end border-t border-line pt-4"><button type="button" class="ls-btn" :disabled="!!busy" @click="close">{{ t('csv.close') }}</button></div>
  </div>
    </template>
  </BsDialog>
</template>
