import { parsePaymentQueue, emptyReview, paymentCommand, confirmPaymentResult, evidenceAccessRequest, parseEvidenceAccess } from '../utils/payment-review'
import type { Payment, PaymentReceipt } from '../utils/payment-review'
import type { TransferRequest } from '../utils/manual-transfer'

export function usePaymentReview(binding: () => string | undefined, active: () => boolean) {
  const { t } = useI18n()
  const fetch = useRequestFetch()
  const queue = shallowRef<ReturnType<typeof parsePaymentQueue> | null>(null)
  const status = ref<'loading' | 'success' | 'empty' | 'error' | 'denied'>('loading')
  const filter = ref('submitted')
  const page = ref(1)
  const selected = shallowRef<Payment | null>(null)
  const draft = ref(emptyReview())
  const command = shallowRef<TransferRequest | null>(null)
  const receipt = shallowRef<PaymentReceipt | null>(null)
  const evidence = shallowRef<{ id: string; signedUrl: string; expiresAt: number } | null>(null)
  const evidencePending = ref(false)
  const evidenceError = ref(false)
  const action = useRecordAction(() => draft.value)
  let generation = 0
  let readGeneration = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  function clearEvidence() { clearTimeout(timer); evidence.value = null; evidenceError.value = false }
  async function load(preserveQueue = false) {
    const context = generation, read = ++readGeneration
    if (!preserveQueue) queue.value = null
    status.value = 'loading'
    if (!active() || !binding()) return
    try {
      const result = await fetch<{ data: unknown }>('/api/adapters/shop', { method: 'POST', body: {
        bindingId: binding(), operation: 'shop.billing.query', requestId: crypto.randomUUID(), correlationId: crypto.randomUUID(), reason: null,
        payload: { resource: 'queue', status: filter.value || null, page: page.value, pageSize: 25 },
      } })
      if (context !== generation || read !== readGeneration || !active()) return
      const parsed = parsePaymentQueue(result.data)
      if (parsed.page !== page.value || parsed.pageSize !== 25) throw new Error('invalid_projection')
      queue.value = parsed
      status.value = parsed.items.length ? 'success' : 'empty'
    } catch (error) {
      if (context !== generation || read !== readGeneration) return
      const code = (error as { statusCode?: number }).statusCode
      queue.value = null
      status.value = code === 401 || code === 403 ? 'denied' : 'error'
    }
  }
  function review(payment: Payment) {
    if (command.value || action.pending.value) return
    clearEvidence()
    selected.value = payment
    draft.value = { ...emptyReview(), action: payment.status === 'under_review' ? 'reject' : 'mark_under_review' }
    receipt.value = null
    action.edit()
  }
  async function save() {
    const context = generation
    await action.run(async () => {
      if (!active() || !selected.value) throw new Error('access_denied')
      command.value ||= paymentCommand(binding()!, selected.value, draft.value, () => crypto.randomUUID())
      const result = await fetch<unknown>('/api/adapters/shop', { method: 'POST', body: command.value })
      const confirmed = confirmPaymentResult(command.value, result)
      if (context !== generation || !active()) return
      receipt.value = confirmed
      command.value = null
      clearEvidence()
      await load(true)
    }, () => t('billing.commandError'))
  }
  async function openEvidence(id: string) {
    if (evidencePending.value || !selected.value?.evidence?.some(e => e.id === id) || !active()) return
    const context = generation, submissionId = selected.value.id
    clearEvidence(); evidencePending.value = true
    try {
      const request = evidenceAccessRequest(binding()!, submissionId, id, () => crypto.randomUUID())
      const result = await fetch<{ data: unknown }>('/api/adapters/shop', { method: 'POST', body: request })
      if (context !== generation || selected.value?.id !== submissionId || !action.visible.value || !active()) return
      const access = parseEvidenceAccess(result.data, submissionId, id)
      evidence.value = { id, ...access }
      timer = setTimeout(clearEvidence, access.expiresAt - Date.now())
    } catch { if (context === generation) evidenceError.value = true }
    finally { if (context === generation) evidencePending.value = false }
  }
  watch(action.visible, visible => { if (!visible) clearEvidence() })
  watch([filter, page], () => { if (active()) void load() })
  watch([binding, active], () => {
    ++generation; ++readGeneration; clearEvidence(); queue.value = null; selected.value = null; command.value = null; receipt.value = null; draft.value = emptyReview(); evidencePending.value = false; action.complete()
    page.value = 1
    if (active()) void load()
  }, { immediate: true })
  onScopeDispose(() => { ++generation; ++readGeneration; clearEvidence(); command.value = null; queue.value = null; selected.value = null; receipt.value = null })
  return { queue, status, filter, page, selected, draft, command, receipt, evidence, evidencePending, evidenceError, action, load, review, save, openEvidence }
}
