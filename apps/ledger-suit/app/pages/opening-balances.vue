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
const correctionReason = ref('')
const correctionDate = ref('')

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
const amount = (value: number | string) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: baseCurrency.value }).format(Number(value) / 100)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`))
const rowErrors = (sourceRow: number) => validation.value?.rows.find(row => row.source_row === sourceRow)?.errors ?? []
const validationLabel = (code: string) => t(`opening.errors.${code}`)

function labels() {
  return { sourceCode: t('opening.sourceCode'), sourceName: t('opening.sourceName'), debit: t('opening.debit'), credit: t('opening.credit'), cashExample: t('opening.cashExample'), equityExample: t('opening.equityExample') }
}
function downloadTemplate() { downloadCsv(`${t('opening.templateFilename')}.csv`, openingBalanceTemplate(labels())) }

async function selectFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !currentId.value) return
  busy.value = 'upload'
  try {
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) throw new Error('OPENING_FILE_INVALID')
    const parsed = parseOpeningBalanceCsv(await file.text(), labels())
    filename.value = file.name
    rows.value = parsed
    validation.value = null
    postedTransactionId.value = null
    if (!cutoff.value) throw new Error('OPENING_CUTOFF_REQUIRED')
    const { data: id, error } = await supabase.rpc('create_opening_balance_batch', {
      p_organization_id: currentId.value, p_migration_mode: mode.value,
      p_cutoff_date: cutoff.value, p_source_filename: file.name, p_rows: parsed as unknown as Json,
    })
    if (error) throw error
    batchId.value = id
    await refresh()
  }
  catch (failure) { rows.value = []; toasts.error(t('opening.errorTitle'), describeError(failure)) }
  finally { busy.value = '' }
}

async function validateBatch() {
  if (!batchId.value || !cutoff.value) return
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
  if (!batchId.value || !validation.value?.valid) return
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
  if (!correctionReason.value.trim()) return
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
</script>

<template>
  <div class="space-y-6" data-opening-workflow>
    <header><h1 class="text-h1 font-bold">{{ t('opening.title') }}</h1><p class="mt-1 text-sm text-fg-muted">{{ t('opening.subtitle') }}</p></header>
    <p v-if="!can('opening_balances.read')" class="ls-card p-6 text-fg-muted">{{ t('opening.noAccess') }}</p>
    <p v-else-if="error" class="ls-error" role="alert">{{ t('opening.loadFailed') }}</p>
    <SectionSkeleton v-else-if="pending" variant="table" :rows="5" />
    <template v-else>
      <section v-if="can('opening_balances.manage')" class="ls-card space-y-5 p-5" aria-labelledby="opening-setup">
        <div><h2 id="opening-setup" class="text-h2 font-bold">1. {{ t('opening.setup') }}</h2><p class="text-sm text-fg-muted">{{ t('opening.cutoffHint') }}</p></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <FloatingField :label="t('opening.mode')"><select id="opening-mode" v-model="mode" class="ls-input" :disabled="!!postedTransactionId"><option value="year_start">{{ t('opening.modes.year_start') }}</option><option value="midyear">{{ t('opening.modes.midyear') }}</option></select></FloatingField>
          <FloatingField :label="t('opening.cutoff')"><input id="opening-cutoff" v-model="cutoff" class="ls-input" type="date" required :disabled="!!postedTransactionId"></FloatingField>
        </div>
        <div class="border-t border-line pt-4">
          <h2 class="text-h2 font-bold">2. {{ t('opening.upload') }}</h2>
          <div class="mt-3 flex flex-wrap gap-2"><label class="ls-btn ls-btn-primary cursor-pointer" for="opening-file">{{ t('opening.chooseCsv') }}</label><button type="button" class="ls-btn" @click="downloadTemplate">{{ t('opening.downloadTemplate') }}</button></div>
          <input id="opening-file" class="sr-only" type="file" accept=".csv,text/csv" :disabled="!cutoff || busy==='upload'" @change="selectFile">
          <p v-if="filename" class="mt-2 text-sm text-fg-muted">{{ filename }} · {{ t('opening.rowCount', { count: rows.length }) }}</p>
        </div>
      </section>

      <section v-if="rows.length" class="ls-card space-y-4 overflow-x-auto p-5" aria-labelledby="opening-mapping">
        <h2 id="opening-mapping" class="text-h2 font-bold">3. {{ t('opening.mapping') }}</h2>
        <table class="w-full min-w-[760px] text-sm"><thead><tr class="border-b border-line text-start"><th class="p-2">#</th><th class="p-2">{{ t('opening.sourceAccount') }}</th><th class="p-2">{{ t('opening.debit') }}</th><th class="p-2">{{ t('opening.credit') }}</th><th class="p-2">{{ t('opening.ledgerAccount') }}</th><th class="p-2">{{ t('opening.validationErrors') }}</th></tr></thead>
          <tbody><tr v-for="row in rows" :key="row.source_row" class="border-b border-line align-top" :data-source-row="row.source_row"><td class="p-2">{{ row.source_row }}</td><td class="p-2"><strong>{{ row.source_code }}</strong><br><span class="text-fg-muted">{{ row.source_name }}</span></td><td class="p-2">{{ row.debit || '—' }}</td><td class="p-2">{{ row.credit || '—' }}</td><td class="p-2"><select v-model="row.account_id" class="ls-input min-w-64" :aria-label="`${t('opening.ledgerAccount')} ${row.source_row}`"><option :value="null">{{ t('opening.chooseAccount') }}</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.code }} · {{ account.name }} · {{ t(`opening.roles.${account.account_role}`) }}<template v-if="account.is_archived"> · {{ t('opening.archived') }}</template></option></select></td><td class="p-2"><ul v-if="rowErrors(row.source_row).length" class="text-danger"><li v-for="code in rowErrors(row.source_row)" :key="code">{{ validationLabel(code) }}</li></ul><span v-else-if="validation" class="text-success">{{ t('opening.valid') }}</span></td></tr></tbody>
        </table>
        <button type="button" class="ls-btn ls-btn-primary" :disabled="busy==='validate'" @click="validateBatch">{{ t('opening.validate') }}</button>
      </section>

      <section v-if="validation" class="ls-card space-y-4 p-5" aria-labelledby="opening-validation" :data-validation="validation.valid ? 'valid' : 'invalid'">
        <h2 id="opening-validation" class="text-h2 font-bold">4. {{ t('opening.validation') }}</h2>
        <div class="grid gap-3 sm:grid-cols-3"><p><span class="text-fg-muted">{{ t('opening.debitTotal') }}</span><br><strong>{{ amount(validation.debit_total_minor) }}</strong></p><p><span class="text-fg-muted">{{ t('opening.creditTotal') }}</span><br><strong>{{ amount(validation.credit_total_minor) }}</strong></p><p><span class="text-fg-muted">{{ t('opening.difference') }}</span><br><strong>{{ amount(validation.difference_minor) }}</strong></p></div>
        <div v-if="validation.errors.length" class="ls-error" role="alert"><p class="font-semibold">{{ t('opening.blocked') }}</p><ul class="mt-2 list-disc ps-5"><li v-for="code in validation.errors" :key="code">{{ validationLabel(code) }}</li></ul></div>
        <div v-else class="rounded-control bg-surface-muted p-3 text-success" role="status">{{ t('opening.validationPassed') }}</div>
      </section>

      <section v-if="validation?.preview.length" class="ls-card space-y-4 overflow-x-auto p-5" aria-labelledby="opening-preview">
        <h2 id="opening-preview" class="text-h2 font-bold">5. {{ t('opening.preview') }}</h2><p class="text-sm text-fg-muted">{{ t('opening.previewHint', { date: cutoff }) }}</p>
        <table class="w-full min-w-[620px] text-sm"><thead><tr class="border-b border-line"><th class="p-2 text-start">{{ t('opening.ledgerAccount') }}</th><th class="p-2 text-end">{{ t('opening.debit') }}</th><th class="p-2 text-end">{{ t('opening.credit') }}</th></tr></thead><tbody><tr v-for="line in validation.preview" :key="line.row_id" class="border-b border-line"><td class="p-2">{{ line.account_code }} · {{ line.account_name }}</td><td class="p-2 text-end">{{ amount(line.debit_minor) }}</td><td class="p-2 text-end">{{ amount(line.credit_minor) }}</td></tr></tbody></table>
        <button v-if="can('opening_balances.approve') && !postedTransactionId" type="button" class="ls-btn ls-btn-primary" :disabled="!validation.valid || busy==='approve'" @click="approve">{{ t('opening.approve') }}</button>
        <div v-if="postedTransactionId" class="rounded-control bg-surface-muted p-4" data-opening-posted><strong>{{ t('opening.postedLocked') }}</strong><br><NuxtLink class="text-link underline" :to="{ path: '/transactions', query: { q: postedTransactionId } }">{{ t('opening.openJournal') }}</NuxtLink></div>
      </section>

      <section class="ls-card space-y-4 p-5" aria-labelledby="opening-history"><h2 id="opening-history" class="text-h2 font-bold">{{ t('opening.history') }}</h2><EmptyState v-if="!batches.length" :title="t('opening.empty')" :description="t('opening.emptyHint')" />
        <article v-for="batch in batches" :key="batch.id" class="rounded-control border border-line p-4" :data-batch-status="batch.status"><div class="flex flex-wrap justify-between gap-3"><div><strong>{{ t(`opening.modes.${batch.migration_mode}`) }} · {{ date(batch.cutoff_date) }}</strong><p class="text-sm text-fg-muted">{{ t('opening.revision', { revision: batch.revision }) }} · {{ t(`opening.status.${batch.status}`) }}</p></div><NuxtLink v-if="batch.posted_transaction_id" class="text-link underline" :to="{ path: '/transactions', query: { q: batch.posted_transaction_id } }">{{ t('opening.openJournal') }}</NuxtLink></div>
          <div v-if="batch.validation_result" class="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>{{ t('opening.rowCount', { count: (batch.validation_result as any).valid_row_count + (batch.validation_result as any).zero_row_count }) }}</span><span>{{ t('opening.debit') }}: {{ amount((batch.validation_result as any).debit_total_minor) }}</span><span>{{ t('opening.credit') }}: {{ amount((batch.validation_result as any).credit_total_minor) }}</span></div>
          <p class="mt-2 break-all text-xs text-fg-muted">{{ t('opening.creator') }}: {{ batch.created_by }}<template v-if="batch.approved_by"> · {{ t('opening.approver') }}: {{ batch.approved_by }}</template></p>
          <p v-if="batch.reversal_transaction_id" class="mt-2 text-sm">{{ t('opening.reversal') }}: <NuxtLink class="text-link underline" :to="{ path: '/transactions', query: { q: batch.reversal_transaction_id } }">{{ batch.reversal_transaction_id }}</NuxtLink> · {{ batch.correction_reason }}</p>
          <form v-if="batch.status==='posted' && can('opening_balances.correct')" class="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[2fr_1fr_auto]" @submit.prevent="reverse(batch)"><FloatingField :label="t('opening.correctionReason')"><input v-model="correctionReason" class="ls-input" required></FloatingField><FloatingField :label="t('opening.reversalDate')"><input v-model="correctionDate" class="ls-input" type="date"></FloatingField><button class="ls-btn self-end" :disabled="!correctionReason.trim() || busy===`reverse:${batch.id}`">{{ t('opening.reverse') }}</button></form>
        </article>
      </section>
    </template>
  </div>
</template>
