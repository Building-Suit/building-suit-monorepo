import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

export const TRANSACTION_STATUSES = ['draft', 'scheduled', 'pending', 'pending_approval', 'posted', 'voided', 'reversed', 'failed'] as const
export const TRANSACTION_TYPES = ['income', 'expense', 'transfer', 'asset_purchase', 'liability_created', 'liability_payment', 'owner_contribution', 'owner_withdrawal', 'adjustment', 'opening_balance', 'reversal'] as const
type TransactionRow = Database['public']['Functions']['search_transactions']['Returns'][number]
type Status = typeof TRANSACTION_STATUSES[number]
type Type = typeof TRANSACTION_TYPES[number]

export function useTransactionWorkspace() {
  const route = useRoute()
  const router = useRouter()
  const user = useSupabaseUser()
  const config = useRuntimeConfig()
  const supabase = useSupabaseClient<Database>()
  const { currentId, baseCurrency, can } = useTenant()
  const { revision } = useAddTransaction()
  const filters = reactive({ search: '', from: '', to: '', status: '' as '' | Status, type: '' as '' | Type, categoryId: '', accountId: '', minAmount: '', maxAmount: '' })
  const sort = reactive({ column: 'transaction_date', direction: 'desc' as 'asc' | 'desc' })
  const page = ref(1)
  const pageSize = 25
  const search = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let readingRoute = false
  const fields = { search: 'q', from: 'from', to: 'to', status: 'status', type: 'type', categoryId: 'category', accountId: 'account', minAmount: 'min', maxAmount: 'max' } as const
  const scope = computed(() => scopedQueryKey({ environment: String(config.public.supabase.url), portal: 'ledger-suit', userId: user.value?.id ?? '', tenantId: currentId.value ?? '' }, 'transactions'))
  const scalar = (value: unknown) => typeof value === 'string' ? value : ''

  function readRoute() {
    readingRoute = true
    clearTimeout(searchTimer)
    for (const [field, key] of Object.entries(fields)) Object.assign(filters, { [field]: scalar(route.query[key]) })
    if (!(TRANSACTION_STATUSES as readonly string[]).includes(filters.status)) filters.status = ''
    if (!(TRANSACTION_TYPES as readonly string[]).includes(filters.type)) filters.type = ''
    search.value = filters.search
    sort.column = ['transaction_date', 'type', 'status', 'amount', 'created_at'].includes(scalar(route.query.sort)) ? scalar(route.query.sort) : 'transaction_date'
    sort.direction = route.query.direction === 'asc' ? 'asc' : 'desc'
    const requested = Number(route.query.page)
    page.value = Number.isSafeInteger(requested) && requested > 0 && requested <= 1_000_000 ? requested : 1
    readingRoute = false
  }
  readRoute()
  watch(() => route.query, () => {
    const incoming = Object.fromEntries(Object.entries(route.query).filter(([name]) => !['create', 'import'].includes(name)))
    if (Object.keys(incoming).length !== Object.keys(query.value).length || Object.entries(query.value).some(([name, value]) => incoming[name] !== value)) readRoute()
  })
  watch(() => filters.search, value => {
    if (readingRoute) return
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { page.value = 1; search.value = value }, 300)
  }, { flush: 'sync' })
  watch(() => [filters.from, filters.to, filters.status, filters.type, filters.categoryId, filters.accountId, filters.minAmount, filters.maxAmount, sort.column, sort.direction], () => {
    if (!readingRoute) page.value = 1
  }, { flush: 'sync' })
  onBeforeUnmount(() => clearTimeout(searchTimer))

  function clearFilters() {
    clearTimeout(searchTimer)
    Object.assign(filters, { search: '', from: '', to: '', status: '', type: '', categoryId: '', accountId: '', minAmount: '', maxAmount: '' })
    search.value = ''
    page.value = 1
  }
  watch(scope, () => { clearFilters() }, { flush: 'sync' })
  const query = computed(() => {
    const next: Record<string, string> = {}
    for (const [field, key] of Object.entries(fields)) {
      const value = field === 'search' ? search.value : filters[field as keyof typeof filters]
      if (value) next[key] = value
    }
    if (page.value > 1) next.page = String(page.value)
    if (sort.column !== 'transaction_date') next.sort = sort.column
    if (sort.direction !== 'desc') next.direction = sort.direction
    return next
  })
  watch(query, next => {
    const existing = Object.fromEntries(Object.entries(route.query).filter(([key]) => !['create', 'import'].includes(key)))
    const equal = Object.keys(existing).length === Object.keys(next).length && Object.entries(next).every(([key, value]) => existing[key] === value)
    if (!equal) void router.replace({ query: { ...next, ...(route.query.create ? { create: route.query.create } : {}), ...(route.query.import ? { import: route.query.import } : {}) } })
  })

  const validation = computed(() => {
    const validDate = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)
    if (!validDate(filters.from) || !validDate(filters.to) || (filters.from && filters.to && filters.from > filters.to)) return 'dates'
    try {
      const min = filters.minAmount ? parseMoneyToMinor(filters.minAmount, baseCurrency.value) : undefined
      const max = filters.maxAmount ? parseMoneyToMinor(filters.maxAmount, baseCurrency.value) : undefined
      if ((min !== undefined && (min < 0n || min > BigInt(Number.MAX_SAFE_INTEGER))) || (max !== undefined && (max < 0n || max > BigInt(Number.MAX_SAFE_INTEGER))) || (min !== undefined && max !== undefined && min > max)) return 'amounts'
    }
    catch { return 'amounts' }
    return ''
  })
  const key = computed(() => `org:${scope.value}:${JSON.stringify(query.value)}`)
  const { data, pending, error, refresh } = useLazyAsyncData(key, async (_app, { signal }) => {
    const requestKey = key.value
    const org = currentId.value
    if (!org || !can('transactions.read') || validation.value) return { key: requestKey, rows: [] as TransactionRow[], total: 0 }
    const optional = (value: string) => value.trim() || undefined
    const amount = (value: string) => value ? Number(parseMoneyToMinor(value, baseCurrency.value)) : undefined
    const { data: result, error: failure } = await supabase.rpc('search_transactions', {
      p_organization_id: org, p_search: optional(search.value), p_from_date: optional(filters.from), p_to_date: optional(filters.to),
      p_statuses: filters.status ? [filters.status] : undefined, p_types: filters.type ? [filters.type] : undefined,
      p_category_ids: filters.categoryId ? [filters.categoryId] : undefined, p_account_ids: filters.accountId ? [filters.accountId] : undefined,
      p_min_amount_minor: amount(filters.minAmount), p_max_amount_minor: amount(filters.maxAmount),
      p_sort: sort.column, p_direction: sort.direction, p_limit: pageSize, p_offset: (page.value - 1) * pageSize,
    }).abortSignal(signal)
    if (failure) throw failure
    const rows = result ?? []
    return { key: requestKey, rows, total: rows.length ? Number(rows[0]!.total_count) : 0 }
  }, { default: () => ({ key: '', rows: [] as TransactionRow[], total: 0 }) })
  const rows = computed(() => data.value?.key === key.value ? data.value.rows : [])
  const total = computed(() => data.value?.key === key.value ? data.value.total : 0)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
  watch([pending, data], () => { if (!pending.value && !error.value && data.value?.key === key.value && !rows.value.length && page.value > 1) page.value = 1 })
  watch(revision, () => { page.value = 1; void refresh() })
  const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)
  function toggleSort(column: string) {
    if (sort.column === column) sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'
    else { sort.column = column; sort.direction = 'desc' }
  }
  return { filters, sort, page, pageSize, scope, rows, total, pageCount, pending, error, validation, refresh, activeFilterCount, clearFilters, toggleSort }
}
