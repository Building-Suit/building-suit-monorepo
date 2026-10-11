import type { ChartAccount } from '~/utils/accountTree'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerAccountTreeView(_values: { accounts: ChartAccount[], search: string, scope: string, hydrated: boolean }, _emit: (event: string, ...args: unknown[]) => void) {
const _props = new Proxy(_values, { get: (target, key) => Reflect.get(target, key) ?? Reflect.get({}, key) })
const accounts = computed(() => _props.accounts)
const search = computed(() => _props.search)
const scope = computed(() => _props.scope)
const hydrated = computed(() => _props.hydrated)
const props = _props
const emit = _emit as <K extends keyof ({ activity: [account: ChartAccount], edit: [account: ChartAccount], archive: [account: ChartAccount], classify: [account: ChartAccount], createChild: [account: ChartAccount] })>(event: K, ...args: ({ activity: [account: ChartAccount], edit: [account: ChartAccount], archive: [account: ChartAccount], classify: [account: ChartAccount], createChild: [account: ChartAccount] })[K]) => void
const { t } = useI18n()
const { can, baseCurrency } = useTenant()
const { writesAllowed } = useBilling()
const collapsed = ref(new Set<string>())
watch(() => props.scope, () => { collapsed.value = new Set() }, { flush: 'sync' })
const tree = computed(() => buildAccountTree(props.accounts, t))
const rows = computed(() => flattenAccountTree(tree.value, collapsed.value, props.search))
const count = computed(() => rows.value.filter(row => row.account).length)
const canReadActivity = computed(() => can('accounts.read') && can('reports.read') && can('transactions.read'))
function toggle(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}
function collapseAll() { collapsed.value = new Set(flattenAccountTree(tree.value, new Set()).filter(row => row.children.length).map(row => row.id)) }
const ledgerPresentation = useLedgerPresentation()
return { props, emit, t, can, baseCurrency, writesAllowed, collapsed, tree, rows, count, canReadActivity, toggle, collapseAll, ledgerPresentation, accounts, search, scope, hydrated }
}
