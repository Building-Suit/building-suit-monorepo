import type { Database } from '~~/types/database.types'

/** Product-owned activity and immutable journal queries. */
export function useLedgerAccountActivityDialogView(props: { accountId: string | null, scope: string, initialFrom?: string, initialTo?: string }, emit: (event: 'close') => void) {
const accountId = computed(() => props.accountId)
const scope = computed(() => props.scope)
const initialFrom = computed(() => props.initialFrom)
const initialTo = computed(() => props.initialTo)
const supabase = useSupabaseClient<Database>()
const { currentId } = useTenant()
const { t, locale } = useI18n()
const describeError = useErrorMessage()
interface Line { entry_id: string, transaction_id: string, entry_date: string, reference: string | null, description: string | null, memo: string | null, debit_minor: string, credit_minor: string, balance_minor: string }
interface Activity {
  account: { id: string, name: string, code: string | null, type: string, normal_balance: string, is_archived: boolean }
  currency: string, from_date: string, to_date: string, opening_minor: string, debit_minor: string, credit_minor: string, closing_minor: string, total: number, rows: Line[]
}
interface Journal {
  id: string, description: string | null, reference: string | null, date: string, type: string, status: string, currency: string,
  reverses_transaction_id: string | null, reversed_by_transaction_id: string | null, debit_minor: string, credit_minor: string,
  rows: Array<{ entry_id: string, account_id: string, account_name: string, account_code: string | null, memo: string | null, debit_minor: string, credit_minor: string, original_amount_minor: string, original_currency: string }>
}
interface Position { scroll?: number, focus?: string }
type View = ({ kind: 'account', id: string, from: string, to: string, offset: number, data?: Activity } | { kind: 'journal', id: string, data?: Journal }) & Position
const views = ref<View[]>([{ kind: 'account', id: props.accountId ?? '', from: props.initialFrom ?? '', to: props.initialTo ?? '', offset: 0 }])
const current = computed(() => views.value.at(-1)!)
const activity = computed(() => current.value.kind === 'account' ? current.value.data : undefined)
const journal = computed(() => current.value.kind === 'journal' ? current.value.data : undefined)
const loading = ref(false)
const error = ref('')
const content = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const pageSize = 25
const organizationId = computed(() => currentId.value)
const initialScope = computed(() => props.scope)
let disposed = false
let sequence = 0
let controller: AbortController | undefined
const isCurrent = (request: number) => !disposed && sequence === request && !!props.accountId
const title = computed(() => current.value.kind === 'account' ? t('accountActivity.title') : t('accountActivity.journal'))
const periodInvalid = computed(() => current.value.kind === 'account' && (!current.value.from || !current.value.to || current.value.from > current.value.to))
const cards = computed(() => activity.value ? [
  { key: 'opening', amount: activity.value.opening_minor, signed: true },
  { key: 'debits', amount: activity.value.debit_minor, signed: false },
  { key: 'credits', amount: activity.value.credit_minor, signed: false },
  { key: 'closing', amount: activity.value.closing_minor, signed: true },
] : [])

async function load(force = false) {
  const view = current.value
  controller?.abort()
  controller = new AbortController()
  const request = ++sequence
  error.value = ''
  loading.value = false
  if (!organizationId.value || !props.accountId || (view.data && !force)) return
  loading.value = true
  try {
    const result = view.kind === 'account'
      ? await supabase.rpc('read_account_activity', { p_organization_id: organizationId.value, p_account_id: view.id, p_from_date: view.from || undefined, p_to_date: view.to || undefined, p_offset: view.offset, p_limit: pageSize }).abortSignal(controller.signal)
      : await supabase.rpc('read_activity_journal', { p_organization_id: organizationId.value, p_transaction_id: view.id }).abortSignal(controller.signal)
    if (!isCurrent(request)) return
    if (result.error) throw result.error
    if (view.kind === 'account') {
      view.data = result.data as unknown as Activity
      view.from = view.data.from_date
      view.to = view.data.to_date
    }
    else view.data = result.data as unknown as Journal
  }
  catch (failure) { if (isCurrent(request)) error.value = describeError(failure) }
  finally { if (isCurrent(request)) loading.value = false }
}
let mounted = false
onMounted(() => { mounted = true; void load() })
watch(() => [props.accountId, props.scope, currentId.value], () => {
  controller?.abort(); ++sequence
  views.value = [{ kind: 'account', id: props.accountId ?? '', from: props.initialFrom ?? '', to: props.initialTo ?? '', offset: 0 }]
  error.value = ''; loading.value = false
  if (mounted && props.accountId) void load()
}, { flush: 'sync' })
onBeforeUnmount(() => { disposed = true; ++sequence; controller?.abort() })

async function openJournal(id: string, _entryId: string) {
  views.value.push({ kind: 'journal', id })
  await load()
}
async function openAccount(id: string, _entryId: string) {
  const previous = [...views.value].reverse().find(view => view.kind === 'account')
  views.value.push({ kind: 'account', id, from: previous?.kind === 'account' ? previous.from : '', to: previous?.kind === 'account' ? previous.to : '', offset: 0 })
  await load()
}
async function back() {
  if (views.value.length < 2) return
  views.value.pop()
  await load()

}
async function applyPeriod() {
  if (current.value.kind !== 'account' || periodInvalid.value) return
  current.value.offset = 0
  await load(true)
}
async function page(offset: number) {
  if (current.value.kind !== 'account') return
  current.value.offset = offset
  await load(true)
}
const ledgerPresentation = useLedgerPresentation()
return { props, emit, supabase, currentId, t, locale, describeError, views, current, activity, journal, loading, error, content, heading, pageSize, organizationId, initialScope, disposed, sequence, controller, isCurrent, title, periodInvalid, cards, load, openJournal, openAccount, back, applyPeriod, page, ledgerPresentation, accountId, scope, initialFrom, initialTo }
}
