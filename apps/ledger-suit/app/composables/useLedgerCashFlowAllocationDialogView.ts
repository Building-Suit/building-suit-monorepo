import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerCashFlowAllocationDialogView(_values: { entryId: string, accountName: string }, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const entryId = computed(() => _props.entryId)
const accountName = computed(() => _props.accountName)
const props = _props
const emit = _emit as <K extends keyof ({ close: [], saved: [] })>(event: K, ...args: ({ close: [], saved: [] })[K]) => void
const supabase = useSupabaseClient<Database>()
const { currentId, baseCurrency, can } = useTenant()
const { t } = useI18n()
const describeError = useErrorMessage()
const loading = ref(true)
const pending = ref(false)
const error = ref('')
const reason = ref('')
const amounts = reactive({ operating: '', investing: '', financing: '' })
const { dirty } = useRecordAction(() => ({ reason: reason.value, ...amounts }), computed(() => !loading.value))
const context = ref<{ amount_minor: number, decision_id: string | null, allocations: Record<string, number> }>()
let requestId: string | undefined
const total = computed(() => {
  try { return (['operating', 'investing', 'financing'] as const)
    .reduce((sum, key) => sum + (amounts[key] ? parseMoneyToMinor(amounts[key], baseCurrency.value) : 0n), 0n) }
  catch { return -1n }
})
const valid = computed(() => context.value && total.value === BigInt(context.value.amount_minor) && reason.value.trim().length > 0)
watch([reason, () => amounts.operating, () => amounts.investing, () => amounts.financing], () => { requestId = undefined })
onMounted(async () => {
  if (!currentId.value) return
  const { data, error: failure } = await supabase.rpc('cash_flow_allocation_context', {
    p_organization_id: currentId.value, p_entry_id: props.entryId,
  })
  if (failure) error.value = describeError(failure)
  else context.value = data as unknown as typeof context.value
  loading.value = false
})
async function save() {
  if (!valid.value || !currentId.value || !can('accounts.update') || pending.value) return
  pending.value = true
  error.value = ''
  requestId ??= crypto.randomUUID()
  try {
    const allocations: Record<string, number> = {}
    for (const key of ['operating', 'investing', 'financing'] as const) {
      const value = amounts[key] ? parseMoneyToMinor(amounts[key], baseCurrency.value) : 0n
      if (value > 0n) allocations[key] = Number(value)
    }
    const result = await supabase.rpc('classify_cash_flow_entry', {
      p_organization_id: currentId.value, p_entry_id: props.entryId,
      p_allocations: allocations, p_reason: reason.value.trim(), p_request_id: requestId,
      p_expected_decision_id: context.value?.decision_id ?? undefined,
    })
    if (result.error) throw result.error
    emit('saved')
    emit('close')
  }
  catch (failure) { error.value = describeError(failure) }
  finally { pending.value = false }
}
const ledgerPresentation = useLedgerPresentation()
return { props, emit, supabase, currentId, baseCurrency, can, t, describeError, loading, pending, error, reason, amounts, dirty, context, requestId, total, valid, save, ledgerPresentation, entryId, accountName }
}
