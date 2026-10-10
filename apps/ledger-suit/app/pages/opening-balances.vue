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
  <BsStack data-opening-workflow gap="lg">
    <BsPageHeader
      :title="t('opening.title')"
      :subtitle="t('opening.subtitle')"
      :context="ledgerPresentation.context(undefined, undefined, cutoff)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsText v-if="!can('opening_balances.read')" tone="muted">{{ t('opening.noAccess') }}</BsText>
    <BsText v-else-if="error" role="alert" tone="danger">{{ t('opening.loadFailed') }}</BsText>
    <BsSectionSkeleton v-else-if="pending" variant="table" :rows="5" />
    <template v-else>
      <BsCard aria-labelledby="opening-readiness-guide" data-opening-readiness-guide as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-readiness-guide" :level="2" size="h2">{{ t('opening.guideTitle') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('opening.guideHint') }}</BsText>
          <BsList :ordered="false" marker="disc">
            <BsListItem>{{ t('opening.guideChart') }}</BsListItem>
            <BsListItem>{{ t('opening.guidePeriod') }}</BsListItem>
            <BsListItem>{{ t('opening.guideMapping') }}</BsListItem>
          </BsList>
          <BsInline gap="sm" :wrap="true">
            <BsLink to="/accounts?setup=templates">{{ t('opening.reviewChart') }}</BsLink>
            <BsLink to="/periods">{{ t('opening.reviewPeriods') }}</BsLink>
          </BsInline>
        </BsStack>
      </BsCard>
      <BsCard v-if="can('opening_balances.manage')" aria-labelledby="opening-setup" as="section" padding="md">
        <BsStack gap="md">
          <BsBox>
            <BsHeading id="opening-setup" :level="2" size="h2">1. {{ t('opening.setup') }}</BsHeading>
            <BsText size="sm" tone="muted">{{ t('opening.cutoffHint') }}</BsText>
          </BsBox>
          <BsGrid :columns="2" gap="md">
            <BsFloatingField :label="t('opening.mode')">
              <BsSelect id="opening-mode" v-model="mode" :disabled="!!postedTransactionId" native>
                <BsSelectOption value="year_start">{{ t('opening.modes.year_start') }}</BsSelectOption>
                <BsSelectOption value="midyear">{{ t('opening.modes.midyear') }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsFloatingField :label="t('opening.cutoff')">
              <BsInput id="opening-cutoff" v-model="cutoff" type="date" required :disabled="!!postedTransactionId" />
            </BsFloatingField>
          </BsGrid>
          <BsBox>
            <BsHeading :level="2" size="h2">2. {{ t('opening.upload') }}</BsHeading>
            <BsInline gap="sm" :wrap="true">
              <BsFieldLabel for="opening-file">{{ t('opening.chooseCsv') }}</BsFieldLabel>
              <BsButton type="button" @click="downloadTemplate">{{ t('opening.downloadTemplate') }}</BsButton>
            </BsInline>
            <BsFileInput id="opening-file" accept=".csv,text/csv" :disabled="!cutoff || busy==='upload'" bare @change="selectFile"  hide-control />
            <BsText v-if="filename" size="sm" tone="muted">{{ filename }} · {{ t('opening.rowCount', { count: rows.length }) }}</BsText>
            <BsButton v-if="uploadFailed" type="button" :disabled="Boolean(busy)" @click="uploadRows">{{ busy === 'upload' ? t('common.saving') : t('common.retry') }}</BsButton>
          </BsBox>
        </BsStack>
      </BsCard>
      <BsCard v-if="rows.length" aria-labelledby="opening-mapping" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-mapping" :level="2" size="h2">3. {{ t('opening.mapping') }}</BsHeading>
          <BsDataTable
            :value="rows"
            row-key="source_row"
            :label="t('opening.mapping')"
            :columns="[{ key: 'source_row', field: 'source_row', header: '#' }, { key: 'column2', header: t('opening.sourceAccount') }, { key: 'column3', header: t('opening.debit') }, { key: 'column4', header: t('opening.credit') }, { key: 'column5', header: t('opening.ledgerAccount') }, { key: 'column6', header: t('opening.validationErrors') }]"
          >
            <template #cell-column2="{ row }">
              <BsText as="strong">{{ row.source_code }}</BsText>
              <BsLineBreak />
              <BsText as="span" tone="muted">{{ row.source_name }}</BsText>
            </template>
            <template #cell-column3="{ row }">{{ row.debit || '—' }}</template>
            <template #cell-column4="{ row }">{{ row.credit || '—' }}</template>
            <template #cell-column5="{ row }">
              <BsSelect v-model="row.account_id" :aria-label="`${t('opening.ledgerAccount')} ${row.source_row}`" native>
                <BsSelectOption :value="null">{{ t('opening.chooseAccount') }}</BsSelectOption>
                <BsSelectOption v-for="account in accounts" :key="account.id" :value="account.id">{{ account.code }} · {{ account.name }} · {{ t(`opening.roles.${account.account_role}`) }}<template v-if="account.is_archived"> · {{ t('opening.archived') }}</template></BsSelectOption>
              </BsSelect>
            </template>
            <template #cell-column6="{ row }">
              <BsList v-if="rowErrors(row.source_row).length" :ordered="false" marker="none">
                <BsListItem v-for="code in rowErrors(row.source_row)" :key="code">{{ validationLabel(code) }}</BsListItem>
              </BsList>
              <BsText v-else-if="validation" as="span" tone="success">{{ t('opening.valid') }}</BsText>
            </template>
          </BsDataTable>
          <BsButton type="button" :disabled="Boolean(busy)" variant="primary" @click="validateBatch">{{ busy === 'validate' ? t('common.saving') : t('opening.validate') }}</BsButton>
        </BsStack>
      </BsCard>
      <BsCard v-if="validation" aria-labelledby="opening-validation" :data-validation="validation.valid ? 'valid' : 'invalid'" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-validation" :level="2" size="h2">4. {{ t('opening.validation') }}</BsHeading>
          <BsGrid :columns="3" gap="md">
            <BsText>
              <BsText as="span" tone="muted">{{ t('opening.debitTotal') }}</BsText>
              <BsLineBreak />
              <BsText as="strong">{{ amount(validation.debit_total_minor) }}</BsText>
            </BsText>
            <BsText>
              <BsText as="span" tone="muted">{{ t('opening.creditTotal') }}</BsText>
              <BsLineBreak />
              <BsText as="strong">{{ amount(validation.credit_total_minor) }}</BsText>
            </BsText>
            <BsText>
              <BsText as="span" tone="muted">{{ t('opening.difference') }}</BsText>
              <BsLineBreak />
              <BsText as="strong">{{ amount(validation.difference_minor) }}</BsText>
            </BsText>
          </BsGrid>
          <BsBox v-if="validation.errors.length" role="alert">
            <BsText emphasis="semibold">{{ t('opening.blocked') }}</BsText>
            <BsList :ordered="false" marker="disc">
              <BsListItem v-for="code in validation.errors" :key="code">{{ validationLabel(code) }}</BsListItem>
            </BsList>
          </BsBox>
          <BsBox v-else role="status" padding="md" surface="muted" radius="control">{{ t('opening.validationPassed') }}</BsBox>
        </BsStack>
      </BsCard>
      <BsCard v-if="validation?.preview.length" aria-labelledby="opening-preview" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-preview" :level="2" size="h2">5. {{ t('opening.preview') }}</BsHeading>
          <BsText size="sm" tone="muted">{{ t('opening.previewHint', { date: cutoff }) }}</BsText>
          <BsDataTable
            :value="validation.preview"
            row-key="row_id"
            :label="t('opening.preview')"
            :columns="[{ key: 'column1', header: t('opening.ledgerAccount') }, { key: 'column2', header: t('opening.debit'), align: 'end' as const }, { key: 'column3', header: t('opening.credit'), align: 'end' as const }]"
          >
            <template #cell-column1="{ row: line }">{{ line.account_code }} · {{ line.account_name }}</template>
            <template #cell-column2="{ row: line }">{{ amount(line.debit_minor) }}</template>
            <template #cell-column3="{ row: line }">{{ amount(line.credit_minor) }}</template>
          </BsDataTable>
          <BsButton
            v-if="can('opening_balances.approve') && !postedTransactionId"
            type="button"
            :disabled="!validation.valid || Boolean(busy)"
            variant="primary"
            @click="approve"
          >{{ busy === 'approve' ? t('common.saving') : t('opening.approve') }}</BsButton>
          <BsBox v-if="postedTransactionId" data-opening-posted padding="lg" surface="muted" radius="control">
            <BsText as="strong">{{ t('opening.postedLocked') }}</BsText>
            <BsLineBreak />
            <BsLink :to="{ path: '/transactions', query: { q: postedTransactionId } }">{{ t('opening.openJournal') }}</BsLink>
          </BsBox>
        </BsStack>
      </BsCard>
      <BsCard aria-labelledby="opening-history" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-history" :level="2" size="h2">{{ t('opening.history') }}</BsHeading>
          <BsEmptyState v-if="!batches.length" :title="t('opening.empty')" :description="t('opening.emptyHint')" />
          <BsBox v-for="batch in batches" :key="batch.id" :data-batch-status="batch.status" as="article" padding="lg" border radius="control">
            <BsInline gap="md" :wrap="true" justify="between">
              <BsBox>
                <BsText as="strong">{{ t(`opening.modes.${batch.migration_mode}`) }} · {{ date(batch.cutoff_date) }}</BsText>
                <BsText size="sm" tone="muted">{{ t('opening.revision', { revision: batch.revision }) }} · {{ t(`opening.status.${batch.status}`) }}</BsText>
              </BsBox>
              <BsLink v-if="batch.posted_transaction_id" :to="{ path: '/transactions', query: { q: batch.posted_transaction_id } }">{{ t('opening.openJournal') }}</BsLink>
            </BsInline>
            <BsGrid v-if="batch.validation_result" :columns="3" gap="sm">
              <BsText as="span">{{ t('opening.rowCount', { count: (batch.validation_result as any).valid_row_count + (batch.validation_result as any).zero_row_count }) }}</BsText>
              <BsText as="span">{{ t('opening.debit') }}: {{ amount((batch.validation_result as any).debit_total_minor) }}</BsText>
              <BsText as="span">{{ t('opening.credit') }}: {{ amount((batch.validation_result as any).credit_total_minor) }}</BsText>
            </BsGrid>
            <BsText size="xs" tone="muted">{{ t('opening.creator') }}: {{ batch.created_by }}<template v-if="batch.approved_by"> · {{ t('opening.approver') }}: {{ batch.approved_by }}</template></BsText>
            <BsText v-if="batch.reversal_transaction_id" size="sm">{{ t('opening.reversal') }}: <BsLink :to="{ path: '/transactions', query: { q: batch.reversal_transaction_id } }">{{ batch.reversal_transaction_id }}</BsLink> · {{ batch.correction_reason }}</BsText>
            <BsForm
              v-if="batch.status==='posted' && can('opening_balances.correct')"
              :aria-busy="busy===`reverse:${batch.id}`"
              layout="grid"
              @submit.prevent="reverse(batch)"
            >
              <BsFloatingField :label="t('opening.correctionReason')">
                <BsInput v-model="correctionReason" required />
              </BsFloatingField>
              <BsFloatingField :label="t('opening.reversalDate')">
                <BsInput v-model="correctionDate" type="date" />
              </BsFloatingField>
              <BsButton type="submit" :disabled="!correctionReason.trim() || Boolean(busy)">{{ busy===`reverse:${batch.id}` ? t('common.saving') : t('opening.reverse') }}</BsButton>
            </BsForm>
          </BsBox>
        </BsStack>
      </BsCard>
    </template>
  </BsStack>
</template>
