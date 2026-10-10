import type { Database } from '~~/types/database.types'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerAccountStatementClassificationDialogView(_values: {
  account: { account_id: string, name: string, type: string, is_archived: boolean }
  scope: string
}, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const account = computed(() => _props.account)
const scope = computed(() => _props.scope)
const props = _props
const emit = _emit as <K extends keyof ({ close: [], saved: [] })>(event: K, ...args: ({ close: [], saved: [] })[K]) => void
const supabase = useSupabaseClient<Database>()
const { currentId, can } = useTenant()
const { t, locale } = useI18n()
const describeError = useErrorMessage()
const toasts = useToasts()
type Dimension = 'balance_sheet' | 'profit_loss' | 'cash_flow'
interface HistoryRow { id: string, dimension?: string, revision: string, effective_from: string, statement_line: string, reason: string, created_at: string }
interface Context { today: string, min_effective_date: string, history: HistoryRow[] }
const dimension = ref<Dimension>(['revenue', 'expense'].includes(props.account.type) ? 'profit_loss' : 'balance_sheet')
const dimensions = computed<Dimension[]>(() => ['revenue', 'expense'].includes(props.account.type)
  ? ['profit_loss', 'cash_flow'] : ['balance_sheet', 'cash_flow'])
const context = ref<Context | null>(null)
const loading = ref(true)
const pending = ref(false)
const error = ref('')
const form = reactive({ statementLine: '', effectiveFrom: '', reason: '' })
const requestId = ref<string>()
const history = computed(() => (context.value?.history ?? []).filter(row => dimension.value === 'balance_sheet' || row.dimension === dimension.value))
const options = computed(() => dimension.value === 'balance_sheet' ? statementLinesFor(props.account.type)
  : dimension.value === 'profit_loss'
    ? (props.account.type === 'revenue' ? ['operating_revenue', 'other_income'] : ['cost_of_sales', 'operating_expenses', 'other_expenses'])
    : ['operating', 'investing', 'financing', 'operating_noncash', 'operating_working_capital'])
const canSchedule = computed(() => can('accounts.update') && !props.account.is_archived)
const minDate = computed(() => {
  const base = can('financial_mappings.backdate') ? '0001-01-01' : (context.value?.min_effective_date ?? '')
  const head = history.value[0]?.effective_from ?? ''
  return base > head ? base : head
})
const { dirty } = useRecordAction(() => form, computed(() => !loading.value))
let disposed = false
let loadController: AbortController | undefined
const initialScope = props.scope
const initialOrganization = currentId.value
const isCurrent = () => !disposed && props.scope === initialScope && currentId.value === initialOrganization
watch(() => [form.statementLine, form.effectiveFrom, form.reason], () => { requestId.value = undefined })
watch(dimension, () => { context.value = null; form.statementLine = ''; form.effectiveFrom = ''; requestId.value = undefined; void load() })
onBeforeUnmount(() => { disposed = true; loadController?.abort() })

async function load() {
  if (!initialOrganization) return
  loadController?.abort()
  loadController = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const selected = dimension.value
    const args = { p_organization_id: initialOrganization, p_account_id: props.account.account_id }
    const { data, error: failure } = selected === 'balance_sheet'
      ? await supabase.rpc('account_statement_classification_context', args).abortSignal(loadController.signal)
      : await supabase.rpc('account_financial_mapping_context', args).abortSignal(loadController.signal)
    if (!isCurrent() || dimension.value !== selected) return
    if (failure) throw failure
    context.value = data as unknown as Context
    form.effectiveFrom = context.value.min_effective_date
    requestId.value = undefined
  }
  catch (failure) { if (isCurrent()) error.value = describeError(failure) }
  finally { if (isCurrent()) loading.value = false }
}
onMounted(load)

async function save() {
  if (!isCurrent() || !initialOrganization || !context.value || pending.value || !canSchedule.value) return
  pending.value = true
  error.value = ''
  requestId.value ??= crypto.randomUUID()
  try {
    const common = { p_organization_id: initialOrganization, p_account_id: props.account.account_id,
      p_statement_line: form.statementLine, p_effective_from: form.effectiveFrom,
      p_reason: form.reason, p_request_id: requestId.value, p_expected_revision_id: history.value[0]?.id }
    const { error: failure } = dimension.value === 'balance_sheet'
      ? await supabase.rpc('schedule_account_statement_classification', common)
      : await supabase.rpc('schedule_account_financial_mapping', { ...common, p_dimension: dimension.value })
    if (!isCurrent()) return
    if (failure) throw failure
    toasts.success(t('statementClassification.saved'))
    emit('saved')
    emit('close')
  }
  catch (failure) { if (isCurrent()) error.value = describeError(failure) }
  finally { if (isCurrent()) pending.value = false }
}
return { props, emit, supabase, currentId, can, t, locale, describeError, toasts, dimension, dimensions, context, loading, pending, error, form, requestId, history, options, canSchedule, minDate, dirty, disposed, loadController, initialScope, initialOrganization, isCurrent, load, save, account, scope }
}
