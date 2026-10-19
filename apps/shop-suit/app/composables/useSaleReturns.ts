import { useConnectivity, useReviewedCommand } from '@building-suit/ux'
import type { Ref } from 'vue'
import type { BsReturnForm, BsRefundRecordForm, BsDocumentReturnsCopy, BsDocumentReturnsView } from '@building-suit/ui/types/documentReturns'
import type { SaleReturnContext, SaleReturnLineInput, SaleReturnPlan } from '~/types/saleReturns'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { shopCommandErrorMessage } from '~/utils/shopCommandErrorMessage'

export function useSaleReturns(invoiceId: Ref<string>, enabled: () => boolean, changed: () => Promise<unknown>) {
  const rpc = useShopClient<ShopRpcDatabase>().schema('public')
  const { currentId, currentLocationId } = useShop()
  const user = useSupabaseUser()
  const { t, locale } = useI18n()
  const { online } = useConnectivity()
  const scope = () => `${user.value?.id}:${currentId.value}:${currentLocationId.value}:${invoiceId.value}`
  const offset = ref(0)
  const open = ref(false)
  const recordOpen = ref(false)
  const form = ref<BsReturnForm>({ quantities: {}, dispositions: {}, reason: '' })
  const recordForm = ref<BsRefundRecordForm>({ reference: '', reason: '' })
  const selectedRefund = ref<string | null>(null)
  const recordPending = ref(false)
  const recordError = ref('')
  type RecordArgs = { request: string; refund: string; operation: 'external_record' | 'cash_handover' | 'failed'; reference: string; reason: string }
  const frozenRecord = ref<RecordArgs | null>(null)
  const { dirty } = useRecordAction(() => form.value, open)
  const { dirty: recordDirty } = useRecordAction(() => recordForm.value, recordOpen)
  const args = () => ({ p_shop_id: currentId.value!, p_location_id: currentLocationId.value!, p_invoice_id: invoiceId.value })
  const { data: context, pending: loading, error: loadError, refresh } = useShopQuery(
    () => `shop-data:returns:${scope()}:${offset.value}:${enabled()}`,
    async (): Promise<SaleReturnContext | null> => {
      if (!currentId.value || !currentLocationId.value || !enabled()) return null
      const { data, error } = await rpc.rpc('sale_return_context', { ...args(), p_offset: offset.value })
      if (error) throw error
      return data as SaleReturnContext
    },
  )
  const input = () => ({ lines: (context.value?.lines ?? []).flatMap(line => {
    const quantity = Number(form.value.quantities[line.id] ?? 0)
    return quantity > 0 ? [{ lineId: line.id, quantity, disposition: line.itemType === 'service' ? 'service' : form.value.dispositions[line.id] ?? 'resellable' } as SaleReturnLineInput] : []
  }), reason: form.value.reason.trim() })
  const reviewed = useReviewedCommand<ReturnType<typeof input>, SaleReturnPlan>(input, scope)
  function describe(cause: unknown) {
    const message = shopCommandErrorMessage(cause)
    if (message.includes('RETURN_PREVIEW_CHANGED')) return t('returns.changed')
    if (message.includes('PRECISION')) return t('returns.precision')
    if (message.includes('QUANTITY_EXCEEDED')) return t('returns.quantityExceeded')
    if (message.includes('SNAPSHOT_UNSUPPORTED') || message.includes('LINEAGE_UNSUPPORTED')) return t('returns.unsupported')
    if (message.includes('CASH_SHIFT_REQUIRED')) return t('returns.cashShiftRequired')
    return t('returns.commandError')
  }
  const selected = computed(() => context.value?.history.flatMap(entry => entry.refunds).find(refund => refund.id === selectedRefund.value))
  function start() {
    if (!context.value?.canReturn || !online.value) return
    if (!reviewed.locked.value) { form.value = { quantities: {}, dispositions: {}, reason: '' }; reviewed.reset() }
    open.value = true
  }
  async function preview() {
    if (!online.value) return
    await reviewed.preview(async value => {
      if (!value.lines.length || value.reason.length < 2 || value.lines.some(line => !Number.isFinite(line.quantity) || Math.abs(line.quantity * 100 - Math.round(line.quantity * 100)) > 1e-8)) throw new Error('PRECISION')
      const { data, error } = await rpc.rpc('preview_sale_return', { ...args(), p_lines: value.lines })
      if (error) throw error
      return data as SaleReturnPlan
    }, describe)
  }
  async function confirmReturnReview() {
    if (!online.value) return
    const originalScope = scope()
    let rejected: unknown
    const success = await reviewed.submit(async (request, value, plan) => {
      const { error } = await rpc.rpc('create_sale_return', { ...args(), p_request_id: request, p_lines: value.lines, p_reason: value.reason, p_expected_plan: plan })
      if (error) {
        // SQL rejection proves rollback. Transport failures keep the reviewed
        // payload and UUID locked so reconnection can safely replay it.
        if (error.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith('08')) rejected = error
        throw error
      }
    }, describe)
    if (scope() !== originalScope) return
    if (rejected) { reviewed.reset(); reviewed.error.value = describe(rejected) }
    if (success) { open.value = false; await Promise.all([refresh(), changed()]) }
  }
  function record(id: string) {
    if (!online.value || !context.value?.canReturn) return
    if (frozenRecord.value && frozenRecord.value.refund !== id) { selectedRefund.value = frozenRecord.value.refund; recordOpen.value = true; return }
    selectedRefund.value = id
    if (!frozenRecord.value) { recordForm.value = { reference: '', reason: '' }; recordError.value = '' }
    recordOpen.value = true
  }
  async function recordResult(failed = false) {
    if (!online.value || !selected.value || recordPending.value || recordForm.value.reason.trim().length < 2) return
    frozenRecord.value ??= { request: crypto.randomUUID(), refund: selected.value.id, operation: failed ? 'failed' : selected.value.method === 'cash' ? 'cash_handover' : 'external_record', reference: recordForm.value.reference.trim(), reason: recordForm.value.reason.trim() }
    const command = frozenRecord.value
    const originalScope = scope()
    recordPending.value = true; recordError.value = ''
    try {
      const { error } = await rpc.rpc('record_sale_return_refund', { p_shop_id: currentId.value!, p_location_id: currentLocationId.value!, p_request_id: command.request, p_refund_id: command.refund, p_operation: command.operation, p_reference: command.reference, p_reason: command.reason })
      if (scope() !== originalScope) return
      if (error) { if (error.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith('08')) frozenRecord.value = null; throw error }
      frozenRecord.value = null; recordOpen.value = false
      await Promise.all([refresh(), changed()])
    }
    catch (cause) { if (scope() === originalScope) recordError.value = describe(cause) }
    finally { recordPending.value = false }
  }
  watch(scope, () => { offset.value = 0; open.value = false; recordOpen.value = false; selectedRefund.value = null; frozenRecord.value = null; recordError.value = ''; recordForm.value = { reference: '', reason: '' }; form.value = { quantities: {}, dispositions: {}, reason: '' } })
  const money = (value: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: context.value?.currency ?? 'EGP' }).format(Number(value))
  const date = (value: string) => new Date(value).toLocaleString(locale.value)
  const copy = computed<BsDocumentReturnsCopy>(() => Object.fromEntries(['title', 'action', 'loading', 'loadError', 'retry', 'unsupported', 'offline', 'policy', 'item', 'quantity', 'remaining', 'disposition', 'resellable', 'damaged', 'service', 'reason', 'preview', 'confirm', 'cancel', 'total', 'debt', 'refund', 'due', 'allocations', 'history', 'empty', 'external', 'cash', 'failed', 'reference', 'record', 'recordNotice', 'uncertain', 'previous', 'next'].map(key => [key, t(`returns.${key}`)])) as unknown as BsDocumentReturnsCopy)
  const view = computed<BsDocumentReturnsView>(() => ({
    loading: loading.value, error: Boolean(loadError.value), supported: context.value?.supported ?? true, canReturn: Boolean(context.value?.canReturn), online: online.value, pending: reviewed.pending.value, locked: reviewed.locked.value, dirty: dirty.value,
    actionError: reviewed.error.value, lines: (context.value?.lines ?? []).filter(line => Number(line.remaining) > 0).map(line => ({ id: line.id, name: line.name, remaining: Number(line.remaining), service: line.itemType === 'service' })),
    preview: reviewed.review.value ? { total: money(reviewed.review.value.total), debt: money(reviewed.review.value.debtReduction), refund: money(reviewed.review.value.refundDue), due: money(reviewed.review.value.dueAfter), allocations: reviewed.review.value.allocations.map(a => ({ id: a.allocationId, label: `${t(`payments.methods.${a.method}`)} · ${a.paymentId.slice(-8)}`, amount: money(a.amount) })) } : null,
    history: (context.value?.history ?? []).map(entry => ({ id: entry.id, title: `${date(entry.created_at)} · ${money(entry.total)}`, detail: `${t('returns.debt')}: ${money(entry.debt_reduction)} · ${t('returns.originalRefund')}: ${money(entry.refund_due)} · ${entry.original_document.invoiceNumber}`, reason: entry.reason, actor: `${t('returns.recordId')}: ${entry.id.slice(-8)}${entry.actorName ? ` · ${t('returns.actor')}: ${entry.actorName}` : ''}`, lines: entry.lines.map(line => ({ id: line.line_id, label: `${context.value?.lines.find(l => l.id === line.line_id)?.name ?? line.line_id} · ${Number(line.quantity)} · ${t(`returns.${line.disposition}`)} · ${money(line.total)}` })), refunds: entry.refunds.map(refund => ({ id: refund.id, label: `${t(`payments.methods.${refund.method}`)} · ${money(refund.amount)} · ${t(`returns.states.${refund.state}`)}`, canRecord: Boolean(context.value?.canReturn && refund.state !== 'completed'), cash: refund.method === 'cash', events: refund.events.map(event => ({ id: event.id, label: [date(event.created_at), t(`returns.operations.${event.operation}`), event.reference, event.reason].filter(Boolean).join(' · ') })) })) })),
    hasPrevious: offset.value > 0, hasNext: offset.value + 50 < (context.value?.totalCount ?? 0),
    record: { title: selected.value?.method === 'cash' ? t('returns.cash') : t('returns.external'), cash: selected.value?.method === 'cash', locked: Boolean(frozenRecord.value), pending: recordPending.value, dirty: recordDirty.value, error: recordError.value },
  }))
  return { returnOpen: open, refundRecordOpen: recordOpen, returnForm: form, refundRecordForm: recordForm, returnsCopy: copy, returnsView: view, startReturn: start, previewReturn: preview, confirmReturn: confirmReturnReview, recordReturnRefund: record, completeReturnRefund: () => recordResult(), failReturnRefund: () => recordResult(true), retryReturns: refresh, previousReturns: () => { offset.value = Math.max(0, offset.value - 50) }, nextReturns: () => { offset.value += 50 }, context }
}
