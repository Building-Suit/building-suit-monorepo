import type { ChartAccount } from '~/utils/accountTree'

/** Ledger-owned control-account reconciliation and authorized adjustment commands. */
export function useLedgerControlReconciliationPanelView(props: { accounts: ChartAccount[]; active?: boolean }, emit: (event: 'changed') => void) {
const accounts = computed(() => props.accounts)
const supabase = useSupabaseClient()
const { currentId, can, baseCurrency } = useTenant()
const { t } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()

interface ReconciliationRow {
  control_account_id: string
  account_code: string | null
  account_name: string
  subledger_type: 'customer' | 'supplier' | 'inventory'
  as_of_date: string
  gl_balance_minor: number
  subledger_balance_minor: number | null
  variance_minor: number | null
  status: 'provider_unavailable' | 'reconciled' | 'unreconciled' | 'explained_variance'
  provider_reference: string | null
  explanation_reason: string | null
  explanation_reference: string | null
}

const asOfDate = ref(new Date().toISOString().slice(0, 10))
const rows = ref<ReconciliationRow[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
let generation = 0
onBeforeUnmount(() => { generation++ })

function isActive() { return props.active !== false }

async function load() {
  if (props.active === false || !currentId.value || !can('controls.reconcile')) return
  const version = ++generation
  const requestedDate = asOfDate.value
  loading.value = true
  loadError.value = null
  const organizationId = currentId.value
  const { data, error } = await supabase.rpc('reconcile_control_accounts' as never, {
    p_organization_id: organizationId,
    p_as_of_date: requestedDate,
  } as never)
  if (version !== generation || currentId.value !== organizationId || asOfDate.value !== requestedDate || !isActive()) return
  if (error) loadError.value = describeError(error)
  else rows.value = (data ?? []) as ReconciliationRow[]
  loading.value = false
}
const controlAccountIds = computed(() => props.accounts
  .filter(account => account.account_role === 'control')
  .map(account => account.account_id)
  .sort()
  .join(','))
watch([currentId, asOfDate, controlAccountIds, () => props.active], () => { void load() }, { immediate: true })

const dialogOpen = ref(false)
const selected = ref<ChartAccount | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  date: asOfDate.value,
  counterpartAccountId: '',
  controlSide: 'debit' as 'debit' | 'credit',
  amount: '',
  description: '',
  reason: '',
  reference: '',
  idempotencyKey: '',
})
const { dirty } = useRecordAction(() => form, computed(() => dialogOpen.value))
watch(() => [currentId.value, props.active], () => { generation++; rows.value = []; loading.value = false; loadError.value = null; dialogOpen.value = false; selected.value = null; formError.value = null; Object.assign(form, { date: asOfDate.value, counterpartAccountId: '', controlSide: 'debit', amount: '', description: '', reason: '', reference: '', idempotencyKey: '' }) }, { flush: 'sync' })
const postingAccounts = computed(() => props.accounts.filter(account =>
  account.account_role === 'posting' && !account.is_archived,
))

function openAdjustment(accountId: string) {
  const account = props.accounts.find(item => item.account_id === accountId) ?? null
  if (!account || account.control_subledger_type === 'inventory') return
  selected.value = account
  Object.assign(form, {
    date: asOfDate.value,
    counterpartAccountId: '',
    controlSide: account.normal_balance,
    amount: '', description: '', reason: '', reference: '',
    idempotencyKey: crypto.randomUUID(),
  })
  formError.value = null
  dialogOpen.value = true
}

async function submitAdjustment() {
  if (!currentId.value || !selected.value || submitting.value) return
  formError.value = null
  let amountMinor: bigint
  try { amountMinor = parseMoneyToMinor(form.amount, baseCurrency.value) }
  catch { formError.value = t('controls.amountInvalid'); return }
  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    formError.value = t('controls.amountInvalid')
    return
  }
  if (!form.counterpartAccountId || !form.description.trim() || !form.reason.trim() || !form.reference.trim()) {
    formError.value = t('controls.adjustmentRequired')
    return
  }
  const organizationId = currentId.value
  submitting.value = true
  const opposite = form.controlSide === 'debit' ? 'credit' : 'debit'
  const { error } = await supabase.rpc('create_control_adjustment' as never, {
    p_organization_id: organizationId,
    p_control_account_id: selected.value.account_id,
    p_transaction_date: form.date,
    p_lines: [
      { account_id: selected.value.account_id, side: form.controlSide, amount_minor: Number(amountMinor) },
      { account_id: form.counterpartAccountId, side: opposite, amount_minor: Number(amountMinor) },
    ],
    p_description: form.description.trim(),
    p_reason: form.reason.trim(),
    p_reference_kind: 'reconciliation_case',
    p_reconciliation_reference: form.reference.trim(),
    p_idempotency_key: form.idempotencyKey,
  } as never)
  if (organizationId !== currentId.value || props.active === false) { submitting.value = false; return }
  if (error) formError.value = describeError(error)
  else {
    dialogOpen.value = false
    toasts.success(t('controls.adjustmentSaved'))
    emit('changed')
    await load()
  }
  submitting.value = false
}
const ledgerPresentation = useLedgerPresentation()
return { props, emit, supabase, currentId, can, baseCurrency, t, toasts, describeError, asOfDate, rows, loading, loadError, load, controlAccountIds, dialogOpen, selected, submitting, formError, form, dirty, postingAccounts, openAdjustment, submitAdjustment, ledgerPresentation, accounts }
}
