import type { Database } from '~~/types/database.types'
/** Ledger-owned effective dating, revision checks and authorized financial mapping commands. */
export function useLedgerAccountStatementClassificationDialogView(props: { account: { account_id: string; name: string; type: string; is_archived: boolean } | null; scope: string }, emit: (event: 'close' | 'saved') => void) {
 const supabase = useSupabaseClient<Database>()
 const { currentId, can } = useTenant()
 const { t, locale } = useI18n()
 const describeError = useErrorMessage()
 const toasts = useToasts()
 type Dimension = 'balance_sheet' | 'profit_loss' | 'cash_flow'
 interface HistoryRow { id: string; dimension?: string; revision: string; effective_from: string; statement_line: string; reason: string; created_at: string }
 interface Context { today: string; min_effective_date: string; history: HistoryRow[] }
 const dimension = ref<Dimension>('balance_sheet')
 const dimensions = computed<Dimension[]>(() => ['revenue', 'expense'].includes(props.account?.type || '') ? ['profit_loss', 'cash_flow'] : ['balance_sheet', 'cash_flow'])
 const context = ref<Context | null>(null)
 const loading = ref(false)
 const pending = ref(false)
 const error = ref('')
 const form = reactive({ statementLine: '', effectiveFrom: '', reason: '' })
 const requestId = ref<string>()
 const history = computed(() => (context.value?.history ?? []).filter(row => dimension.value === 'balance_sheet' || row.dimension === dimension.value))
 const options = computed(() => dimension.value === 'balance_sheet' ? statementLinesFor(props.account?.type || '') : dimension.value === 'profit_loss' ? (props.account?.type === 'revenue' ? ['operating_revenue', 'other_income'] : ['cost_of_sales', 'operating_expenses', 'other_expenses']) : ['operating', 'investing', 'financing', 'operating_noncash', 'operating_working_capital'])
 const canSchedule = computed(() => !!props.account && can('accounts.update') && !props.account.is_archived)
 const minDate = computed(() => { const base = can('financial_mappings.backdate') ? '0001-01-01' : context.value?.min_effective_date || ''; const head = history.value[0]?.effective_from || ''; return base > head ? base : head })
 const { dirty } = useRecordAction(() => form, computed(() => !!props.account && !loading.value))
 let disposed = false
 let mounted = false
 let generation = 0
 let loadController: AbortController | undefined
 const identity = () => `${props.scope}:${currentId.value}:${props.account?.account_id}:${dimension.value}`
 watch(() => [form.statementLine, form.effectiveFrom, form.reason], () => { requestId.value = undefined })
 watch(dimension, () => { context.value = null; form.statementLine = ''; form.effectiveFrom = ''; requestId.value = undefined; if (mounted) void load() })
 watch(() => [props.account?.account_id, props.scope, currentId.value], () => {
  generation++; loadController?.abort(); context.value = null; loading.value = false; pending.value = false; error.value = ''; Object.assign(form, { statementLine: '', effectiveFrom: '', reason: '' }); requestId.value = undefined
  dimension.value = ['revenue', 'expense'].includes(props.account?.type || '') ? 'profit_loss' : 'balance_sheet'
  if (mounted && props.account) void load()
 }, { flush: 'sync' })
 onBeforeUnmount(() => { disposed = true; generation++; loadController?.abort() })
 async function load() {
  const account = props.account; const organization = currentId.value
  if (!account || !organization) return
  loadController?.abort(); loadController = new AbortController()
  const version = ++generation; const scope = identity()
  loading.value = true; error.value = ''
  const current = () => !disposed && version === generation && scope === identity()
  try {
   const args = { p_organization_id: organization, p_account_id: account.account_id }
   const result = dimension.value === 'balance_sheet' ? await supabase.rpc('account_statement_classification_context', args).abortSignal(loadController.signal) : await supabase.rpc('account_financial_mapping_context', args).abortSignal(loadController.signal)
   if (!current()) return
   if (result.error) throw result.error
   context.value = result.data as unknown as Context
   form.effectiveFrom = context.value.min_effective_date; requestId.value = undefined
  } catch (failure) { if (current()) error.value = describeError(failure) } finally { if (current()) loading.value = false }
 }
 onMounted(() => { mounted = true; void load() })
 async function save() {
  const organization = currentId.value; const account = props.account; const scope = identity()
  if (disposed || !organization || !account || !context.value || pending.value || !canSchedule.value) return
  pending.value = true; error.value = ''; requestId.value ??= crypto.randomUUID()
  const current = () => !disposed && scope === identity()
  try {
   const common = { p_organization_id: organization, p_account_id: account.account_id, p_statement_line: form.statementLine, p_effective_from: form.effectiveFrom, p_reason: form.reason, p_request_id: requestId.value, p_expected_revision_id: history.value[0]?.id }
   const result = dimension.value === 'balance_sheet' ? await supabase.rpc('schedule_account_statement_classification', common) : await supabase.rpc('schedule_account_financial_mapping', { ...common, p_dimension: dimension.value })
   if (!current()) return
   if (result.error) throw result.error
   toasts.success(t('statementClassification.saved')); emit('saved'); emit('close')
  } catch (failure) { if (current()) error.value = describeError(failure) } finally { if (current()) pending.value = false }
 }
 return { t, locale, dimension, dimensions, context, loading, pending, error, form, history, options, canSchedule, minDate, dirty, load, save }
}
