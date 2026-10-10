import type { BillingInterval, LaunchPlanKey } from '~/composables/useBilling'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerManualPaymentCheckoutView(_values: { plan?: LaunchPlanKey, interval: BillingInterval }, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const plan = computed(() => _props.plan)
const interval = computed(() => _props.interval)
const props = _props
const emit = _emit as <K extends keyof ({ close: [] })>(event: K, ...args: ({ close: [] })[K]) => void
const { t, locale } = useI18n()
const { can } = useTenant()
const { requests, selected, evidence, history, pending, error, load, submit, cancel, download, select } = useManualPayment()
const file = ref<File | null>(null)
const reason = ref('')
const validation = ref('')
const quoteId = crypto.randomUUID()
let evidenceId = crypto.randomUUID()
const { dirty, markSaved } = useRecordAction(() => ({ filename: file.value?.name, reason: reason.value }), computed(() => true))
const uploadAllowed = computed(() => selected.value && ['draft', 'rejected'].includes(selected.value.status))
const cancelAllowed = computed(() => selected.value && !['approved', 'cancelled'].includes(selected.value.status))
onMounted(() => { markSaved(); void load(props.plan, props.interval, quoteId) })
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
