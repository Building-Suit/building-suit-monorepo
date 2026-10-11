import type { ChartAccount } from '~/utils/accountTree'

/** Product-owned chart hierarchy and account capability configuration. */
export function useLedgerAccountTreeView(props: { accounts: ChartAccount[], search: string, scope: string, hydrated: boolean }) {
const accounts = computed(() => props.accounts)
const search = computed(() => props.search)
const scope = computed(() => props.scope)
const hydrated = computed(() => props.hydrated)
const { t } = useI18n()
const { can, baseCurrency } = useTenant()
const { writesAllowed } = useBilling()
const tree = computed(() => buildAccountTree(props.accounts, t))
const branches = computed(() => flattenAccountTree(tree.value, new Set()).filter(row => row.children.length).map(row => row.id))
const { collapsed, toggle, collapseAll, expandAll } = useTreeExpansion(scope, branches)
const rows = computed(() => flattenAccountTree(tree.value, collapsed.value, props.search))
const count = computed(() => rows.value.filter(row => row.account).length)
const canReadActivity = computed(() => can('accounts.read') && can('reports.read') && can('transactions.read'))
const ledgerPresentation = useLedgerPresentation()
return { props, t, can, baseCurrency, writesAllowed, collapsed, tree, rows, count, canReadActivity, toggle, collapseAll, expandAll, ledgerPresentation, accounts, search, scope, hydrated }
}
