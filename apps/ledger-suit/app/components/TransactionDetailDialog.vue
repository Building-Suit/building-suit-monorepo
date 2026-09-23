<script setup lang="ts">
import type { Database } from '~~/types/database.types'

/**
 * Transaction detail, including the journal behind it.
 *
 * The journal is the "advanced view" from spec section 75 — the same posting a
 * non-accountant created without ever seeing a debit or a credit. Correcting a
 * posted transaction is only offered as a reversal, because that is the only
 * thing the database permits.
 */

const props = defineProps<{ transactionId: string | null }>()
const emit = defineEmits<{ close: [], changed: [], navigate: [id: string] }>()

const supabase = useSupabaseClient<Database>()
const { can, currentId } = useTenant()
const toasts = useToasts()
const { t, locale } = useI18n()
const describeError = useErrorMessage()
const { refresh: refreshPlanUsage } = usePlanUsage()

const reversing = ref(false)
const reason = ref('')
const confirming = ref(false)
const errorMessage = ref<string | null>(null)
const selectedTagId = ref('')
const tagPending = ref(false)
const uploading = ref(false)
watch(() => props.transactionId, () => { selectedTagId.value = ''; tagPending.value = false }, { flush: 'sync' })

const { data: attachments, refresh: refreshAttachments } = useLazyAsyncData('transaction-detail-attachments', async () => {
  if (!props.transactionId) return []
  const { data, error } = await supabase.from('attachments').select('*').eq('entity_type', 'transaction').eq('entity_id', props.transactionId).order('created_at')
  if (error) throw error
  return data ?? []
}, { watch: [() => props.transactionId], default: () => [] })

async function uploadAttachment(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !props.transactionId || !currentId.value) return
  uploading.value = true; errorMessage.value = null
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const key = `${currentId.value}/transaction/${props.transactionId}/${crypto.randomUUID()}.${ext}`
    const { data: reservationId, error: reserveError } = await supabase.rpc('reserve_attachment_upload', {
      p_organization_id: currentId.value,
      p_entity_type: 'transaction',
      p_entity_id: props.transactionId,
      p_file_name: file.name,
      p_mime_type: file.type,
      p_size_bytes: file.size,
      p_storage_key: key,
    })
    if (reserveError) throw reserveError

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
    await refreshAttachments(); await refreshPlanUsage(); emit('changed')
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { uploading.value = false; (event.target as HTMLInputElement).value = '' }
}

async function downloadAttachment(item: NonNullable<typeof attachments.value>[number]) {
  const { data, error } = await supabase.storage.from(item.storage_bucket).createSignedUrl(item.storage_key, 60)
  if (error) return (errorMessage.value = describeError(error))
  if (data.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

async function deleteAttachment(item: NonNullable<typeof attachments.value>[number]) {
  const { data, error } = await supabase.rpc('begin_attachment_delete', { p_attachment_id: item.id })
  if (error) return (errorMessage.value = describeError(error))
  const cleanup = data?.[0]
  if (cleanup) await supabase.storage.from(cleanup.storage_bucket).remove([cleanup.storage_key])
  await refreshAttachments(); await refreshPlanUsage(); emit('changed')
}

const { data: detail, refresh } = useLazyAsyncData(
  'transaction-detail',
  async () => {
    if (!props.transactionId) return null

    const [{ data: transaction, error: txError }, { data: entries, error: entryError }, { data: settings, error: settingsError }, { data: openingBatch, error: openingError }] =
      await Promise.all([
        supabase
          .from('transaction_summaries')
          .select('*')
          .eq('id', props.transactionId)
          .maybeSingle(),
        supabase
          .from('ledger_entries')
          .select('entry_id, side, amount_minor, currency_code, base_amount_minor, memo, account_code, account_name, account_type')
          .eq('transaction_id', props.transactionId)
          .order('side', { ascending: true }),
        supabase.from('organization_settings').select('books_locked_until').eq('organization_id', currentId.value!).maybeSingle(),
        supabase.from('opening_balance_batches').select('id').or(`posted_transaction_id.eq.${props.transactionId},reversal_transaction_id.eq.${props.transactionId}`).maybeSingle(),
      ])

    if (txError) throw txError
    if (entryError) throw entryError
    if (settingsError) throw settingsError
    if (openingError) throw openingError

    const { data: periodContext, error: periodError } = transaction?.transaction_date && can('periods.read')
      ? await supabase.rpc('accounting_period_context', {
          p_organization_id: currentId.value!, p_date: transaction.transaction_date,
        })
      : { data: [], error: null }
    if (periodError) throw periodError

    const relationshipIds = [transaction?.reverses_transaction_id, transaction?.reversed_by_transaction_id, transaction?.correction_of_transaction_id].filter((id): id is string => Boolean(id))
    const { data: relationships, error: relationshipError } = relationshipIds.length
      ? await supabase.from('transaction_summaries').select('id, journal_reference, status, type').in('id', relationshipIds)
      : { data: [], error: null }
    if (relationshipError) throw relationshipError

    return { transaction, entries: entries ?? [], settings, openingBatch, periodContext: periodContext?.[0] ?? null, relationships: relationships ?? [] }
  },
  { watch: [() => props.transactionId] },
)

const transaction = computed(() => detail.value?.transaction ?? null)
const entries = computed(() => detail.value?.entries ?? [])
const relationships = computed(() => detail.value?.relationships ?? [])
const relationship = (id: string | null | undefined) => relationships.value.find(item => item.id === id)
const periodLocked = computed(() => Boolean(
  transaction.value?.transaction_date
  && detail.value?.settings?.books_locked_until
  && transaction.value.transaction_date <= detail.value.settings.books_locked_until
  && !can('books.override_lock'),
))
const periodStatus = computed(() => detail.value?.periodContext?.period_status ?? null)
const periodRestriction = computed(() => periodStatus.value === 'hard_closed'
  ? t('journalCenter.periodHardClosed')
  : periodStatus.value === 'soft_closed'
    ? t('journalCenter.periodSoftClosed')
    : periodLocked.value ? t('journalCenter.periodLocked') : '')

const canReverse = computed(
  () => can('transactions.reverse') && transaction.value?.status === 'posted' && !periodLocked.value && !periodStatus.value?.includes('closed'),
)
const sourceLink = computed(() => {
  const transaction = detail.value?.transaction
  if (detail.value?.openingBatch?.id) return { path: '/opening-balances', query: { batch: detail.value.openingBatch.id } }
  if (!transaction?.source_record_kind || !transaction.source_record_parent_id) return null
  if (transaction.source_record_kind === 'commitment') return { path: '/records/commitments', query: { item: transaction.source_record_parent_id } }
  if (transaction.source_record_kind === 'recurring') return { path: '/records/recurring', query: { item: transaction.source_record_parent_id } }
  if (transaction.source_record_kind === 'import') return { path: '/imports', query: { batch: transaction.source_record_parent_id } }
  return null
})

async function reverse() {
  if (!props.transactionId) return
  if (!reason.value.trim()) {
    errorMessage.value = t('detail.reverseReasonRequired')
    return
  }

  reversing.value = true
  errorMessage.value = null

  try {
    const { error } = await supabase.rpc('reverse_transaction', {
      p_transaction_id: props.transactionId,
      p_reason: reason.value,
    })
    if (error) throw error

    toasts.success(t('detail.reversedTitle'), t('detail.reversedBody'))
    confirming.value = false
    reason.value = ''
    await refresh()
    await refreshPlanUsage()
    emit('changed')
  }
  catch (err) {
    errorMessage.value = describeError(err)
  }
  finally {
    reversing.value = false
  }
}
const { dirty: overlayDirty0 } = useRecordAction(() => ({ reason: reason.value, selectedTagId: selectedTagId.value }), computed(() => Boolean(props.transactionId)))
</script>

<template>
    <BsDialog v-if="transactionId" :visible="true" :title="transaction?.description || t('detail.title')" :aria-label="transaction?.description || t('detail.title')" :show-header="false" size="md" :dirty="overlayDirty0" :pending="reversing || uploading || tagPending" @update:visible="value => { if (!value) emit('close') }"><template #default="{ close: dismiss }">
<div class="flex flex-col overflow-hidden">
        <header class="flex items-start justify-between gap-3 border-b border-[var(--bs-border)] px-6 py-4">
          <div class="min-w-0">
            <h2 id="transaction-detail-title" class="truncate text-base font-bold">
              {{ transaction?.description || t('detail.title') }}
            </h2>
            <p class="mt-1 flex items-center gap-2 text-sm text-fg-muted">
              <StatusBadge v-if="transaction?.status" :status="transaction.status" />
              <span v-if="transaction?.type">{{ t(`types.${transaction.type}`) }}</span>
              <span v-if="transaction?.journal_reference" class="font-semibold">{{ transaction.journal_reference }}</span>
            </p>
          </div>
          <button type="button" class="ls-btn ls-btn-sm" :aria-label="t('common.close')" @click="dismiss"><AppIcon name="close" /></button>
        </header>

        <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-fg-muted">{{ t('journalCenter.journalReference') }}</dt>
              <dd class="font-semibold">{{ transaction?.journal_reference || t('common.dash') }}</dd>
            </div>
            <div>
              <dt class="text-fg-muted">{{ t('journalCenter.accountingDate') }}</dt>
              <dd>{{ formatDate(transaction?.transaction_date, locale) }}</dd>
            </div>
            <div>
              <dt class="text-fg-muted">{{ t('journalCenter.source') }}</dt>
              <dd>{{ transaction?.source ? t(`journalSources.${transaction.source}`) : t('common.dash') }}</dd>
            </div>
            <div>
              <dt class="text-fg-muted">{{ t('transactions.category') }}</dt>
              <dd>{{ transaction?.category_name || t('common.dash') }}</dd>
            </div>
            <div>
              <dt class="text-fg-muted">{{ t('transactions.counterparty') }}</dt>
              <dd>{{ transaction?.counterparty_name || t('common.dash') }}</dd>
            </div>
            <div>
              <dt class="text-fg-muted">{{ t('transactions.reference') }}</dt>
              <dd>{{ transaction?.reference || t('common.dash') }}</dd>
            </div>
            <div>
              <dt class="text-fg-muted">{{ t('transactions.createdBy') }}</dt>
              <dd>{{ transaction?.created_by_name || transaction?.created_by_email || t('common.dash') }}</dd>
            </div>
            <div v-if="transaction?.adjustment_reason" class="col-span-2">
              <dt class="text-fg-muted">{{ t('detail.reason') }}</dt>
              <dd>{{ transaction.adjustment_reason }}</dd>
            </div>
            <div v-if="sourceLink" class="col-span-2">
              <dt class="text-fg-muted">{{ t('journalCenter.sourceRecord') }}</dt>
              <dd><NuxtLink :to="sourceLink" class="text-link hover:underline">{{ t('journalCenter.openSource') }}</NuxtLink></dd>
            </div>
          </dl>

          <section aria-labelledby="journal-heading">
            <h3 id="journal-heading" class="mb-2 text-sm font-bold">{{ t('detail.journal') }}</h3>
            <BsDataTable :value="entries">
  <Column >
    <template #header>{{ t('detail.account') }}</template>
    <template #body="{ data: entry }"><span class="block">{{ entry.account_name }}</span>
                    <span v-if="entry.memo" class="block text-xs text-fg-muted">{{ entry.memo }}</span></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num">
    <template #header>{{ t('detail.debit') }}</template>
    <template #body="{ data: entry }"><MoneyText v-if="entry.side === 'debit'" :amount-minor="entry.amount_minor" :currency="entry.currency_code" />
                    <span v-else class="text-fg-disabled">{{ t('common.dash') }}</span></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num">
    <template #header>{{ t('detail.credit') }}</template>
    <template #body="{ data: entry }"><MoneyText v-if="entry.side === 'credit'" :amount-minor="entry.amount_minor" :currency="entry.currency_code" />
                    <span v-else class="text-fg-disabled">{{ t('common.dash') }}</span></template>
  </Column>
</BsDataTable>
            <div class="mt-3 flex flex-wrap justify-between gap-3 rounded-control bg-surface-muted p-3 text-sm font-semibold">
              <span>{{ t('journalCenter.lineTotals') }}</span>
              <span>{{ t('detail.debit') }}: <MoneyText :amount-minor="transaction?.debit_minor" :currency="transaction?.currency_code ?? undefined" /></span>
              <span>{{ t('detail.credit') }}: <MoneyText :amount-minor="transaction?.credit_minor" :currency="transaction?.currency_code ?? undefined" /></span>
            </div>
          </section>

          <TransactionTags v-model:selected="selectedTagId" v-model:pending="tagPending" :transaction-id="transactionId" @changed="emit('changed')" />

          <section aria-labelledby="attachments-heading">
            <div class="mb-2 flex items-center justify-between"><h3 id="attachments-heading" class="text-sm font-bold">{{ t('operations.attachments') }}</h3><label v-if="can('attachments.create')" class="ls-btn ls-btn-sm cursor-pointer">{{ uploading ? t('common.saving') : t('operations.upload') }}<input type="file" class="sr-only" accept="application/pdf,image/png,image/jpeg,image/webp" :disabled="uploading" @change="uploadAttachment"></label></div>
            <QuotaUsageMeter v-if="can('attachments.create')" quota-key="max_storage_bytes" compact class="mb-3" />
            <div v-if="attachments.length" class="space-y-2"><div v-for="item in attachments" :key="item.id" class="flex items-center justify-between rounded-control bg-surface-muted px-3 py-2 text-sm"><button class="truncate text-link" @click="downloadAttachment(item)">{{ item.file_name }}</button><button v-if="can('attachments.delete')" class="ls-btn ls-btn-sm" :aria-label="t('common.delete')" @click="deleteAttachment(item)"><AppIcon name="delete" :size="18" /></button></div></div><p v-else class="text-sm text-fg-muted">{{ t('operations.noAttachments') }}</p>
          </section>

          <section v-if="transaction?.reverses_transaction_id || transaction?.reversed_by_transaction_id || transaction?.correction_of_transaction_id" class="rounded-control bg-[var(--bs-status-info-bg)] px-3 py-3 text-sm text-[var(--bs-status-info)]" aria-labelledby="relationships-heading">
            <h3 id="relationships-heading" class="font-bold">{{ t('journalCenter.relationships') }}</h3>
            <p v-if="transaction?.reversed_by_transaction_id" class="mt-2">{{ t('detail.reversedNotice') }} <button type="button" class="font-semibold underline" @click="emit('navigate', transaction.reversed_by_transaction_id)">{{ t('journalCenter.reversalJournal') }} {{ relationship(transaction.reversed_by_transaction_id)?.journal_reference }}</button></p>
            <p v-if="transaction?.reverses_transaction_id" class="mt-2">{{ t('journalCenter.reverses') }} <button type="button" class="font-semibold underline" @click="emit('navigate', transaction.reverses_transaction_id)">{{ t('journalCenter.originalJournal') }} {{ relationship(transaction.reverses_transaction_id)?.journal_reference }}</button></p>
            <p v-if="transaction?.correction_of_transaction_id" class="mt-2">{{ t('journalCenter.adjusts') }} <button type="button" class="font-semibold underline" @click="emit('navigate', transaction.correction_of_transaction_id)">{{ relationship(transaction.correction_of_transaction_id)?.journal_reference }}</button></p>
          </section>

          <p v-if="periodRestriction" class="rounded-control bg-surface-muted px-3 py-2 text-sm text-fg-muted">{{ periodRestriction }}</p>

          <div v-if="confirming" class="ls-card-flat space-y-3 p-4">
            <p class="text-sm">{{ t('detail.reverseExplain') }}</p>
            <div>
              <label class="ls-label" for="reverse-reason">{{ t('detail.reverseReason') }}</label>
              <input
                id="reverse-reason"
                v-model="reason"
                class="ls-input"
                :placeholder="t('detail.reverseReasonPlaceholder')"
              >
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="ls-btn" @click="confirming = false">{{ t('common.cancel') }}</button>
              <button type="button" class="ls-btn ls-btn-danger" :disabled="reversing" @click="reverse">
                {{ reversing ? t('detail.reversing') : t('detail.reverseConfirm') }}
              </button>
            </div>
          </div>

          <p v-if="errorMessage" role="alert" class="ls-error">
            {{ errorMessage }}
          </p>
        </div>

        <footer v-if="canReverse && !confirming" class="border-t border-[var(--bs-border)] px-6 py-4">
          <button type="button" class="ls-btn" @click="confirming = true">{{ t('detail.reverseAction') }}</button>
        </footer>
      </div>
</template></BsDialog>
</template>
