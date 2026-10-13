<script setup lang="ts">
import type { BsOpeningBalanceCopy, BsOpeningBalanceView } from '@building-suit/ui/types/openingBalancePresentation'
import type { Database, Json } from '~~/types/database.types'
import { downloadCsv } from '~/utils/csv'
import { openingBalanceTemplate, parseOpeningBalanceCsv, type OpeningSourceRow } from '~/utils/openingBalanceCsv'

definePageMeta({ layout: 'default' })
type Account = Pick<Database['public']['Tables']['accounts']['Row'], 'id'|'code'|'name'|'type'|'account_role'|'is_archived'>
type Batch = Database['public']['Tables']['opening_balance_batches']['Row']
type Validation = {
  valid: boolean
  debit_total_minor: number | string
  credit_total_minor: number | string
  difference_minor: number | string
  errors: string[]
  rows: Array<{ row_id: string, source_row: number, errors: string[] }>
  preview: Array<{ row_id: string, account_id: string, account_code: string | null, account_name: string, debit_minor: number | string, credit_minor: number | string }>
}

const supabase = useSupabaseClient<Database>()
const { currentId, baseCurrency, can } = useTenant()
const { t, locale } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const mode = ref<Database['public']['Enums']['opening_migration_mode']>('year_start')
const cutoff = ref('')
const filename = ref('')
const rows = ref<OpeningSourceRow[]>([])
const batchId = ref<string | null>(null)
const validation = ref<Validation | null>(null)
const postedTransactionId = ref<string | null>(null)
const busy = ref('')
const uploadFailed = ref(false)
const correctionReason = ref('')
const correctionDate = ref('')

watch(currentId, () => {
  mode.value = 'year_start'; cutoff.value = ''; filename.value = ''; rows.value = []
  batchId.value = null; validation.value = null; postedTransactionId.value = null
  busy.value = ''; uploadFailed.value = false; correctionReason.value = ''; correctionDate.value = ''
}, { flush: 'sync' })

useHead({ title: () => `${t('opening.title')} · ${t('app.name')}` })
const key = computed(() => `org:opening-balances:${currentId.value ?? ''}`)
const { data, pending, error, refresh } = useLazyAsyncData(key, async () => {
  if (!currentId.value || !can('opening_balances.read')) return { accounts: [], batches: [] }
  const [accountResult, batchResult] = await Promise.all([
    supabase.from('accounts').select('id,code,name,type,account_role,is_archived').eq('organization_id', currentId.value).order('code'),
    supabase.from('opening_balance_batches').select('*').eq('organization_id', currentId.value).order('created_at', { ascending: false }),
  ])
  if (accountResult.error) throw accountResult.error
  if (batchResult.error) throw batchResult.error
  return { accounts: accountResult.data as Account[], batches: batchResult.data as Batch[] }
}, { default: () => ({ accounts: [] as Account[], batches: [] as Batch[] }) })
const accounts = computed(() => data.value?.accounts ?? [])
const batches = computed(() => data.value?.batches ?? [])
const amount = (value: number | string) => formatMoney(value, baseCurrency.value, locale.value)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`))
const rowErrors = (sourceRow: number) => validation.value?.rows.find(row => row.source_row === sourceRow)?.errors ?? []
const validationLabel = (code: string) => t(`opening.errors.${code}`)

function labels() {
  return { sourceCode: t('opening.sourceCode'), sourceName: t('opening.sourceName'), debit: t('opening.debit'), credit: t('opening.credit'), cashExample: t('opening.cashExample'), equityExample: t('opening.equityExample') }
}
function downloadTemplate() { downloadCsv(`${t('opening.templateFilename')}.csv`, openingBalanceTemplate(labels())) }

async function selectFile(file: File | null) {
  if (busy.value) return
  if (!file || !currentId.value) return
  try {
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) throw new Error('OPENING_FILE_INVALID')
    const parsed = parseOpeningBalanceCsv(await file.text(), labels())
    filename.value = file.name
    rows.value = parsed
    validation.value = null
    postedTransactionId.value = null
    if (!cutoff.value) throw new Error('OPENING_CUTOFF_REQUIRED')
    await uploadRows()
  }
  catch (failure) { uploadFailed.value = rows.value.length > 0; toasts.error(t('opening.errorTitle'), describeError(failure)) }
}

async function uploadRows() {
  if (busy.value || !currentId.value || !cutoff.value || !filename.value || !rows.value.length) return
  busy.value = 'upload'
  uploadFailed.value = false
  try {
    const { data: id, error } = await supabase.rpc('create_opening_balance_batch', {
      p_organization_id: currentId.value, p_migration_mode: mode.value,
      p_cutoff_date: cutoff.value, p_source_filename: filename.value, p_rows: rows.value as unknown as Json,
    })
    if (error) throw error
    batchId.value = id
    await refresh()
  }
  catch (failure) { uploadFailed.value = true; toasts.error(t('opening.errorTitle'), describeError(failure)) }
  finally { busy.value = '' }
}

async function validateBatch() {
  if (busy.value || !batchId.value || !cutoff.value) return
  busy.value = 'validate'
  try {
    const { error: updateError } = await supabase.rpc('update_opening_balance_batch', {
      p_batch_id: batchId.value, p_migration_mode: mode.value, p_cutoff_date: cutoff.value,
      p_source_filename: filename.value, p_rows: rows.value as unknown as Json,
    })
    if (updateError) throw updateError
    const { data: result, error } = await supabase.rpc('validate_opening_balance_batch', { p_batch_id: batchId.value })
    if (error) throw error
    validation.value = result as unknown as Validation
    await refresh()
  }
  catch (failure) { toasts.error(t('opening.errorTitle'), describeError(failure)) }
  finally { busy.value = '' }
}

async function approve() {
  if (busy.value || !batchId.value || !validation.value?.valid) return
  busy.value = 'approve'
  try {
    const { data: transactionId, error } = await supabase.rpc('approve_opening_balance_batch', { p_batch_id: batchId.value })
    if (error) throw error
    postedTransactionId.value = transactionId
    await refresh()
    toasts.success(t('opening.posted'), t('opening.postedBody'))
  }
  catch (failure) { toasts.error(t('opening.errorTitle'), describeError(failure)) }
  finally { busy.value = '' }
}

async function reverse(batch: Batch) {
  if (busy.value || !correctionReason.value.trim()) return
  busy.value = `reverse:${batch.id}`
  try {
    const { error } = await supabase.rpc('reverse_opening_balance_batch', {
      p_batch_id: batch.id, p_reason: correctionReason.value.trim(), p_reversal_date: correctionDate.value || undefined,
    })
    if (error) throw error
    correctionReason.value = ''; correctionDate.value = ''
    await refresh()
    toasts.success(t('opening.correction'), t('opening.reversedBody'))
  }
  catch (failure) { toasts.error(t('opening.errorTitle'), describeError(failure)) }
  finally { busy.value = '' }
}
const ledgerPresentation = useLedgerPresentation()

const openingCopy = computed<BsOpeningBalanceCopy>(() => ({
  common_retry: t('common.retry'),
  common_saving: t('common.saving'),
  opening_approve: t('opening.approve'),
  opening_approver: t('opening.approver'),
  opening_archived: t('opening.archived'),
  opening_blocked: t('opening.blocked'),
  opening_chooseAccount: t('opening.chooseAccount'),
  opening_chooseCsv: t('opening.chooseCsv'),
  opening_correctionReason: t('opening.correctionReason'),
  opening_creator: t('opening.creator'),
  opening_credit: t('opening.credit'),
  opening_creditTotal: t('opening.creditTotal'),
  opening_cutoff: t('opening.cutoff'),
  opening_cutoffHint: t('opening.cutoffHint'),
  opening_debit: t('opening.debit'),
  opening_debitTotal: t('opening.debitTotal'),
  opening_difference: t('opening.difference'),
  opening_downloadTemplate: t('opening.downloadTemplate'),
  opening_empty: t('opening.empty'),
  opening_emptyHint: t('opening.emptyHint'),
  opening_guideChart: t('opening.guideChart'),
  opening_guideHint: t('opening.guideHint'),
  opening_guideMapping: t('opening.guideMapping'),
  opening_guidePeriod: t('opening.guidePeriod'),
  opening_guideTitle: t('opening.guideTitle'),
  opening_history: t('opening.history'),
  opening_ledgerAccount: t('opening.ledgerAccount'),
  opening_loadFailed: t('opening.loadFailed'),
  opening_mapping: t('opening.mapping'),
  opening_mode: t('opening.mode'),
  opening_modes_midyear: t('opening.modes.midyear'),
  opening_modes_year_start: t('opening.modes.year_start'),
  opening_noAccess: t('opening.noAccess'),
  opening_openJournal: t('opening.openJournal'),
  opening_postedLocked: t('opening.postedLocked'),
  opening_preview: t('opening.preview'),
  opening_previewHint: t('opening.previewHint', { date: cutoff.value }),
  opening_reversal: t('opening.reversal'),
  opening_reversalDate: t('opening.reversalDate'),
  opening_reverse: t('opening.reverse'),
  opening_reviewChart: t('opening.reviewChart'),
  opening_reviewPeriods: t('opening.reviewPeriods'),
  opening_rowCount: t('opening.rowCount', { count: rows.value.length }),
  opening_setup: t('opening.setup'),
  opening_sourceAccount: t('opening.sourceAccount'),
  opening_subtitle: t('opening.subtitle'),
  opening_title: t('opening.title'),
  opening_upload: t('opening.upload'),
  opening_valid: t('opening.valid'),
  opening_validate: t('opening.validate'),
  opening_validation: t('opening.validation'),
  opening_validationErrors: t('opening.validationErrors'),
  opening_validationPassed: t('opening.validationPassed'),
}))
const openingMode = computed<string>({ get: () => mode.value, set: value => { if (value === 'year_start' || value === 'midyear') mode.value = value } })
function historyValidation(value: Json | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return { rows: t('opening.rowCount', { count: Number(value.valid_row_count ?? 0) + Number(value.zero_row_count ?? 0) }), debit: amount(String(value.debit_total_minor ?? 0)), credit: amount(String(value.credit_total_minor ?? 0)) }
}
const openingView = computed<BsOpeningBalanceView>(() => ({
  reviewChartTo: '/accounts?setup=templates', reviewPeriodsTo: '/periods', modes: [{ value: 'year_start', label: t('opening.modes.year_start') }, { value: 'midyear', label: t('opening.modes.midyear') }],
  context: ledgerPresentation.context(undefined, undefined, cutoff.value), contextLabel: t('pageContext.label'), canRead: can('opening_balances.read'), canManage: can('opening_balances.manage'), pending: pending.value, loadError: Boolean(error.value),
  posted: Boolean(postedTransactionId.value), filename: filename.value, fileDisabled: !cutoff.value || busy.value === 'upload', uploadFailed: uploadFailed.value, busy: Boolean(busy.value), retryLabel: busy.value === 'upload' ? t('common.saving') : t('common.retry'), validateLabel: busy.value === 'validate' ? t('common.saving') : t('opening.validate'), approveLabel: busy.value === 'approve' ? t('common.saving') : t('opening.approve'), canApprove: can('opening_balances.approve') && !postedTransactionId.value, approveDisabled: !validation.value?.valid || Boolean(busy.value), correctionDisabled: !correctionReason.value.trim() || Boolean(busy.value),
  validation: validation.value ? { valid: validation.value.valid, debit: amount(validation.value.debit_total_minor), credit: amount(validation.value.credit_total_minor), difference: amount(validation.value.difference_minor), errors: validation.value.errors.map(validationLabel), preview: validation.value.preview.map(row => ({ id: row.row_id, account: `${row.account_code} · ${row.account_name}`, debit: amount(row.debit_minor), credit: amount(row.credit_minor) })) } : null,
  rows: rows.value.map(row => ({ sourceRow: row.source_row, sourceCode: row.source_code, sourceName: row.source_name, debit: row.debit, credit: row.credit, accountId: row.account_id, errors: rowErrors(row.source_row).map(validationLabel) })), accounts: accounts.value.map(row => ({ value: row.id, label: `${row.code} · ${row.name} · ${t(`opening.roles.${row.account_role}`)}${row.is_archived ? ` · ${t('opening.archived')}` : ''}` })),
  history: batches.value.map(batch => ({ id: batch.id, status: batch.status, title: `${t(`opening.modes.${batch.migration_mode}`)} · ${date(batch.cutoff_date)}`, subtitle: `${t('opening.revision', { revision: batch.revision })} · ${t(`opening.status.${batch.status}`)}`, journalTo: batch.posted_transaction_id ? `/transactions?q=${encodeURIComponent(batch.posted_transaction_id)}` : null, validation: historyValidation(batch.validation_result), creator: batch.created_by, approver: batch.approved_by, reversalTo: batch.reversal_transaction_id ? `/transactions?q=${encodeURIComponent(batch.reversal_transaction_id)}` : null, reversalId: batch.reversal_transaction_id ?? '', correctionReason: batch.correction_reason ?? '', canCorrect: batch.status === 'posted' && can('opening_balances.correct'), pending: busy.value === `reverse:${batch.id}`, reverseLabel: busy.value === `reverse:${batch.id}` ? t('common.saving') : t('opening.reverse') })), journalTo: postedTransactionId.value ? `/transactions?q=${encodeURIComponent(postedTransactionId.value)}` : '',
}))
function mapOpeningAccount(sourceRow: number, accountId: string | null) { const row = rows.value.find(row => row.source_row === sourceRow); if (row) row.account_id = accountId }
async function reverseOpeningBatch(id: string) { const batch = batches.value.find(batch => batch.id === id); if (batch) await reverse(batch) }
</script>
<template>
  <BsOpeningBalancesPage v-model:mode="openingMode" v-model:cutoff="cutoff" v-model:correction-reason="correctionReason" v-model:correction-date="correctionDate" :copy="openingCopy" :view="openingView" @download-template="downloadTemplate" @file="selectFile" @upload-rows="uploadRows" @validate-batch="validateBatch" @approve="approve" @reverse="reverseOpeningBatch" @map-account="mapOpeningAccount" />
</template>
