import type { ManualPaymentDatabase, ManualPaymentEvidence, ManualPaymentHistory, ManualPaymentRequest } from '~~/types/manual-payment.types'
import type { BillingInterval, LaunchPlanKey } from './useBilling'

export function useManualPayment() {
  const client = useSupabaseClient<ManualPaymentDatabase>()
  const { currentId, can } = useTenant()
  const user = useSupabaseUser()
  const requests = ref<ManualPaymentRequest[]>([])
  const selected = ref<ManualPaymentRequest | null>(null)
  const evidence = ref<ManualPaymentEvidence[]>([])
  const history = ref<ManualPaymentHistory[]>([])
  const pending = ref(false)
  const error = ref('')
  const describeError = useErrorMessage()
  const { t } = useI18n()
  let generation = 0
  const initialScope = `${currentId.value}:${user.value?.id}`
  const current = () => initialScope === `${currentId.value}:${user.value?.id}` && !disposed
  let disposed = false
  onBeforeUnmount(() => { disposed = true; generation++ })
  watch([currentId, user], () => {
    generation++; requests.value = []; selected.value = null; evidence.value = []; history.value = []; error.value = ''
  })

  async function run(work: () => Promise<void>) {
    if (pending.value || !current() || !can('billing.manage')) return
    pending.value = true
    error.value = ''
    try { await work() }
    catch (failure) {
      if (current()) {
        const message = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : ''
        error.value = message.includes('MANUAL_PAYMENT_NOT_CONFIGURED') ? t('billing.manual.notConfigured')
          : /^(RECEIPT_|MANUAL_PAYMENT_FAILED)/.test(message) ? t('billing.manual.failed') : describeError(failure)
      }
    }
    finally { if (current()) pending.value = false }
  }
  async function details(payment: ManualPaymentRequest) {
    const version = ++generation
    const [receipts, events, latest] = await Promise.all([
      client.from('manual_payment_evidence').select('*').eq('request_id', payment.id).order('submitted_at'),
      client.from('manual_payment_history').select('*').eq('request_id', payment.id).order('occurred_at'),
      client.from('manual_payment_requests').select('*').eq('id', payment.id).single(),
    ])
    if (receipts.error) throw receipts.error
    if (events.error) throw events.error
    if (latest.error) throw latest.error
    if (!current() || version !== generation) return
    selected.value = latest.data; evidence.value = receipts.data; history.value = events.data
    requests.value = requests.value.map(row => row.id === payment.id ? latest.data : row)
  }
  async function load(plan?: LaunchPlanKey, interval?: BillingInterval, quoteId?: string) {
    await run(async () => {
      const result = await client.from('manual_payment_requests').select('*').eq('organization_id', currentId.value!).order('created_at', { ascending: false }).limit(50)
      if (result.error) throw result.error
      if (!current()) return
      requests.value = result.data
      let payment = result.data.find(row => !['approved', 'cancelled'].includes(row.status))
      if (!payment && plan && interval && quoteId) {
        const quote = await client.rpc('prepare_manual_payment', { p_id: quoteId, p_organization_id: currentId.value!, p_plan_key: plan, p_interval: interval })
        if (quote.error) throw quote.error
        if (!current()) return
        payment = quote.data
        requests.value.unshift(payment)
      }
      payment ??= result.data[0]
      if (payment) await details(payment)
    })
  }
  async function submit(file: File, reason: string, evidenceId: string) {
    await run(async () => {
      if (!selected.value) return
      const body = new FormData()
      body.set('requestId', selected.value.id); body.set('evidenceId', evidenceId); body.set('reason', reason); body.set('receipt', file)
      const result = await client.functions.invoke('manual-payment', { body })
      if (result.error) throw new Error(await edgeFunctionErrorMessage(result.error, t('billing.manual.failed')))
      if (!current()) return
      await details(result.data.request as ManualPaymentRequest)
    })
  }
  async function cancel(reason: string) {
    await run(async () => {
      if (!selected.value) return
      const result = await client.rpc('cancel_manual_payment', { p_request_id: selected.value.id, p_reason: reason })
      if (result.error) throw result.error
      if (current()) await details(result.data)
    })
  }
  async function download(receipt: ManualPaymentEvidence) {
    await run(async () => {
      const result = await client.storage.from('manual-payment-receipts').download(receipt.storage_key)
      if (result.error) throw result.error
      if (!current()) return
      const url = URL.createObjectURL(result.data)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = receipt.filename; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }
  return { requests, selected, evidence, history, pending, error, load, submit, cancel, download, select: (payment: ManualPaymentRequest) => run(() => details(payment)) }
}
