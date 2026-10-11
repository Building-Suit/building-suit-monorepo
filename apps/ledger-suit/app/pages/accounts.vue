<script setup lang="ts">
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { BsFinancialAccountCopy, BsFinancialAccountFilters, BsFinancialAccountForm, BsFinancialAccountRow, BsFinancialAccountsView } from '@building-suit/ui/types/financialAccountsPresentation'
import { useLedgerAccountTreeView } from '~/composables/useLedgerAccountTreeView'
import { useLedgerChartTemplateReviewView } from '~/composables/useLedgerChartTemplateReviewView'
import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'
import type { AccountsReportsRpcDatabase } from '~~/types/accounts-reports-rpc.types'
import type { ChartAccount } from '~/utils/accountTree'

definePageMeta({ layout: 'default' })
/**
 * Called "Accounts" for the user; internally this is the chart of accounts.
 * Balances come from a tenant-scoped RPC that derives them exactly from posted
 * ledger entries — there is no stored or stale balance to display.
 */

const supabase = useSupabaseClient<Database>()
const performanceRpc = useSupabaseClient<AccountsReportsRpcDatabase>()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()
const { currentId, can, baseCurrency } = useTenant()
const { t } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const { refresh: refreshPlanUsage } = usePlanUsage()

useHead({ title: () => `${t('accounts.title')} · ${t('app.name')}` })

const hydrated = ref(false)
onMounted(() => { hydrated.value = true })

const view = computed<'tree' | 'table'>(() => route.query.view === 'table' || (!route.query.view && route.query.tab) ? 'table' : 'tree')
function selectView(value: 'tree' | 'table') { void router.replace({ query: { ...route.query, view: value } }) }
const showArchived = ref(false)
const search = ref('')
const firstRow = ref(0)
const sortField = ref('code')
const sortOrder = ref<1 | -1>(1)
const lastSavedId = ref<string | null>(null)

const { data: canMultiCurrency } = usePlanFeature('multi_currency')

const { data: currencies } = useLazyAsyncData<Array<{ code: string, name: string }>>('reference:currencies', async () => {
  const { data, error } = await supabase
    .from('currencies')
    .select('code,name')
    .eq('is_active', true)
    .order('code')
  if (error) throw error
  return data ?? []
}, { default: () => [] })

type BalanceRow = ChartAccount

const balanceKey = computed(() => `org:${scopedQueryKey({
  environment: String(config.public.supabase.url),
  portal: 'ledger-suit', userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, 'account-balances')}`)

const { data: balances, pending: balancesPending, error: balancesError, refresh: refreshBalances } = useLazyAsyncData<BalanceRow[]>(balanceKey, async (_app, { signal }) => {
  const organizationId = currentId.value
  const requestKey = balanceKey.value
  if (!organizationId) return []

  const { data, error } = await performanceRpc
    .rpc('read_account_balances', { p_organization_id: organizationId })
    .abortSignal(signal)
    .overrideTypes<BalanceRow[], { merge: false }>()
  if (error) throw error
  const rows = data ?? []

  return balanceKey.value === requestKey ? rows : []
}, { default: () => [] })

const GROUP_TYPES: Array<BalanceRow['type']> = [
  'asset', 'liability', 'equity', 'revenue', 'expense',
]

const tab = computed<BalanceRow['type']>(() => {
  const requested = String(route.query.tab ?? 'asset') as BalanceRow['type']
  return GROUP_TYPES.includes(requested) ? requested : 'asset'
})

function selectTab(type: BalanceRow['type']) {
  router.replace({ query: { ...route.query, tab: type } })
}

// Keep the selected organization as a rendering boundary too. RLS remains the
// authority, but a cached response from a previous selection must never flash
// under the next organization's heading while its refresh is in flight.
const scopedBalances = computed(() =>
  (balances.value ?? []).filter(a => a.organization_id === currentId.value),
)

const visible = computed(() =>
  scopedBalances.value.filter(a => showArchived.value || !a.is_archived),
)

const groups = computed(() =>
  GROUP_TYPES.map((type) => {
    const rows = visible.value.filter(a => a.type === type)
    // The view contains each account's direct entries, not rolled-up children.
    // Include historical parent postings exactly once and subtract contra balances.
    const parentIds = new Set(rows.map(r => r.parent_account_id).filter(Boolean) as string[])
    const total = rows.reduce((sum, r) => sum + BigInt(r.statement_balance_minor), 0n).toString()

    return { type, label: t(`accounts.groups.${type}`), rows, parentIds, total }
  }),
)

const activeGroup = computed(() => groups.value.find(group => group.type === tab.value)!)

const filteredRows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return activeGroup.value.rows.filter((account: ChartAccount) =>
    !query || account.name.toLocaleLowerCase().includes(query) || account.code?.toLocaleLowerCase().includes(query),
  )
})
const hasArchivedInGroup = computed(() => scopedBalances.value.some(row => row.type === tab.value && row.is_archived))
const hiddenSavedAccount = computed(() => {
  const account = scopedBalances.value.find(row => row.account_id === lastSavedId.value)
  if (view.value === 'tree') return account && !flattenAccountTree(buildAccountTree(visible.value, t), new Set(), search.value).some(row => row.id === account.account_id) ? account : null
  return account && (filteredRows.value.length > 25 || !filteredRows.value.some(row => row.account_id === account.account_id)) ? account : null
})

watch([search, showArchived, tab, currentId], () => { firstRow.value = 0 })

function clearSearch() {
  search.value = ''
}

async function revealSavedAccount() {
  const account = hiddenSavedAccount.value
  if (!account) return
  search.value = account.name
  if (account.is_archived) showArchived.value = true
  await router.replace({ query: { ...route.query, view: view.value, tab: account.type } })
}

const hasAccounts = computed(() => scopedBalances.value.length > 0)

const activityAccountId = ref<string | null>(null)
watch(balanceKey, () => { activityAccountId.value = null }, { flush: 'sync' })
const canReadActivity = computed(() => can('accounts.read') && can('reports.read') && can('transactions.read'))

const statementAccount = ref<BalanceRow | null>(null)
watch(balanceKey, () => { statementAccount.value = null })

const editorOpen = ref(false)
const editing = ref<BalanceRow | null>(null)
const submitting = ref(false)
const editorError = ref<string | null>(null)
const form = reactive({
  name: '', code: '', type: 'asset' as BalanceRow['type'], subtype: 'bank', currency: baseCurrency.value,
  normalBalance: 'debit' as BalanceRow['normal_balance'], contraAccountId: '',
  accountRole: 'posting' as BalanceRow['account_role'], parentAccountId: '',
  controlSubledgerType: 'customer' as 'customer' | 'supplier',
})

watch(balanceKey, () => {
  search.value = ''
  showArchived.value = false
  sortField.value = 'code'
  sortOrder.value = 1
  lastSavedId.value = null
  editorOpen.value = false
  editing.value = null
  editorError.value = null
  Object.assign(form, { name: '', code: '', contraAccountId: '', parentAccountId: '', accountRole: 'posting', controlSubledgerType: 'customer' })
}, { flush: 'sync' })

const subtypeOptions: Record<BalanceRow['type'], string[]> = {
  asset: ['cash', 'bank', 'mobile_wallet', 'accounts_receivable', 'inventory', 'prepaid_expenses', 'equipment', 'vehicles', 'property', 'other_asset'],
  liability: ['accounts_payable', 'credit_card', 'loan', 'taxes_payable', 'accrued_expenses', 'other_liability'],
  equity: ['owner_capital', 'retained_earnings', 'owner_drawings', 'opening_balance_equity', 'other_equity'],
  revenue: ['product_sales', 'service_revenue', 'commission', 'other_income'],
  expense: ['cost_of_sales', 'salaries', 'rent', 'utilities', 'marketing', 'transportation', 'software', 'professional_fees', 'bank_fees', 'interest_expense', 'depreciation', 'taxes', 'other_expense'],
}

function openCreate(parent?: BalanceRow) {
  editing.value = null
  Object.assign(form, {
    name: '',
    code: '',
    type: parent?.type ?? tab.value,
    subtype: parent?.subtype ?? subtypeOptions[tab.value][0]!,
    currency: parent?.currency ?? baseCurrency.value,
    normalBalance: defaultAccountNature(parent?.type ?? tab.value, parent?.subtype),
    contraAccountId: '', accountRole: 'posting', parentAccountId: parent?.account_id ?? '', controlSubledgerType: 'customer',
  })
  editorError.value = null
  editorOpen.value = true
}

watch(() => route.query.create, (value) => {
  if (value === 'account' && can('accounts.create')) {
    openCreate()
    void navigateTo('/accounts', { replace: true })
  }
}, { immediate: true })

function openEdit(row: BalanceRow) {
  editing.value = row
  Object.assign(form, { name: row.name, code: row.code ?? '', type: row.type, subtype: row.subtype,
    currency: row.currency, normalBalance: row.normal_balance, contraAccountId: row.contra_account_id ?? '',
    accountRole: row.account_role, parentAccountId: row.parent_account_id ?? '', controlSubledgerType: row.control_subledger_type ?? 'customer' })
  editorError.value = null
  editorOpen.value = true
}

watch(() => form.type, (type) => {
  if (!subtypeOptions[type].includes(form.subtype)) form.subtype = subtypeOptions[type][0]!
})

watch(() => form.subtype, () => {
  if (!editing.value) {
    form.normalBalance = defaultAccountNature(form.type, form.subtype)
    form.contraAccountId = ''
  }
})

const natureLocked = computed(() => Boolean(editing.value && (
  editing.value.account_role === 'group' || editing.value.control_subledger_type === 'inventory' || editing.value.classification_locked || editing.value.is_system
  || scopedBalances.value.some((account: ChartAccount) => account.contra_account_id === editing.value?.account_id)
)))
const contraOptions = computed(() => scopedBalances.value.filter((account: ChartAccount) =>
  account.account_role === 'posting' && account.account_id !== editing.value?.account_id && !account.is_archived
  && !account.contra_account_id && account.type === form.type && account.currency === form.currency
  && account.normal_balance !== form.normalBalance,
))
watch([() => form.normalBalance, () => form.currency], () => {
  if (!natureLocked.value && !contraOptions.value.some((account: ChartAccount) => account.account_id === form.contraAccountId)) {
    form.contraAccountId = ''
  }
})
const parentOptions = computed(() => scopedBalances.value.filter((account: ChartAccount) =>
  account.account_role === 'group' && !account.is_archived
  && account.type === form.type && account.currency === form.currency,
))
watch([() => form.type, () => form.currency], () => {
  if (!editing.value && !parentOptions.value.some((account: ChartAccount) => account.account_id === form.parentAccountId)) form.parentAccountId = ''
})
watch(() => form.accountRole, (role) => {
  if (editing.value) return
  if (role !== 'posting') form.contraAccountId = ''
  if (role === 'control') {
    form.type = form.controlSubledgerType === 'customer' ? 'asset' : 'liability'
    form.subtype = form.controlSubledgerType === 'customer' ? 'accounts_receivable' : 'accounts_payable'
    form.normalBalance = form.controlSubledgerType === 'customer' ? 'debit' : 'credit'
  }
})
watch(() => form.controlSubledgerType, (subledger) => {
  if (editing.value || form.accountRole !== 'control') return
  form.type = subledger === 'customer' ? 'asset' : 'liability'
  form.subtype = subledger === 'customer' ? 'accounts_receivable' : 'accounts_payable'
  form.normalBalance = subledger === 'customer' ? 'debit' : 'credit'
})
function accountName(id: string) {
  return scopedBalances.value.find((account: ChartAccount) => account.account_id === id)?.name ?? t('common.dash')
}

async function saveAccount() {
  if (!currentId.value || submitting.value) return
  const organizationId = currentId.value
  const requestKey = balanceKey.value
  const editedId = editing.value?.account_id
  submitting.value = true
  editorError.value = null
  try {
    const call = editing.value
      ? supabase.rpc('update_account', {
          p_account_id: editing.value.account_id,
          p_name: form.name,
          p_code: form.code || undefined,
          p_normal_balance: natureLocked.value ? undefined : form.normalBalance,
          p_contra_account_id: natureLocked.value ? undefined : form.contraAccountId || undefined,
          p_clear_contra: !natureLocked.value && !form.contraAccountId,
        })
      : supabase.rpc('create_account', {
          p_organization_id: organizationId,
          p_name: form.name,
          p_code: form.code || undefined,
          p_type: form.type,
          p_subtype: form.subtype as Database['public']['Enums']['account_subtype'],
          p_currency: form.currency,
          p_normal_balance: form.normalBalance,
          p_contra_account_id: form.accountRole === 'posting' ? form.contraAccountId || undefined : undefined,
          p_account_role: form.accountRole,
          p_control_subledger_type: form.accountRole === 'control' ? form.controlSubledgerType : undefined,
          p_parent_account_id: form.parentAccountId || undefined,
        })
    const { data, error } = await call
    if (error) throw error
    if (balanceKey.value !== requestKey) return
    lastSavedId.value = editedId ?? String(data)
    if (!editedId) await refreshPlanUsage()
    if (balanceKey.value !== requestKey) return
    editorOpen.value = false
    toasts.success(t('accounts.saved'))
    await refreshBalances()
    await refreshNuxtData(['org:accounts', 'org:categories'])
  }
  catch (error) { if (balanceKey.value === requestKey) editorError.value = describeError(error) }
  finally { submitting.value = false }
}

async function archiveAccount(row: BalanceRow) {
  const organizationId = currentId.value
  const { error } = await supabase.rpc('archive_account' as never, { p_account_id: row.account_id } as never)
  if (currentId.value !== organizationId) return
  if (error) return toasts.error(t('errors.generic'), describeError(error))
  toasts.success(t('accounts.archived'))
  await refreshBalances()
  await refreshNuxtData(['org:accounts', 'org:categories'])
}
const { dirty: overlayDirty0 } = useRecordAction(() => form, computed(() => Boolean(editorOpen.value)))
const ledgerPresentation = useLedgerPresentation()
const ledgerUsage = useLedgerUsagePresentation()
const treePresentation = reactive(useLedgerAccountTreeView(reactive({ get accounts() { return visible.value }, get search() { return search.value }, get scope() { return balanceKey.value }, get hydrated() { return hydrated.value } })))
const chartReview = reactive(useLedgerChartTemplateReviewView())
const controls = useLedgerControlPresentation(reactive({ get accounts() { return scopedBalances.value }, get active() { return can('controls.reconcile') && scopedBalances.value.some(account => account.account_role === 'control') } }), () => { void refreshBalances(); void refreshNuxtData(['org:accounts']) })
const classificationPresentation = useLedgerAccountClassificationPresentation(reactive({ get account() { return statementAccount.value }, get scope() { return balanceKey.value } }), () => { statementAccount.value = null })
const activityPresentation = useLedgerActivityPresentation(reactive({ get accountId() { return activityAccountId.value }, get scope() { return balanceKey.value } }), () => { activityAccountId.value = null })
const activityForm = activityPresentation.form
const classificationForm = classificationPresentation.form
const adjustmentForm = controls.form
const editorForm = computed<BsFinancialAccountForm>({ get: () => ({ ...form }), set: value => { Object.assign(form, { ...value, type: value.type as typeof form.type }) } })
const pageFilters = computed<BsFinancialAccountFilters>({ get: () => ({ view: view.value, tab: tab.value, search: search.value, archived: showArchived.value, first: firstRow.value, sortField: sortField.value, sortOrder: sortOrder.value, template: chartReview.selected, controlDate: controls.date.value }), set: value => { if (value.view !== view.value) selectView(value.view); if (value.tab !== tab.value && GROUP_TYPES.includes(value.tab as BalanceRow['type'])) selectTab(value.tab as BalanceRow['type']); search.value = value.search; showArchived.value = value.archived; firstRow.value = value.first; sortField.value = value.sortField; sortOrder.value = value.sortOrder; if (chartReview.reviewedChartTemplates.some(template => template.key === value.template)) chartReview.selected = value.template as typeof chartReview.selected; controls.date.value = value.controlDate } })
const pageCopy = computed<BsFinancialAccountCopy>(() => ({
 title: t('accounts.title'), subtitle: t('accountTree.subtitle'), context: t('pageContext.label'), showArchived: t('accounts.showArchived'), archived: t('accounts.archived'), add: t('accounts.add'), edit: t('accounts.edit'), archive: t('accounts.archive'), classify: t('statementClassification.title'), addChild: t('accountTree.addChild'), more: t('accountTree.more'), treeView: t('accountTree.treeView'), tableView: t('accountTree.tableView'), view: t('accountTree.view'), tabs: t('accounts.tabsLabel'), search: t('accounts.searchLabel'), searchPlaceholder: t('accounts.searchPlaceholder'), clear: t('accounts.clearSearch'), reveal: t('accounts.revealSaved'), loading: t('accounts.loading'), failed: t('accounts.loadError'), failedHint: t('accounts.loadErrorHint'), retry: t('accounts.retry'), empty: t('accounts.emptyTitle'), emptyHint: t('accounts.emptyHint'), noResults: t('accounts.noResults'), noResultsHint: t('accounts.noResultsHint'), treeTitle: t('accountTree.title'), expandAll: t('accountTree.expandAll'), collapseAll: t('accountTree.collapseAll'), account: t('accounts.account'), code: t('accounts.code'), role: t('accounts.role'), subledger: t('controls.subledgerType'), subtype: t('accounts.subtype'), normal: t('accounts.normalBalance'), contra: t('accounts.contraAccount'), currency: t('accounts.currency'), entries: t('accounts.entries'), balance: t('accounts.balance'), actions: t('accounts.actions'), previous: t('accounts.previousPage'), next: t('accounts.nextPage'), pages: t('accounts.pages'), liquid: t('accounts.liquid'), bindingLocked: t('controls.bindingLocked'), save: t('common.save'), cancel: t('common.cancel'), name: t('accounts.name'), roleHint: t('accounts.roleHint'), directBlocked: t('controls.directPostingBlocked'), bindingHint: t('controls.bindingLockedHint'), type: t('accounts.type'), multiCurrency: t('accounts.multiCurrencyUpgrade'), parent: t('accounts.parentGroup'), natureHint: t('accounts.natureHint'), contraHint: t('accounts.contraHint'), natureLocked: t('accounts.natureLocked'),
}))
function displayAccountMoney(amount: bigint | number | string) { return formatPresentationMoney(amount, { currency: ledgerPresentation.currency(), locale: ledgerPresentation.locale, unit: 'minor', numberingSystem: 'latn' }) }
function accountDisplay(account: ChartAccount, tree = false): BsFinancialAccountRow {
 const balance = accountBalanceDisplay(account.net_debit_minor)
 return { id: account.account_id, code: account.code || t('common.dash'), name: account.name, role: t(`accounts.roles.${account.account_role}`), subledger: account.control_subledger_type ? t(`controls.subledgers.${account.control_subledger_type}`) : t('common.dash'), subtype: t(`accounts.subtypes.${account.subtype}`), normal: t(`accounts.sides.${account.normal_balance}`), contra: account.contra_account_id ? accountName(account.contra_account_id) : t('common.dash'), currency: account.currency, entries: String(account.entry_count), balance: account.account_role === 'group' ? t('accounts.groupBalance') : displayAccountMoney(balance.amount), side: account.account_role === 'group' ? '' : t(`accounts.sides.${balance.side}`), archived: account.is_archived, liquid: account.is_liquid, bindingLocked: account.control_binding_locked, canActivity: account.account_role !== 'group' && canReadActivity.value, canEdit: can('accounts.update') && (!tree || treePresentation.writesAllowed), canArchive: can('accounts.archive') && !account.is_archived && (!tree || treePresentation.writesAllowed), canClassify: ['posting', 'control'].includes(account.account_role), canCreateChild: tree && account.account_role === 'group' && !account.is_archived && can('accounts.create') && treePresentation.writesAllowed }
}
const pageView = computed<BsFinancialAccountsView>(() => ({
 ready: hydrated.value, context: ledgerPresentation.context(), canCreate: can('accounts.create'), loading: balancesPending.value, failed: !!balancesError.value, hasAccounts: hasAccounts.value, searchCount: view.value === 'table' ? t('accounts.resultCount', { count: filteredRows.value.length, total: activeGroup.value.rows.length, group: activeGroup.value.label }) : t('accountTree.accountCount', { count: visible.value.length }), savedHidden: hiddenSavedAccount.value ? t('accounts.savedHidden', { name: hiddenSavedAccount.value.name }) : '', treeHint: t('accountTree.hint', { currency: baseCurrency.value }), groupLabel: activeGroup.value.label, groupTotal: displayAccountMoney(activeGroup.value.total), totalHint: t('accounts.totalHint', { currency: baseCurrency.value }), emptyTitle: search.value || hasArchivedInGroup.value ? t('accounts.noResults') : t('accounts.emptyGroupTitle', { group: activeGroup.value.label }), emptyHint: search.value || hasArchivedInGroup.value ? t('accounts.noResultsHint') : t('accounts.emptyGroupHint'), emptyAction: search.value ? t('accounts.clearSearch') : hasArchivedInGroup.value ? t('accounts.showArchived') : can('accounts.create') ? t('accounts.add') : '', groups: GROUP_TYPES.map(value => ({ value, label: t(`accounts.groups.${value}`) })), rows: filteredRows.value.map(account => accountDisplay(account)),
 treeRows: treePresentation.rows.map(node => ({ ...(node.account ? accountDisplay(node.account, true) : { id: node.id, code: '', name: node.label, role: '', subledger: '', subtype: '', normal: '', contra: '', currency: '', entries: '', balance: '', side: '', archived: false, liquid: false, bindingLocked: false, canActivity: false, canEdit: false, canArchive: false, canClassify: false, canCreateChild: false }), id: node.id, name: node.label, depth: node.depth, hasChildren: !!node.children.length, expanded: node.expanded, count: node.kind !== 'account' || node.children.length ? t('accountTree.accountCount', { count: node.count }) : '', toggleLabel: t(node.expanded ? 'accountTree.collapse' : 'accountTree.expand', { name: node.label }), detail: node.account ? `${t(`accounts.roles.${node.account.account_role}`)}${node.account.control_subledger_type ? ` · ${t(`controls.subledgers.${node.account.control_subledger_type}`)}` : node.account.account_role === 'posting' ? ` · ${t(`accounts.subtypes.${node.account.subtype}`)}` : ''}` : '', balance: node.account && node.account.account_role !== 'group' && !node.children.length ? displayAccountMoney(accountBalanceDisplay(node.account.net_debit_minor).amount) : displayAccountMoney(node.total), side: node.account && node.account.account_role !== 'group' && !node.children.length ? t(`accounts.sides.${accountBalanceDisplay(node.account.net_debit_minor).side}`) : '', subtotal: node.children.length ? t('accountTree.subtotal') : '', direct: node.children.length && node.account?.account_role === 'posting' ? `${t('accountTree.directBalance')}: ${displayAccountMoney(accountBalanceDisplay(node.account.net_debit_minor).amount)} ${t(`accounts.sides.${accountBalanceDisplay(node.account.net_debit_minor).side}`)}` : '', actionsLabel: t('accountTree.actionsFor', { name: node.label }) })),
 editor: { visible: editorOpen.value, title: t(editing.value ? 'accounts.edit' : 'accounts.add'), editing: !!editing.value, pending: submitting.value, dirty: overlayDirty0.value, error: editorError.value, usage: ledgerUsage.item('max_accounts'), canConfigureControls: can('controls.configure'), bindingLocked: !!editing.value?.control_binding_locked, multiCurrency: !!canMultiCurrency.value, natureLocked: natureLocked.value, parentName: editing.value && form.parentAccountId ? accountName(form.parentAccountId) : '', roles: ['posting', ...(can('controls.configure') ? ['control'] : []), 'group'].map(value => ({ value, label: t(`accounts.roles.${value}`) })), subledgers: ['customer', 'supplier'].map(value => ({ value, label: t(`controls.subledgers.${value}`) })), types: GROUP_TYPES.map(value => ({ value, label: t(`accounts.groups.${value}`) })), subtypes: subtypeOptions[form.type].map(value => ({ value, label: t(`accounts.subtypes.${value}`) })), currencies: currencies.value.map(value => ({ value: value.code, label: `${value.code} — ${value.name}` })), parents: [{ value: '', label: t('accounts.noParent') }, ...parentOptions.value.map(value => ({ value: value.account_id, label: value.name }))], natures: ['debit', 'credit'].map(value => ({ value, label: t(`accounts.sides.${value}`) })), contras: [{ value: '', label: t('accounts.noContra') }, ...(natureLocked.value && form.contraAccountId ? [{ value: form.contraAccountId, label: accountName(form.contraAccountId) }] : natureLocked.value ? [] : contraOptions.value.map(value => ({ value: value.account_id, label: value.name })))] },
 templates: { visible: chartReview.visible, title: t('chartTemplates.title'), hint: t('chartTemplates.hint'), review: t('chartTemplates.reviewRequired'), noApply: t('chartTemplates.noApply'), choose: t('chartTemplates.choose'), close: t('common.close'), preview: t('chartTemplates.preview'), parent: t('chartTemplates.parent'), presentation: t('chartTemplates.presentation'), description: t(`chartTemplates.templates.${chartReview.selected}.description`), choices: chartReview.reviewedChartTemplates.map(template => ({ value: template.key, label: t(`chartTemplates.templates.${template.key}.title`) })), rows: chartReview.template.accounts.map(account => ({ id: account.code, code: account.code, name: t(`chartTemplates.accounts.${account.nameKey}`), parent: account.parentCode || t('common.dash'), role: t(`accounts.roles.${account.role}`), line: account.statementLine ? t(`chartTemplates.lines.${account.statementLine}`) : t('common.dash') })) }, controls: { copy: controls.copy.value, view: controls.view.value }, classification: { copy: classificationPresentation.copy.value, view: classificationPresentation.view.value }, activity: { copy: activityPresentation.copy.value, view: activityPresentation.view.value },
}))
function accountById(id: string) { return scopedBalances.value.find(account => account.account_id === id) }
function createAccountFromPresentation(id?: string) { openCreate(id ? accountById(id) : undefined) }
function editAccountFromPresentation(id: string) { const account = accountById(id); if (account) openEdit(account) }
function archiveAccountFromPresentation(id: string) { const account = accountById(id); if (account) return archiveAccount(account) }
function classifyAccountFromPresentation(id: string) { statementAccount.value = accountById(id) || null }
function emptyAccountAction() { if (search.value) clearSearch(); else if (hasArchivedInGroup.value) showArchived.value = true; else openCreate() }
</script>
<template>
 <BsFinancialAccountsPage v-model:filters="pageFilters" v-model:editor="editorForm" v-model:classification="classificationForm" v-model:adjustment="adjustmentForm" v-model:activity="activityForm" :copy="pageCopy" :view="pageView" @create="createAccountFromPresentation" @edit="editAccountFromPresentation" @archive="archiveAccountFromPresentation" @classify="classifyAccountFromPresentation" @open-activity="activityAccountId = $event" @clear-search="clearSearch" @reveal="revealSavedAccount" @retry="refreshBalances" @toggle="treePresentation.toggle" @expand-all="treePresentation.expandAll" @collapse-all="treePresentation.collapseAll" @empty-action="emptyAccountAction" @close-templates="chartReview.close" @close-editor="editorOpen = false" @save-editor="saveAccount" @close-classification="statementAccount = null" @save-classification="classificationPresentation.save" @retry-classification="classificationPresentation.retry" @open-adjustment="controls.open" @close-adjustment="controls.close" @save-adjustment="controls.save" @close-activity="activityAccountId = null" @activity-back="activityPresentation.back" @activity-apply="activityPresentation.apply" @activity-retry="activityPresentation.retry" @activity-page="activityPresentation.page" @activity-journal="activityPresentation.journal" @activity-account="activityPresentation.account"/>
</template>
