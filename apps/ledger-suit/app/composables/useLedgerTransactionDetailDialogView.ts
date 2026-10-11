import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerTransactionDetailDialogView(_values: { transactionId: string | null }, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const transactionId = computed(() => _props.transactionId)
/**
 * Transaction detail, including the journal behind it.
 *
 * The journal is the "advanced view" from spec section 75 — the same posting a
 * non-accountant created without ever seeing a debit or a credit. Correcting a
 * posted transaction is only offered as a reversal, because that is the only
 * thing the database permits.
 */

const props = _props
const emit = _emit as <K extends keyof ({ close: [], changed: [], navigate: [id: string] })>(event: K, ...args: ({ close: [], changed: [], navigate: [id: string] })[K]) => void

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
  () => transaction.value?.source_record_kind !== 'inventory' && can('transactions.reverse') && transaction.value?.status === 'posted' && !periodLocked.value && !periodStatus.value?.includes('closed'),
)
const sourceLink = computed(() => {
  const transaction = detail.value?.transaction
  if (detail.value?.openingBatch?.id) return { path: '/opening-balances', query: { batch: detail.value.openingBatch.id } }
  if (!transaction?.source_record_kind || !transaction.source_record_parent_id) return null
  if (transaction.source_record_kind === 'inventory') return { path: '/inventory-accounting', query: { fact: transaction.source_record_id, date: transaction.transaction_date } }
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
const ledgerPresentation = useLedgerPresentation()
const ledgerUsage = useLedgerUsagePresentation()
return { props, emit, supabase, can, currentId, toasts, t, locale, describeError, refreshPlanUsage, reversing, reason, confirming, errorMessage, selectedTagId, tagPending, uploading, attachments, refreshAttachments, uploadAttachment, downloadAttachment, deleteAttachment, detail, refresh, transaction, entries, relationships, relationship, periodLocked, periodStatus, periodRestriction, canReverse, sourceLink, reverse, overlayDirty0, ledgerPresentation, ledgerUsage, transactionId }
}
