<script setup lang="ts">
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

async function selectFile(event: Event) {
  if (busy.value) return
  const file = (event.target as HTMLInputElement).files?.[0]
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
</script>

<template>
  <div class="space-y-6" data-opening-workflow>
    <BsPageHeader :title="t('opening.title')" :subtitle="t('opening.subtitle')" :context="ledgerPresentation.context(undefined, undefined, cutoff)" :context-label="ledgerPresentation.t('pageContext.label')" />
    <p v-if="!can('opening_balances.read')" class="ls-card p-6 text-fg-muted">{{ t('opening.noAccess') }}</p>
    <p v-else-if="error" class="ls-error" role="alert">{{ t('opening.loadFailed') }}</p>
    <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
    <template v-else>
      <section class="ls-card space-y-3 p-5" aria-labelledby="opening-readiness-guide" data-opening-readiness-guide>
        <h2 id="opening-readiness-guide" class="text-h2 font-bold">{{ t('opening.guideTitle') }}</h2>
        <p class="text-sm text-fg-muted">{{ t('opening.guideHint') }}</p>
        <ul class="list-disc space-y-1 ps-5 text-sm">
          <li>{{ t('opening.guideChart') }}</li>
          <li>{{ t('opening.guidePeriod') }}</li>
          <li>{{ t('opening.guideMapping') }}</li>
        </ul>
        <div class="flex flex-wrap gap-2">
          <NuxtLink to="/accounts?setup=templates" class="ls-btn ls-btn-sm">{{ t('opening.reviewChart') }}</NuxtLink>
          <NuxtLink to="/periods" class="ls-btn ls-btn-sm">{{ t('opening.reviewPeriods') }}</NuxtLink>
        </div>
      </section>
      <section v-if="can('opening_balances.manage')" class="ls-card space-y-5 p-5" aria-labelledby="opening-setup">
        <div><h2 id="opening-setup" class="text-h2 font-bold">1. {{ t('opening.setup') }}</h2><p class="text-sm text-fg-muted">{{ t('opening.cutoffHint') }}</p></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <BsFloatingField :label="t('opening.mode')"><select id="opening-mode" v-model="mode" class="ls-input" :disabled="!!postedTransactionId"><option value="year_start">{{ t('opening.modes.year_start') }}</option><option value="midyear">{{ t('opening.modes.midyear') }}</option></select></BsFloatingField>
          <BsFloatingField :label="t('opening.cutoff')"><input id="opening-cutoff" v-model="cutoff" class="ls-input" type="date" required :disabled="!!postedTransactionId"></BsFloatingField>
        </div>
        <div class="border-t border-line pt-4">
          <h2 class="text-h2 font-bold">2. {{ t('opening.upload') }}</h2>
          <div class="mt-3 flex flex-wrap gap-2"><label class="ls-btn ls-btn-primary cursor-pointer" for="opening-file">{{ t('opening.chooseCsv') }}</label><BsButton type="button" class="ls-btn" @click="downloadTemplate">{{ t('opening.downloadTemplate') }}</BsButton></div>
          <input id="opening-file" class="sr-only" type="file" accept=".csv,text/csv" :disabled="!cutoff || busy==='upload'" @change="selectFile">
          <p v-if="filename" class="mt-2 text-sm text-fg-muted">{{ filename }} · {{ t('opening.rowCount', { count: rows.length }) }}</p>
          <BsButton v-if="uploadFailed" type="button" class="ls-btn mt-2" :disabled="Boolean(busy)" @click="uploadRows">{{ busy === 'upload' ? t('common.saving') : t('common.retry') }}</BsButton>
        </div>
      </section>

      <section v-if="rows.length" class="ls-card space-y-4 overflow-x-auto p-5" aria-labelledby="opening-mapping">
        <h2 id="opening-mapping" class="text-h2 font-bold">3. {{ t('opening.mapping') }}</h2>
        <BsDataTable :value="rows" row-key="source_row" :label="t('opening.mapping')" :table-style="{ minWidth: '760px' }" :columns="[{ key: 'source_row', field: 'source_row', header: '#' }, { key: 'column2', header: t('opening.sourceAccount') }, { key: 'column3', header: t('opening.debit') }, { key: 'column4', header: t('opening.credit') }, { key: 'column5', header: t('opening.ledgerAccount') }, { key: 'column6', header: t('opening.validationErrors') }]">
          <template #cell-column2="{ row }"><strong>{{ row.source_code }}</strong><br><span class="text-fg-muted">{{ row.source_name }}</span></template>
          <template #cell-column3="{ row }">{{ row.debit || '—' }}</template>
          <template #cell-column4="{ row }">{{ row.credit || '—' }}</template>
          <template #cell-column5="{ row }"><select v-model="row.account_id" class="ls-input min-w-64" :aria-label="`${t('opening.ledgerAccount')} ${row.source_row}`"><option :value="null">{{ t('opening.chooseAccount') }}</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.code }} · {{ account.name }} · {{ t(`opening.roles.${account.account_role}`) }}<template v-if="account.is_archived"> · {{ t('opening.archived') }}</template></option></select></template>
          <template #cell-column6="{ row }"><ul v-if="rowErrors(row.source_row).length" class="text-danger"><li v-for="code in rowErrors(row.source_row)" :key="code">{{ validationLabel(code) }}</li></ul><span v-else-if="validation" class="text-success">{{ t('opening.valid') }}</span></template>

        </BsDataTable>
        <BsButton type="button" class="ls-btn ls-btn-primary" :disabled="Boolean(busy)" @click="validateBatch">{{ busy === 'validate' ? t('common.saving') : t('opening.validate') }}</BsButton>
      </section>

      <section v-if="validation" class="ls-card space-y-4 p-5" aria-labelledby="opening-validation" :data-validation="validation.valid ? 'valid' : 'invalid'">
        <h2 id="opening-validation" class="text-h2 font-bold">4. {{ t('opening.validation') }}</h2>
        <div class="grid gap-3 sm:grid-cols-3"><p><span class="text-fg-muted">{{ t('opening.debitTotal') }}</span><br><strong>{{ amount(validation.debit_total_minor) }}</strong></p><p><span class="text-fg-muted">{{ t('opening.creditTotal') }}</span><br><strong>{{ amount(validation.credit_total_minor) }}</strong></p><p><span class="text-fg-muted">{{ t('opening.difference') }}</span><br><strong>{{ amount(validation.difference_minor) }}</strong></p></div>
        <div v-if="validation.errors.length" class="ls-error" role="alert"><p class="font-semibold">{{ t('opening.blocked') }}</p><ul class="mt-2 list-disc ps-5"><li v-for="code in validation.errors" :key="code">{{ validationLabel(code) }}</li></ul></div>
        <div v-else class="rounded-control bg-surface-muted p-3 text-success" role="status">{{ t('opening.validationPassed') }}</div>
      </section>

      <section v-if="validation?.preview.length" class="ls-card space-y-4 overflow-x-auto p-5" aria-labelledby="opening-preview">
        <h2 id="opening-preview" class="text-h2 font-bold">5. {{ t('opening.preview') }}</h2><p class="text-sm text-fg-muted">{{ t('opening.previewHint', { date: cutoff }) }}</p>
        <BsDataTable :value="validation.preview" row-key="row_id" :label="t('opening.preview')" :table-style="{ minWidth: '620px' }" :columns="[{ key: 'column1', header: t('opening.ledgerAccount') }, { key: 'column2', header: t('opening.debit'), align: 'end' as const }, { key: 'column3', header: t('opening.credit'), align: 'end' as const }]">
          <template #cell-column1="{ row: line }">{{ line.account_code }} · {{ line.account_name }}</template>
          <template #cell-column2="{ row: line }">{{ amount(line.debit_minor) }}</template>
          <template #cell-column3="{ row: line }">{{ amount(line.credit_minor) }}</template>

        </BsDataTable>
        <BsButton v-if="can('opening_balances.approve') && !postedTransactionId" type="button" class="ls-btn ls-btn-primary" :disabled="!validation.valid || Boolean(busy)" @click="approve">{{ busy === 'approve' ? t('common.saving') : t('opening.approve') }}</BsButton>
        <div v-if="postedTransactionId" class="rounded-control bg-surface-muted p-4" data-opening-posted><strong>{{ t('opening.postedLocked') }}</strong><br><NuxtLink class="text-link underline" :to="{ path: '/transactions', query: { q: postedTransactionId } }">{{ t('opening.openJournal') }}</NuxtLink></div>
      </section>

      <section class="ls-card space-y-4 p-5" aria-labelledby="opening-history"><h2 id="opening-history" class="text-h2 font-bold">{{ t('opening.history') }}</h2><BsEmptyState v-if="!batches.length" :title="t('opening.empty')" :description="t('opening.emptyHint')" />
        <article v-for="batch in batches" :key="batch.id" class="rounded-control border border-line p-4" :data-batch-status="batch.status"><div class="flex flex-wrap justify-between gap-3"><div><strong>{{ t(`opening.modes.${batch.migration_mode}`) }} · {{ date(batch.cutoff_date) }}</strong><p class="text-sm text-fg-muted">{{ t('opening.revision', { revision: batch.revision }) }} · {{ t(`opening.status.${batch.status}`) }}</p></div><NuxtLink v-if="batch.posted_transaction_id" class="text-link underline" :to="{ path: '/transactions', query: { q: batch.posted_transaction_id } }">{{ t('opening.openJournal') }}</NuxtLink></div>
          <div v-if="batch.validation_result" class="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>{{ t('opening.rowCount', { count: (batch.validation_result as any).valid_row_count + (batch.validation_result as any).zero_row_count }) }}</span><span>{{ t('opening.debit') }}: {{ amount((batch.validation_result as any).debit_total_minor) }}</span><span>{{ t('opening.credit') }}: {{ amount((batch.validation_result as any).credit_total_minor) }}</span></div>
          <p class="mt-2 break-all text-xs text-fg-muted">{{ t('opening.creator') }}: {{ batch.created_by }}<template v-if="batch.approved_by"> · {{ t('opening.approver') }}: {{ batch.approved_by }}</template></p>
          <p v-if="batch.reversal_transaction_id" class="mt-2 text-sm">{{ t('opening.reversal') }}: <NuxtLink class="text-link underline" :to="{ path: '/transactions', query: { q: batch.reversal_transaction_id } }">{{ batch.reversal_transaction_id }}</NuxtLink> · {{ batch.correction_reason }}</p>
          <BsForm v-if="batch.status==='posted' && can('opening_balances.correct')" class="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[2fr_1fr_auto]" :aria-busy="busy===`reverse:${batch.id}`" @submit.prevent="reverse(batch)"><BsFloatingField :label="t('opening.correctionReason')"><input v-model="correctionReason" class="ls-input" required></BsFloatingField><BsFloatingField :label="t('opening.reversalDate')"><input v-model="correctionDate" class="ls-input" type="date"></BsFloatingField><BsButton type="submit" class="ls-btn self-end" :disabled="!correctionReason.trim() || Boolean(busy)">{{ busy===`reverse:${batch.id}` ? t('common.saving') : t('opening.reverse') }}</BsButton></BsForm>
        </article>
      </section>
    </template>
  </div>
</template>
