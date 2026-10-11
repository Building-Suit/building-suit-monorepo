import type { Database } from '~~/types/database.types'

/** Ledger-owned cash allocation rules and authorized classification command. */
export function useLedgerCashFlowAllocationDialogView(props: { entryId: string | null, accountName: string }, emit: (event: 'close' | 'saved') => void) {
const entryId = computed(() => props.entryId)
const accountName = computed(() => props.accountName)
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
let generation = 0
onBeforeUnmount(() => { generation++ })
async function load() {
  const version = ++generation
  const organization = currentId.value
  const requested = props.entryId
  if (!currentId.value || !requested) return
  loading.value = true
  const { data, error: failure } = await supabase.rpc('cash_flow_allocation_context', {
    p_organization_id: currentId.value, p_entry_id: requested,
  })
  if (version !== generation || organization !== currentId.value || requested !== props.entryId) return
  if (failure) error.value = describeError(failure)
  else context.value = data as unknown as typeof context.value
  loading.value = false
}
let mounted = false
onMounted(() => { mounted = true; void load() })
watch(() => [props.entryId, currentId.value], () => {
  generation++; context.value = undefined; reason.value = ''; Object.assign(amounts, { operating: '', investing: '', financing: '' }); error.value = ''; requestId = undefined; loading.value = false
  if (mounted) void load()
}, { flush: 'sync' })
async function save() {
  if (!props.entryId || !valid.value || !currentId.value || !can('accounts.update') || pending.value) return
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
