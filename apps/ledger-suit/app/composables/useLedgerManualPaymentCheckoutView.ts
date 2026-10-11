import type { BillingInterval, LaunchPlanKey } from '~/composables/useBilling'

/** Ledger-owned manual payment validation, evidence and commands. */
export function useLedgerManualPaymentCheckoutView(_values: { plan?: LaunchPlanKey, interval: BillingInterval, active?: boolean }, _emit: (event: 'close') => void) {
const _props = _values
const plan = computed(() => _props.plan)
const interval = computed(() => _props.interval)
const props = _props
const emit = _emit
const { t, locale } = useI18n()
const { can } = useTenant()
const { requests, selected, evidence, history, pending, error, load, submit, cancel, download, select } = useManualPayment()
const file = ref<File | null>(null)
const reason = ref('')
const validation = ref('')
const quoteId = ref(crypto.randomUUID())
let evidenceId = crypto.randomUUID()
const { dirty, markSaved } = useRecordAction(() => ({ filename: file.value?.name, reason: reason.value }), computed(() => _values.active ?? true))
const uploadAllowed = computed(() => selected.value && ['draft', 'rejected'].includes(selected.value.status))
const cancelAllowed = computed(() => selected.value && !['approved', 'cancelled'].includes(selected.value.status))
const mounted = ref(false)
onMounted(() => { mounted.value = true })
watch([mounted, () => _values.active ?? true], ([ready, active]) => {
  file.value = null; reason.value = ''; validation.value = ''; markSaved()
  if (!ready || !active) return
  quoteId.value = crypto.randomUUID(); evidenceId = crypto.randomUUID()
  void load(props.plan, props.interval, quoteId.value)
})
function chooseFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  evidenceId = crypto.randomUUID()
  validation.value = ''
}
async function send() {
  validation.value = ''
  if (!file.value || !reason.value.trim() || file.value.size < 1 || file.value.size > 5242880 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.value.type)) {
    validation.value = t('billing.manual.fileHint'); return
  }
  await submit(file.value, reason.value, evidenceId)
  if (!error.value) { file.value = null; reason.value = ''; markSaved() }
}
async function cancelRequest() {
  if (!reason.value.trim()) { validation.value = t('billing.manual.reason'); return }
  await cancel(reason.value)
  if (!error.value) { file.value = null; reason.value = ''; markSaved() }
}
function date(value: string) { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
return { props, emit, t, locale, can, requests, selected, evidence, history, pending, error, load, submit, cancel, download, select, file, reason, validation, quoteId, evidenceId, dirty, markSaved, uploadAllowed, cancelAllowed, chooseFile, send, cancelRequest, date, plan, interval }
}
