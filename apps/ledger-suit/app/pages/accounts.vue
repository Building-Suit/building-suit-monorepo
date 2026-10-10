<script setup lang="ts">
import { resolveTemplateElement } from '~/utils/templateElement'
import { useLedgerAccountActivityDialogView } from '~/composables/useLedgerAccountActivityDialogView'
import { useLedgerAccountStatementClassificationDialogView } from '~/composables/useLedgerAccountStatementClassificationDialogView'
import { useLedgerAccountTreeView } from '~/composables/useLedgerAccountTreeView'
import { useLedgerChartTemplateReviewView } from '~/composables/useLedgerChartTemplateReviewView'
import { useLedgerControlReconciliationPanelView } from '~/composables/useLedgerControlReconciliationPanelView'
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

const view = computed(() => route.query.view === 'table' || (!route.query.view && route.query.tab) ? 'table' : 'tree')
function selectView(value: 'tree' | 'table') { void router.replace({ query: { ...route.query, view: value } }) }
const showArchived = ref(false)
const search = ref('')
const firstRow = ref(0)
const sortField = ref('code')
const sortOrder = ref<1 | -1>(1)
const lastSavedId = ref<string | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

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
  searchInput.value?.focus()
}

async function revealSavedAccount() {
  const account = hiddenSavedAccount.value
  if (!account) return
  search.value = account.name
  if (account.is_archived) showArchived.value = true
  await router.replace({ query: { ...route.query, view: view.value, tab: account.type } })
  searchInput.value?.focus()
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
</script>

<template>
  <BsStack :data-hydrated="hydrated" gap="lg">
    <BsPageHeader
      :title="t('accounts.title')"
      :subtitle="t('accountTree.subtitle')"
      :context="ledgerPresentation.context(undefined, undefined, undefined)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    >
      <template #actions>
        <BsFieldLabel><BsCheckbox v-model="showArchived" bare />
          {{ t('accounts.showArchived') }}</BsFieldLabel>
        <BsButton v-if="view === 'tree' && can('accounts.create')" type="button" :disabled="!hydrated" variant="primary" @click="openCreate()">{{ t('accounts.add') }}</BsButton>
      </template>
    </BsPageHeader>
    <BsWorkflowScope :factory="useLedgerChartTemplateReviewView" :input="{  }">
      <template #default="{ state: ledgerView1 }">
        <BsCard v-if="ledgerView1.visible" aria-labelledby="chart-template-heading" data-chart-template-review as="section" padding="md">
          <BsStack gap="md">
            <BsInline gap="md" :wrap="true" align="start" justify="between">
              <BsBox>
                <BsHeading id="chart-template-heading" :level="2" size="h2">{{ ledgerView1.t('chartTemplates.title') }}</BsHeading>
                <BsText size="sm" tone="muted">{{ ledgerView1.t('chartTemplates.hint') }}</BsText>
              </BsBox>
              <BsButton type="button" size="sm" @click="ledgerView1.close">{{ ledgerView1.t('common.close') }}</BsButton>
            </BsInline>
            <BsBox role="note" padding="lg" border radius="control">
              <BsText emphasis="semibold">{{ ledgerView1.t('chartTemplates.reviewRequired') }}</BsText>
              <BsText>{{ ledgerView1.t('chartTemplates.noApply') }}</BsText>
            </BsBox>
            <BsInline role="group" :aria-label="ledgerView1.t('chartTemplates.choose')" gap="sm" :wrap="true">
              <BsButton
                v-for="item in ledgerView1.reviewedChartTemplates"
                :key="item.key"
                variant="chip"
                type="button"
                :aria-pressed="ledgerView1.selected === item.key"
                @click="ledgerView1.selected = item.key"
              >{{ ledgerView1.t(`chartTemplates.templates.${item.key}.title`) }}</BsButton>
            </BsInline>
            <BsText size="sm" tone="muted">{{ ledgerView1.t(`chartTemplates.templates.${ledgerView1.selected}.description`) }}</BsText>
            <BsDataTable
              :value="ledgerView1.template.accounts"
              row-key="code"
              :label="ledgerView1.t('chartTemplates.preview')"
              :columns="[{ key: 'code', field: 'code', header: ledgerView1.t('accounts.code') }, { key: 'column2', header: ledgerView1.t('accounts.account') }, { key: 'column3', header: ledgerView1.t('chartTemplates.parent') }, { key: 'column4', header: ledgerView1.t('accounts.role') }, { key: 'column5', header: ledgerView1.t('chartTemplates.presentation') }]"
            >
              <template #cell-code="{ row: account }">
                <BsText dir="ltr" as="span" size="xs">{{ account.code }}</BsText>
              </template>
              <template #cell-column2="{ row: account }">{{ ledgerView1.t(`chartTemplates.accounts.${account.nameKey}`) }}</template>
              <template #cell-column3="{ row: account }">
                <BsText dir="ltr" as="span" size="xs">{{ account.parentCode ?? ledgerView1.t('common.dash') }}</BsText>
              </template>
              <template #cell-column4="{ row: account }">{{ ledgerView1.t(`accounts.roles.${account.role}`) }}</template>
              <template #cell-column5="{ row: account }">{{ account.statementLine ? ledgerView1.t(`chartTemplates.lines.${account.statementLine}`) : ledgerView1.t('common.dash') }}</template>
            </BsDataTable>
          </BsStack>
        </BsCard>
      </template>
    </BsWorkflowScope>
    <BsInline :aria-label="t('accountTree.view')" role="group" gap="sm" :wrap="true">
      <BsButton variant="chip" type="button" :aria-pressed="view === 'tree'" :disabled="!hydrated" @click="selectView('tree')">{{ t('accountTree.treeView') }}</BsButton>
      <BsButton variant="chip" type="button" :aria-pressed="view === 'table'" :disabled="!hydrated" @click="selectView('table')">{{ t('accountTree.tableView') }}</BsButton>
    </BsInline>
    <BsInline v-if="view === 'table'" role="tablist" :aria-label="t('accounts.tabsLabel')" gap="xs" :wrap="false">
      <BsButton
        v-for="type in GROUP_TYPES"
        :id="`account-tab-${type}`"
        :key="type"
        variant="tab"
        type="button"
        role="tab"
        :aria-controls="`account-panel-${type}`"
        :aria-selected="tab === type"
        @click="selectTab(type)"
      >{{ t(`accounts.groups.${type}`) }}</BsButton>
    </BsInline>
    <BsInline gap="md" :wrap="true" align="end">
      <BsBox>
        <BsFieldLabel for="account-search">{{ t('accounts.searchLabel') }}</BsFieldLabel>
        <BsInput
          id="account-search"
          ref="searchInput"
          v-model="search"
          type="search"
          :placeholder="t('accounts.searchPlaceholder')"
          :aria-controls="view === 'tree' ? 'accounts-tree' : 'accounts-table'"
          :disabled="!hydrated || balancesPending || !!balancesError"
        />
      </BsBox>
      <BsButton v-if="search" type="button" @click="clearSearch">{{ t('accounts.clearSearch') }}</BsButton>
      <BsText v-if="!balancesPending && !balancesError" role="status" data-testid="account-result-count" size="sm" tone="muted">{{ view === 'table' ? t('accounts.resultCount', { count: filteredRows.length, total: activeGroup.rows.length, group: activeGroup.label }) : t('accountTree.accountCount', { count: visible.length }) }}</BsText>
    </BsInline>
    <BsCard v-if="hiddenSavedAccount && !balancesPending && !balancesError" role="status" as="div" padding="md">
      <BsStack gap="md">
        <BsText size="sm">{{ t('accounts.savedHidden', { name: hiddenSavedAccount.name }) }}</BsText>
        <BsButton type="button" @click="revealSavedAccount">{{ t('accounts.revealSaved') }}</BsButton>
      </BsStack>
    </BsCard>
    <BsBox v-if="balancesPending" role="status" :aria-label="t('accounts.loading')">
      <BsVisuallyHidden>{{ t('accounts.loading') }}</BsVisuallyHidden>
      <BsSectionSkeleton variant="table" :rows="8" />
    </BsBox>
    <BsCard v-else-if="balancesError" role="alert" as="div" padding="lg">
      <BsStack gap="md">
        <BsHeading :level="2" size="body">{{ t('accounts.loadError') }}</BsHeading>
        <BsText size="sm" tone="muted">{{ t('accounts.loadErrorHint') }}</BsText>
        <BsButton type="button" @click="refreshBalances()">{{ t('accounts.retry') }}</BsButton>
      </BsStack>
    </BsCard>
    <BsEmptyState
      v-else-if="!hasAccounts && view === 'table'"
      :title="t('accounts.emptyTitle')"
      :description="t('accounts.emptyHint')"
      :action-label="can('accounts.create') ? t('accounts.add') : undefined"
      @action="openCreate()"
    />
    <BsWorkflowScope
      v-else-if="view === 'tree'"
      :factory="useLedgerAccountTreeView"
      :input="{ accounts: (visible), search: (search), scope: (balanceKey), hydrated: (hydrated) }"
      @activity="(account: ChartAccount) => activityAccountId = account.account_id"
      @edit="openEdit"
      @archive="archiveAccount"
      @classify="(account: ChartAccount) => statementAccount = account"
      @create-child="openCreate"
    >
      <template #default="{ state: ledgerView2 }">
        <BsCard :aria-label="ledgerView2.t('accountTree.title')" as="section" padding="none" overflow="hidden">
          <BsInline gap="md" :wrap="true" justify="between" padding="lg">
            <BsBox>
              <BsHeading :level="2" size="h3">{{ ledgerView2.t('accountTree.title') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ ledgerView2.t('accountTree.hint', { currency: ledgerView2.baseCurrency }) }}</BsText>
            </BsBox>
            <BsInline gap="sm" :wrap="true">
              <BsButton type="button" :disabled="!ledgerView2.hydrated || !!ledgerView2.search" size="sm" @click="ledgerView2.collapsed = new Set()">{{ ledgerView2.t('accountTree.expandAll') }}</BsButton>
              <BsButton type="button" :disabled="!ledgerView2.hydrated || !!ledgerView2.search" size="sm" @click="ledgerView2.collapseAll">{{ ledgerView2.t('accountTree.collapseAll') }}</BsButton>
            </BsInline>
          </BsInline>
          <BsText v-if="ledgerView2.search" role="status" size="sm" tone="muted">{{ ledgerView2.t('accountTree.searchCount', { count: ledgerView2.count }) }}</BsText>
          <BsDataTable
            id="accounts-tree"
            :value="ledgerView2.rows"
            row-key="id"
            :label="ledgerView2.t('accountTree.title')"
            :columns="[{ key: 'column1', header: ledgerView2.t('accounts.account') }, { key: 'column2', header: ledgerView2.t('accounts.balance'), align: 'end' as const }]"
          >
            <template #cell-column1="{ row: node }">
              <BsHierarchyBranch :depth="node.depth">
                <BsButton
                  v-if="node.children.length"
                  type="button"
                  :aria-expanded="node.expanded"
                  :aria-label="ledgerView2.t(node.expanded ? 'accountTree.collapse' : 'accountTree.expand', { name: node.label })"
                  :disabled="!ledgerView2.hydrated || !!ledgerView2.search"
                  @click="ledgerView2.toggle(node.id)"
                >
                  <BsIcon :name="node.expanded ? 'arrowDown' : 'arrowRight'" directional :size="16" />
                </BsButton>
                <BsHierarchyLeaf v-else aria-hidden="true" as="span">
                  <BsText as="span" />
                </BsHierarchyLeaf>
                <BsBox grow>
                  <BsInline gap="sm" :wrap="true" align="baseline">
                    <BsText v-if="node.account?.code" dir="ltr" as="span" size="sm" tone="muted">{{ node.account.code }}</BsText>
                    <BsButton
                      v-if="node.account?.account_role !== 'group' && ledgerView2.canReadActivity"
                      variant="link"
                      type="button"
                      :disabled="!ledgerView2.hydrated"
                      align="start"
                      @click="ledgerView2.emit('activity', node.account)"
                    >{{ node.label }}</BsButton>
                    <BsText v-else as="span">{{ node.label }}</BsText>
                    <BsText v-if="node.kind !== 'account' || node.children.length" as="span">{{ ledgerView2.t('accountTree.accountCount', { count: node.count }) }}</BsText>
                    <BsBadge v-if="node.account?.is_archived">{{ ledgerView2.t('accounts.archived') }}</BsBadge>
                  </BsInline>
                  <BsText v-if="node.account" size="sm" tone="muted">{{ ledgerView2.t(`accounts.roles.${node.account.account_role}`) }}
      <template v-if="node.account.control_subledger_type"> · {{ ledgerView2.t(`controls.subledgers.${node.account.control_subledger_type}`) }}</template><template v-else-if="node.account.account_role === 'posting'"> · {{ ledgerView2.t(`accounts.subtypes.${node.account.subtype}`) }}</template></BsText>
                  <BsDisclosure v-if="node.account && ((ledgerView2.writesAllowed && (ledgerView2.can('accounts.update') || (ledgerView2.can('accounts.archive') && !node.account.is_archived) || (node.account.account_role === 'group' && ledgerView2.can('accounts.create') && !node.account.is_archived))) || (['posting', 'control'].includes(node.account.account_role)))" :aria-label="ledgerView2.t('accountTree.actionsFor', { name: node.label })">
                    <template #summary>{{ ledgerView2.t('accountTree.more') }}</template>
                    <BsInline gap="sm" :wrap="true">
                      <BsButton v-if="ledgerView2.can('accounts.update') && ledgerView2.writesAllowed" type="button" size="sm" @click="ledgerView2.emit('edit', node.account)">{{ ledgerView2.t('accounts.edit') }}</BsButton>
                      <BsButton
                        v-if="node.account.account_role === 'group' && !node.account.is_archived && ledgerView2.can('accounts.create') && ledgerView2.writesAllowed"
                        type="button"
                        size="sm"
                        @click="ledgerView2.emit('createChild', node.account)"
                      >{{ ledgerView2.t('accountTree.addChild') }}</BsButton>
                      <BsButton v-if="['posting', 'control'].includes(node.account.account_role)" type="button" size="sm" @click="ledgerView2.emit('classify', node.account)">{{ ledgerView2.t('statementClassification.title') }}</BsButton>
                      <BsButton
                        v-if="ledgerView2.can('accounts.archive') && !node.account.is_archived && ledgerView2.writesAllowed"
                        type="button"
                        size="sm"
                        @click="ledgerView2.emit('archive', node.account)"
                      >{{ ledgerView2.t('accounts.archive') }}</BsButton>
                    </BsInline>
                  </BsDisclosure>
                </BsBox>
              </BsHierarchyBranch>
            </template>
            <template #cell-column2="{ row: node }">
              <template v-if="node.account && node.account.account_role !== 'group' && !node.children.length">
                <BsMoneyText
                  :amount="accountBalanceDisplay(node.account.net_debit_minor).amount"
                  :currency="ledgerView2.ledgerPresentation.currency()"
                  :locale="ledgerView2.ledgerPresentation.locale"
                />
                <BsText size="xs" tone="muted">{{ ledgerView2.t(`accounts.sides.${accountBalanceDisplay(node.account.net_debit_minor).side}`) }}</BsText>
              </template>
              <template v-else>
                <BsMoneyText :amount="node.total" :currency="ledgerView2.ledgerPresentation.currency()" :locale="ledgerView2.ledgerPresentation.locale" />
                <BsText v-if="node.children.length" size="xs" tone="muted">{{ ledgerView2.t('accountTree.subtotal') }}</BsText>
                <BsText v-if="node.account?.account_role === 'posting'" size="xs" tone="muted">{{ ledgerView2.t('accountTree.directBalance') }}: <BsMoneyText :amount="accountBalanceDisplay(node.account.net_debit_minor).amount" :currency="ledgerView2.ledgerPresentation.currency()" :locale="ledgerView2.ledgerPresentation.locale" /> {{ ledgerView2.t(`accounts.sides.${accountBalanceDisplay(node.account.net_debit_minor).side}`) }}</BsText>
              </template>
            </template>
            <template #empty>
              <BsText tone="muted">{{ ledgerView2.t('accounts.noResults') }}</BsText>
            </template>
          </BsDataTable>
        </BsCard>
      </template>
    </BsWorkflowScope>
    <BsCard
      v-else
      :id="`account-panel-${activeGroup.type}`"
      role="tabpanel"
      :aria-labelledby="`account-tab-${activeGroup.type}`"
      as="section"
      padding="none"
      overflow="hidden"
    >
      <BsInline gap="none" :wrap="false" justify="between">
        <BsHeading :level="2" size="body">{{ activeGroup.label }}</BsHeading>
        <BsMoneyText :amount="activeGroup.total" :currency="ledgerPresentation.currency()" :locale="ledgerPresentation.locale" />
      </BsInline>
      <BsText size="xs" tone="muted">{{ t('accounts.totalHint', { currency: baseCurrency }) }}</BsText>
      <BsDataTable
        id="accounts-table"
        v-model:first="firstRow"
        v-model:sort-field="sortField"
        v-model:sort-order="sortOrder"
        paginator
        :rows="25"
        :always-show-paginator="false"
        :value="filteredRows"
        row-key="account_id"
        :capabilities="{ insert: can('accounts.create'), edit: can('accounts.update'), archive: can('accounts.archive') }"
        :action-labels="{ insert: t('accounts.add'), edit: t('accounts.edit'), archive: t('accounts.archive'), actions: t('accounts.actions') }"
        :can-row-action="(action, account) => action !== 'archive' || !account.is_archived"
        :table-props="{ 'aria-label': t('accounts.caption', { group: activeGroup.label }) }"
        :columns="[{ key: 'code', field: 'code', header: t('accounts.code'), sortable: true }, { key: 'name', field: 'name', header: t('accounts.account'), sortable: true }, { key: 'account_role', field: 'account_role', header: t('accounts.role') }, { key: 'control_subledger_type', field: 'control_subledger_type', header: t('controls.subledgerType') }, { key: 'subtype', field: 'subtype', header: t('accounts.subtype') }, { key: 'normal_balance', field: 'normal_balance', header: t('accounts.normalBalance') }, { key: 'contra_account_id', field: 'contra_account_id', header: t('accounts.contraAccount') }, { key: 'currency', field: 'currency', header: t('accounts.currency') }, { key: 'entry_count', field: 'entry_count', header: t('accounts.entries'), align: 'end' as const }, { key: 'net_debit_minor', field: 'net_debit_minor', header: t('accounts.balance'), align: 'end' as const }]"
        @create="openCreate()"
        @edit="openEdit"
        @archive="archiveAccount"
      >
        <template #cell-code="{ row: account }">
          <BsText dir="ltr" as="span" size="xs" tone="muted">{{ account.code || t('common.dash') }}</BsText>
        </template>
        <template #cell-name="{ row: account }">
          <BsButton
            v-if="account.account_role !== 'group' && canReadActivity"
            variant="link"
            type="button"
            :disabled="!hydrated"
            align="start"
            @click="activityAccountId = account.account_id"
          >{{ account.name }}</BsButton>
          <BsText v-else as="span">{{ account.name }}</BsText>
          <BsStatusBadge v-if="account.is_archived" status="archived" :label="t('accounts.archived')" tone="neutral" />
          <BsStatusBadge v-else-if="account.is_liquid" status="liquid" :label="t('accounts.liquid')" tone="info" />
        </template>
        <template #cell-account_role="{ row: account }">{{ t(`accounts.roles.${account.account_role}`) }}</template>
        <template #cell-control_subledger_type="{ row: account }">
          <BsText v-if="account.control_subledger_type" as="span">{{ t(`controls.subledgers.${account.control_subledger_type}`) }}</BsText>
          <BsText v-else as="span">{{ t('common.dash') }}</BsText>
          <BsStatusBadge v-if="account.control_binding_locked" status="locked" :label="t('controls.bindingLocked')" tone="neutral" />
        </template>
        <template #cell-subtype="{ row: account }">{{ t(`accounts.subtypes.${account.subtype}`) }}</template>
        <template #cell-normal_balance="{ row: account }">{{ t(`accounts.sides.${account.normal_balance}`) }}</template>
        <template #cell-contra_account_id="{ row: account }">{{ account.contra_account_id ? accountName(account.contra_account_id) : t('common.dash') }}</template>
        <template #cell-currency="{ row: account }">
          <BsText dir="ltr" as="span" tone="muted">{{ account.currency }}</BsText>
        </template>
        <template #cell-net_debit_minor="{ row: account }">
          <BsText v-if="account.account_role === 'group'" as="span" tone="muted">{{ t('accounts.groupBalance') }}</BsText>
          <template v-else>
            <BsMoneyText
              :amount="accountBalanceDisplay(account.net_debit_minor).amount"
              :currency="ledgerPresentation.currency()"
              :locale="ledgerPresentation.locale"
            />
            <BsText as="span">{{ t(`accounts.sides.${accountBalanceDisplay(account.net_debit_minor).side}`) }}</BsText>
          </template>
        </template>
        <template #row-actions="{ row: account }">
          <BsButton v-if="['posting', 'control'].includes(account.account_role)" type="button" size="sm" @click="statementAccount = account">{{ t('statementClassification.title') }}</BsButton>
        </template>
        <template #paginatorcontainer="{ page, pageCount, prevPageCallback, nextPageCallback }">
          <BsInline :aria-label="t('accounts.pages')" as="nav" gap="md" :wrap="true" justify="center" padding="md">
            <BsButton type="button" :disabled="page === 0" size="sm" @click="prevPageCallback">{{ t('accounts.previousPage') }}</BsButton>
            <BsText as="span" size="sm" tone="muted">{{ t('accounts.pageCount', { page: page + 1, total: pageCount }) }}</BsText>
            <BsButton type="button" :disabled="page + 1 >= (pageCount ?? 1)" size="sm" @click="nextPageCallback">{{ t('accounts.nextPage') }}</BsButton>
          </BsInline>
        </template>
        <template #empty>
          <BsEmptyState
            :title="search || hasArchivedInGroup ? t('accounts.noResults') : t('accounts.emptyGroupTitle', { group: activeGroup.label })"
            :description="search || hasArchivedInGroup ? t('accounts.noResultsHint') : t('accounts.emptyGroupHint')"
            :action-label="search ? t('accounts.clearSearch') : hasArchivedInGroup ? t('accounts.showArchived') : can('accounts.create') ? t('accounts.add') : undefined"
            @action="search ? clearSearch() : hasArchivedInGroup ? showArchived = true : openCreate()"
          />
        </template>
      </BsDataTable>
    </BsCard>
    <BsWorkflowScope
      v-if="can('controls.reconcile') && scopedBalances.some((account: ChartAccount) => account.account_role === 'control')"
      :factory="useLedgerControlReconciliationPanelView"
      :input="{ accounts: (scopedBalances) }"
      @changed="async () => { await refreshBalances(); await refreshNuxtData(['org:accounts']) }"
    >
      <template #default="{ state: ledgerView3 }">
        <BsCard aria-labelledby="control-reconciliation-heading" as="section" padding="none" overflow="hidden">
          <BsInline gap="md" :wrap="true" align="end" justify="between" padding="lg">
            <BsBox>
              <BsHeading id="control-reconciliation-heading" :level="2" size="h3">{{ ledgerView3.t('controls.reconciliation') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ ledgerView3.t('controls.reconciliationHint') }}</BsText>
            </BsBox>
            <BsFloatingField :label="ledgerView3.t('controls.asOfDate')">
              <BsInput id="control-as-of-date" v-model="ledgerView3.asOfDate" type="date" />
            </BsFloatingField>
          </BsInline>
          <BsText v-if="ledgerView3.loading" role="status" size="sm" tone="muted">{{ ledgerView3.t('accounts.loading') }}</BsText>
          <BsText v-else-if="ledgerView3.loadError" role="alert" tone="danger">{{ ledgerView3.loadError }}</BsText>
          <BsDataTable
            v-else
            :value="ledgerView3.rows"
            row-key="control_account_id"
            :label="ledgerView3.t('controls.reconciliation')"
            :columns="[{ key: 'column1', header: ledgerView3.t('accounts.account') }, { key: 'column2', header: ledgerView3.t('controls.subledgerType') }, { key: 'column3', header: ledgerView3.t('controls.glBalance'), align: 'end' as const }, { key: 'column4', header: ledgerView3.t('controls.subledgerBalance'), align: 'end' as const }, { key: 'column5', header: ledgerView3.t('controls.variance'), align: 'end' as const }, { key: 'column6', header: ledgerView3.t('controls.status') }, ...((ledgerView3.can('controls.adjust')) ? [{ key: 'column7', header: ledgerView3.t('accounts.actions') }] : [])]"
          >
            <template #cell-column1="{ row: data }">
              <BsText as="span">{{ data.account_name }}</BsText>
              <BsText v-if="data.account_code" as="span" size="xs" tone="muted">{{ data.account_code }}</BsText>
            </template>
            <template #cell-column2="{ row: data }">{{ ledgerView3.t(`controls.subledgers.${data.subledger_type}`) }}</template>
            <template #cell-column3="{ row: data }">
              <BsMoneyText :amount="data.gl_balance_minor" :currency="ledgerView3.ledgerPresentation.currency()" :locale="ledgerView3.ledgerPresentation.locale" />
            </template>
            <template #cell-column4="{ row: data }">
              <BsMoneyText
                v-if="data.subledger_balance_minor !== null"
                :amount="data.subledger_balance_minor"
                :currency="ledgerView3.ledgerPresentation.currency()"
                :locale="ledgerView3.ledgerPresentation.locale"
              />
              <BsText v-else as="span">{{ ledgerView3.t('controls.subledgerUnavailable') }}</BsText>
            </template>
            <template #cell-column5="{ row: data }">
              <BsMoneyText
                v-if="data.variance_minor !== null"
                :amount="data.variance_minor"
                :currency="ledgerView3.ledgerPresentation.currency()"
                :locale="ledgerView3.ledgerPresentation.locale"
              />
              <BsText v-else as="span">{{ ledgerView3.t('common.dash') }}</BsText>
            </template>
            <template #cell-column6="{ row: data }">
              <BsStatusBadge
                :status="data.status"
                :label="ledgerView3.t(`controls.statuses.${data.status}`)"
                :tone="data.status === 'reconciled' ? 'success' : data.status === 'unreconciled' ? 'danger' : 'warning'"
              />
              <BsText v-if="data.explanation_reason" size="xs" tone="muted">{{ data.explanation_reason }} · {{ data.explanation_reference }}</BsText>
            </template>
            <template #cell-column7="{ row: data }">
              <BsLink v-if="data.subledger_type === 'inventory' && ledgerView3.can('inventory.read')" to="/inventory-accounting">{{ ledgerView3.t('inventory.sourceLink') }}</BsLink>
              <BsButton v-else-if="data.subledger_type !== 'inventory'" type="button" size="sm" @click="ledgerView3.openAdjustment(data.control_account_id)">{{ ledgerView3.t('controls.adjust') }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsRecordActionDialog
          v-if="ledgerView3.dialogOpen"
          :visible="true"
          :title="ledgerView3.t('controls.adjust')"
          size="md"
          :dirty="ledgerView3.dirty"
          :pending="ledgerView3.submitting"
          :error="ledgerView3.formError"
          :submit-label="ledgerView3.t('common.save')"
          :cancel-label="ledgerView3.t('common.cancel')"
          @update:visible="(value: boolean) => { if (!value) ledgerView3.dialogOpen = false }"
          @submit="ledgerView3.submitAdjustment"
        >
          <BsText size="sm" tone="muted">{{ ledgerView3.selected?.name }} · {{ ledgerView3.selected?.control_subledger_type ? ledgerView3.t(`controls.subledgers.${ledgerView3.selected.control_subledger_type}`) : '' }}</BsText>
          <BsFloatingField :label="ledgerView3.t('controls.asOfDate')">
            <BsInput v-model="ledgerView3.form.date" type="date" required />
          </BsFloatingField>
          <BsFloatingField :label="ledgerView3.t('controls.counterpartAccount')">
            <BsSelect v-model="ledgerView3.form.counterpartAccountId" required native>
              <BsSelectOption value="">{{ ledgerView3.t('controls.choosePostingAccount') }}</BsSelectOption>
              <BsSelectOption v-for="account in ledgerView3.postingAccounts" :key="account.account_id" :value="account.account_id">{{ account.name }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="ledgerView3.t('controls.controlSide')">
            <BsSelect v-model="ledgerView3.form.controlSide" native>
              <BsSelectOption value="debit">{{ ledgerView3.t('accounts.sides.debit') }}</BsSelectOption>
              <BsSelectOption value="credit">{{ ledgerView3.t('accounts.sides.credit') }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="ledgerView3.t('transactions.amount')">
            <BsInput v-model="ledgerView3.form.amount" inputmode="decimal" required />
          </BsFloatingField>
          <BsFloatingField :label="ledgerView3.t('transactions.description')">
            <BsInput v-model="ledgerView3.form.description" required />
          </BsFloatingField>
          <BsFloatingField :label="ledgerView3.t('controls.adjustmentReason')">
            <BsInput v-model="ledgerView3.form.reason" required />
          </BsFloatingField>
          <BsFloatingField :label="ledgerView3.t('controls.reconciliationReference')">
            <BsInput v-model="ledgerView3.form.reference" required />
          </BsFloatingField>
          <BsText size="sm" tone="muted">{{ ledgerView3.t('controls.adjustmentWarning') }}</BsText>
        </BsRecordActionDialog>
      </template>
    </BsWorkflowScope>
    <BsWorkflowScope
      v-if="activityAccountId"
      :key="`${balanceKey}:${activityAccountId}`"
      :factory="useLedgerAccountActivityDialogView"
      :input="{ accountId: (activityAccountId), scope: (balanceKey) }"
      @close="activityAccountId = null"
    >
      <template #default="{ state: ledgerView4 }">
        <BsDialog :visible="true" :title="ledgerView4.title" size="lg" @update:visible="(value: boolean) => { if (!value) ledgerView4.emit('close') }">
          <BsStack :ref="el => { ledgerView4.content = resolveTemplateElement(el) }" gap="md">
            <BsButton v-if="ledgerView4.views.length > 1" type="button" size="sm" @click="ledgerView4.back"><BsText as="span"><BsIcon name="arrowRight" directional :size="16" /></BsText>{{ ledgerView4.t('accountActivity.back') }}</BsButton>
            <BsHeading :ref="el => { ledgerView4.heading = resolveTemplateElement(el) }" tabindex="-1" :level="2" size="h3">{{ ledgerView4.activity?.account.name || ledgerView4.journal?.description || ledgerView4.title }}</BsHeading>
            <template v-if="ledgerView4.current.kind === 'account'">
              <BsInline v-if="ledgerView4.activity" gap="sm" :wrap="true">
                <BsBadge v-if="ledgerView4.activity.account.code">{{ ledgerView4.activity.account.code }}</BsBadge>
                <BsText as="span">{{ ledgerView4.t(`accounts.groups.${ledgerView4.activity.account.type}`) }}</BsText>
                <BsBadge v-if="ledgerView4.activity.account.is_archived">{{ ledgerView4.t('accounts.archived') }}</BsBadge>
                <BsText as="span">{{ ledgerView4.t('accountActivity.baseCurrency', { currency: ledgerView4.activity.currency }) }}</BsText>
              </BsInline>
              <BsForm layout="grid" :columns="2" @submit.prevent="ledgerView4.applyPeriod">
                <BsFloatingField :label="ledgerView4.t('reports.from')">
                  <BsInput id="activity-from" v-model="ledgerView4.current.from" type="date" required :disabled="ledgerView4.loading" />
                </BsFloatingField>
                <BsFloatingField :label="ledgerView4.t('reports.to')">
                  <BsInput id="activity-to" v-model="ledgerView4.current.to" type="date" required :min="ledgerView4.current.from" :disabled="ledgerView4.loading" />
                </BsFloatingField>
                <BsButton type="submit" :disabled="ledgerView4.loading || ledgerView4.periodInvalid" variant="primary">{{ ledgerView4.t('accountActivity.apply') }}</BsButton>
              </BsForm>
            </template>
            <BsText v-if="ledgerView4.error" role="alert" tone="danger">{{ ledgerView4.error }} <BsButton type="button" size="sm" @click="ledgerView4.load(true)">{{ ledgerView4.t('accounts.retry') }}</BsButton></BsText>
            <BsSectionSkeleton v-if="ledgerView4.loading" variant="table" :rows="5" />
            <template v-else-if="!ledgerView4.error && ledgerView4.activity">
              <BsText size="sm" tone="muted">{{ ledgerView4.t('accountActivity.period', { from: formatDate(ledgerView4.activity.from_date, ledgerView4.locale), to: formatDate(ledgerView4.activity.to_date, ledgerView4.locale) }) }}</BsText>
              <BsGrid :columns="4" gap="md">
                <BsCard v-for="card in ledgerView4.cards" :key="card.key" :data-testid="`activity-${card.key}`" as="div" variant="flat" padding="sm">
                  <BsText size="xs" tone="muted">{{ ledgerView4.t(`accountActivity.${card.key}`) }}</BsText>
                  <BsText emphasis="bold">
                    <BsMoneyText
                      :amount="card.signed ? accountBalanceDisplay(card.amount).amount : card.amount"
                      :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.activity.currency)"
                      :locale="ledgerView4.ledgerPresentation.locale"
                    />
                  </BsText>
                  <BsText v-if="card.signed" size="xs" tone="muted">{{ ledgerView4.t(`accounts.sides.${accountBalanceDisplay(card.amount).side}`) }}</BsText>
                </BsCard>
              </BsGrid>
              <BsText v-if="!ledgerView4.activity.total" size="sm">{{ ledgerView4.t('accountActivity.empty') }}</BsText>
              <BsBox v-else>
                <BsDataTable
                  :label="ledgerView4.t('accountActivity.title')"
                  :value="ledgerView4.activity.rows"
                  row-key="entry_id"
                  :columns="[{ key: 'column1', header: ledgerView4.t('transactions.date') }, { key: 'column2', header: ledgerView4.t('transactions.description') }, { key: 'column3', header: ledgerView4.t('detail.debit'), align: 'end' as const }, { key: 'column4', header: ledgerView4.t('detail.credit'), align: 'end' as const }, { key: 'column5', header: ledgerView4.t('accountActivity.running'), align: 'end' as const }]"
                >
                  <template #cell-column1="{ row }">
                    <BsText as="span" wrap="nowrap">{{ formatDate(row.entry_date, ledgerView4.locale) }}</BsText>
                  </template>
                  <template #cell-column2="{ row }">
                    <BsButton
                      variant="link"
                      type="button"
                      :data-nav-id="`entry-${row.entry_id}`"
                      align="start"
                      @click="ledgerView4.openJournal(row.transaction_id, row.entry_id)"
                    >{{ row.description || ledgerView4.t('accountActivity.journal') }}</BsButton>
                    <BsText v-if="row.reference || row.memo" size="xs" tone="muted">{{ row.reference || row.memo }}</BsText>
                  </template>
                  <template #cell-column3="{ row }">
                    <BsMoneyText
                      :amount="row.debit_minor"
                      :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.activity.currency)"
                      :locale="ledgerView4.ledgerPresentation.locale"
                    />
                  </template>
                  <template #cell-column4="{ row }">
                    <BsMoneyText
                      :amount="row.credit_minor"
                      :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.activity.currency)"
                      :locale="ledgerView4.ledgerPresentation.locale"
                    />
                  </template>
                  <template #cell-column5="{ row }">
                    <BsMoneyText
                      :amount="accountBalanceDisplay(row.balance_minor).amount"
                      :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.activity.currency)"
                      :locale="ledgerView4.ledgerPresentation.locale"
                    />
                    <BsText as="span" size="xs" tone="muted">{{ ledgerView4.t(`accounts.sides.${accountBalanceDisplay(row.balance_minor).side}`) }}</BsText>
                  </template>
                </BsDataTable>
                <BsInline
                  v-if="ledgerView4.current.kind === 'account'"
                  :aria-label="ledgerView4.t('accountActivity.pages')"
                  as="nav"
                  gap="md"
                  :wrap="true"
                  justify="between"
                >
                  <BsButton
                    type="button"
                    :disabled="ledgerView4.current.offset === 0"
                    size="sm"
                    @click="ledgerView4.page(Math.max(0, ledgerView4.current.offset - ledgerView4.pageSize))"
                  >{{ ledgerView4.t('accounts.previousPage') }}</BsButton>
                  <BsText as="span">{{ ledgerView4.t('accountActivity.showing', { from: ledgerView4.current.offset + 1, to: Math.min(ledgerView4.current.offset + ledgerView4.pageSize, ledgerView4.activity.total), total: ledgerView4.activity.total }) }}</BsText>
                  <BsButton
                    type="button"
                    :disabled="ledgerView4.current.offset + ledgerView4.pageSize >= ledgerView4.activity.total"
                    size="sm"
                    @click="ledgerView4.page(ledgerView4.current.offset + ledgerView4.pageSize)"
                  >{{ ledgerView4.t('accounts.nextPage') }}</BsButton>
                </BsInline>
              </BsBox>
            </template>
            <template v-else-if="!ledgerView4.error && ledgerView4.journal">
              <BsInline gap="md" :wrap="true">
                <BsText as="span">{{ formatDate(ledgerView4.journal.date, ledgerView4.locale) }}</BsText>
                <BsText v-if="ledgerView4.journal.reference" as="span">{{ ledgerView4.journal.reference }}</BsText>
                <BsText as="span">{{ ledgerView4.t(`types.${ledgerView4.journal.type}`) }}</BsText>
                <BsBadge>{{ ledgerView4.t(`status.${ledgerView4.journal.status}`) }}</BsBadge>
              </BsInline>
              <BsText v-if="ledgerView4.journal.reverses_transaction_id || ledgerView4.journal.reversed_by_transaction_id" size="sm">{{ ledgerView4.t('accountActivity.reversal') }}</BsText>
              <BsText size="sm" tone="muted">{{ ledgerView4.t('accountActivity.journalHint', { currency: ledgerView4.journal.currency }) }}</BsText>
              <BsBox>
                <BsDataTable
                  :label="ledgerView4.t('accountActivity.journal')"
                  :value="ledgerView4.journal.rows"
                  row-key="entry_id"
                  :columns="[{ key: 'column1', header: ledgerView4.t('detail.account') }, { key: 'column2', header: ledgerView4.t('detail.debit'), align: 'end' as const }, { key: 'column3', header: ledgerView4.t('detail.credit'), align: 'end' as const }]"
                >
                  <template #cell-column1="{ row }">
                    <BsButton
                      variant="link"
                      type="button"
                      :data-nav-id="`account-${row.entry_id}`"
                      align="start"
                      @click="ledgerView4.openAccount(row.account_id, row.entry_id)"
                    >{{ row.account_name }}</BsButton>
                    <BsText size="xs" tone="muted">{{ row.account_code }}<BsText v-if="row.memo" as="span"> · {{ row.memo }}</BsText></BsText>
                    <BsText v-if="row.original_currency !== ledgerView4.journal.currency" size="xs" tone="muted">
                      <BsMoneyText
                        :amount="row.original_amount_minor"
                        :currency="ledgerView4.ledgerPresentation.currency(row.original_currency)"
                        :locale="ledgerView4.ledgerPresentation.locale"
                      />
                    </BsText>
                  </template>
                  <template #cell-column2="{ row }">
                    <BsMoneyText
                      :amount="row.debit_minor"
                      :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.journal.currency)"
                      :locale="ledgerView4.ledgerPresentation.locale"
                    />
                  </template>
                  <template #cell-column3="{ row }">
                    <BsMoneyText
                      :amount="row.credit_minor"
                      :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.journal.currency)"
                      :locale="ledgerView4.ledgerPresentation.locale"
                    />
                  </template>
                </BsDataTable>
              </BsBox>
              <BsInline gap="md" :wrap="true" justify="between" padding="lg" surface="muted" radius="control">
                <BsText as="span">{{ ledgerView4.t('accountActivity.balanced') }}</BsText>
                <BsText as="span">{{ ledgerView4.t('detail.debit') }}: <BsMoneyText :amount="ledgerView4.journal.debit_minor" :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.journal.currency)" :locale="ledgerView4.ledgerPresentation.locale" /></BsText>
                <BsText as="span">{{ ledgerView4.t('detail.credit') }}: <BsMoneyText :amount="ledgerView4.journal.credit_minor" :currency="ledgerView4.ledgerPresentation.currency(ledgerView4.journal.currency)" :locale="ledgerView4.ledgerPresentation.locale" /></BsText>
              </BsInline>
            </template>
          </BsStack>
        </BsDialog>
      </template>
    </BsWorkflowScope>
    <BsWorkflowScope
      v-if="statementAccount"
      :key="`${balanceKey}:${statementAccount.account_id}`"
      :factory="useLedgerAccountStatementClassificationDialogView"
      :input="{ account: (statementAccount), scope: (balanceKey) }"
      @close="statementAccount = null"
    >
      <template #default="{ state: ledgerView5 }">
        <BsRecordActionDialog
          :visible="true"
          :title="ledgerView5.t('statementClassification.title')"
          size="lg"
          :dirty="ledgerView5.dirty"
          :pending="ledgerView5.pending"
          :error="ledgerView5.error"
          :submit-label="ledgerView5.t('statementClassification.schedule')"
          :cancel-label="ledgerView5.t('common.cancel')"
          :submit-disabled="!ledgerView5.context || !ledgerView5.canSchedule || ledgerView5.loading || !ledgerView5.form.reason.trim()"
          @update:visible="(value: boolean) => { if (!value) ledgerView5.emit('close') }"
          @submit="ledgerView5.save"
        >
          <BsText emphasis="semibold">{{ ledgerView5.account.name }}</BsText>
          <BsFloatingField :label="ledgerView5.t('financialMapping.dimension')">
            <BsSelect v-model="ledgerView5.dimension" :disabled="ledgerView5.pending" native>
              <BsSelectOption v-for="item in ledgerView5.dimensions" :key="item" :value="item">{{ ledgerView5.t(`financialMapping.dimensions.${item}`) }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsText size="sm" tone="muted">{{ ledgerView5.t('financialMapping.hint') }}</BsText>
          <BsSectionSkeleton v-if="ledgerView5.loading" variant="table" :rows="3" />
          <template v-else>
            <BsButton v-if="ledgerView5.error" type="button" :disabled="ledgerView5.pending" @click="ledgerView5.load">{{ ledgerView5.t('statementClassification.reload') }}</BsButton>
            <template v-if="ledgerView5.context">
              <BsText v-if="!ledgerView5.canSchedule" size="sm" tone="muted">{{ ledgerView5.t('statementClassification.readOnly') }}</BsText>
              <BsStack v-else gap="md">
                <BsFloatingField :label="ledgerView5.t('statementClassification.line')">
                  <BsSelect id="statement-line" v-model="ledgerView5.form.statementLine" required :disabled="ledgerView5.pending" native>
                    <BsSelectOption value="" disabled>{{ ledgerView5.t('statementClassification.choose') }}</BsSelectOption>
                    <BsSelectOption v-for="line in ledgerView5.options" :key="line" :value="line">{{ ledgerView5.dimension === 'balance_sheet' ? ledgerView5.t(`statementClassification.lines.${line}`) : ledgerView5.t(`financialMapping.lines.${line}`) }}</BsSelectOption>
                  </BsSelect>
                </BsFloatingField>
                <BsFloatingField :label="ledgerView5.t('statementClassification.effectiveFrom')">
                  <BsInput
                    id="statement-effective"
                    v-model="ledgerView5.form.effectiveFrom"
                    type="date"
                    required
                    :min="ledgerView5.minDate"
                    :disabled="ledgerView5.pending"
                  />
                </BsFloatingField>
                <BsText size="sm" tone="muted">{{ ledgerView5.t('statementClassification.minimum', { date: formatDate(ledgerView5.minDate, ledgerView5.locale) }) }}</BsText>
                <BsFloatingField :label="ledgerView5.t('statementClassification.reason')">
                  <BsTextarea id="statement-reason" v-model="ledgerView5.form.reason" :rows="3" required maxlength="1000" :disabled="ledgerView5.pending" />
                </BsFloatingField>
              </BsStack>
              <BsHeading :level="3" size="body">{{ ledgerView5.t('statementClassification.history') }}</BsHeading>
              <BsText v-if="!ledgerView5.history.length" size="sm" tone="muted">{{ ledgerView5.t('statementClassification.noHistory') }}</BsText>
              <BsDataTable
                v-else
                :label="ledgerView5.t('statementClassification.history')"
                :value="ledgerView5.history"
                row-key="id"
                :paginator="ledgerView5.history.length > 10"
                :rows="10"
                :columns="[{ key: 'effective_from', field: 'effective_from', header: ledgerView5.t('statementClassification.effectiveFrom') }, { key: 'statement_line', field: 'statement_line', header: ledgerView5.t('statementClassification.line') }, { key: 'reason', field: 'reason', header: ledgerView5.t('statementClassification.reason') }]"
              >
                <template #cell-effective_from="{ row }">{{ formatDate(row.effective_from, ledgerView5.locale) }}</template>
                <template #cell-statement_line="{ row }">{{ ledgerView5.dimension === 'balance_sheet' ? ledgerView5.t(`statementClassification.lines.${row.statement_line}`) : ledgerView5.t(`financialMapping.lines.${row.statement_line}`) }}</template>
              </BsDataTable>
            </template>
          </template>
        </BsRecordActionDialog>
      </template>
    </BsWorkflowScope>
    <BsRecordActionDialog
      v-if="editorOpen"
      v-model:visible="editorOpen"
      :title="editing ? t('accounts.edit') : t('accounts.add')"
      size="md"
      :dirty="overlayDirty0"
      :pending="submitting"
      :error="editorError"
      :submit-label="t('common.save')"
      :cancel-label="t('common.cancel')"
      @submit="saveAccount"
    >
      <BsUsageMeter v-if="(!editing) && ledgerUsage.item('max_accounts')" compact :item="ledgerUsage.item('max_accounts')!" />
      <BsFloatingField :label="t('accounts.name')">
        <BsInput id="account-name" v-model="form.name" required />
      </BsFloatingField>
      <BsFloatingField :label="t('accounts.code')">
        <BsInput id="account-code" v-model="form.code" dir="ltr" />
      </BsFloatingField>
      <BsFloatingField :label="t('accounts.role')">
        <BsSelect id="account-role" v-model="form.accountRole" :disabled="!!editing" aria-describedby="account-role-help" native>
          <BsSelectOption value="posting">{{ t('accounts.roles.posting') }}</BsSelectOption>
          <BsSelectOption v-if="can('controls.configure')" value="control">{{ t('accounts.roles.control') }}</BsSelectOption>
          <BsSelectOption value="group">{{ t('accounts.roles.group') }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsText id="account-role-help" size="sm" tone="muted">{{ t('accounts.roleHint') }}</BsText>
      <BsFloatingField v-if="form.accountRole === 'control' && !editing" :label="t('controls.subledgerType')">
        <BsSelect id="control-subledger-type" v-model="form.controlSubledgerType" required native>
          <BsSelectOption value="customer">{{ t('controls.subledgers.customer') }}</BsSelectOption>
          <BsSelectOption value="supplier">{{ t('controls.subledgers.supplier') }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsText v-if="form.accountRole === 'control'" size="sm" tone="muted">{{ t('controls.directPostingBlocked') }}</BsText>
      <BsText v-if="editing?.control_binding_locked" size="sm" tone="muted">{{ t('controls.bindingLockedHint') }}</BsText>
      <template v-if="!editing">
        <BsFloatingField :label="t('accounts.type')">
          <BsSelect id="account-type" v-model="form.type" :disabled="form.accountRole === 'control'" native>
            <BsSelectOption v-for="type in GROUP_TYPES" :key="type" :value="type">{{ t(`accounts.groups.${type}`) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="t('accounts.subtype')">
          <BsSelect id="account-subtype" v-model="form.subtype" :disabled="form.accountRole === 'control'" native>
            <BsSelectOption v-for="subtype in subtypeOptions[form.type]" :key="subtype" :value="subtype">{{ t(`accounts.subtypes.${subtype}`) }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField v-if="canMultiCurrency" :label="t('accounts.currency')">
          <BsSelect id="account-currency" v-model="form.currency" native>
            <BsSelectOption v-for="currency in currencies" :key="currency.code" :value="currency.code">{{ currency.code }} — {{ currency.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsText v-else size="sm" tone="muted">{{ t('accounts.multiCurrencyUpgrade') }}</BsText>
      </template>
      <BsFloatingField v-if="!editing" :label="t('accounts.parentGroup')">
        <BsSelect id="account-parent" v-model="form.parentAccountId" native>
          <BsSelectOption value="">{{ t('accounts.noParent') }}</BsSelectOption>
          <BsSelectOption v-for="account in parentOptions" :key="account.account_id" :value="account.account_id">{{ account.name }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsText v-else-if="form.parentAccountId" size="sm" tone="muted">{{ t('accounts.parentAccount') }}: {{ accountName(form.parentAccountId) }}</BsText>
      <template v-if="form.accountRole !== 'group'">
        <BsFloatingField :label="t('accounts.normalBalance')">
          <BsSelect
            id="account-normal-balance"
            v-model="form.normalBalance"
            :disabled="natureLocked || form.accountRole === 'control'"
            aria-describedby="account-nature-help"
            native
          >
            <BsSelectOption value="debit">{{ t('accounts.sides.debit') }}</BsSelectOption>
            <BsSelectOption value="credit">{{ t('accounts.sides.credit') }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsText id="account-nature-help" size="sm" tone="muted">{{ t('accounts.natureHint') }}</BsText>
        <BsFloatingField v-if="form.accountRole === 'posting'" :label="t('accounts.contraAccount')">
          <BsSelect id="account-contra" v-model="form.contraAccountId" :disabled="natureLocked" aria-describedby="account-contra-help" native>
            <BsSelectOption value="">{{ t('accounts.noContra') }}</BsSelectOption>
            <BsSelectOption v-if="natureLocked && form.contraAccountId" :value="form.contraAccountId">{{ accountName(form.contraAccountId) }}</BsSelectOption>
            <BsSelectOption v-for="account in natureLocked ? [] : contraOptions" :key="account.account_id" :value="account.account_id">{{ account.name }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsText v-if="form.accountRole === 'posting'" id="account-contra-help" size="sm" tone="muted">{{ t('accounts.contraHint') }}</BsText>
        <BsText v-if="natureLocked" size="sm" tone="muted">{{ t('accounts.natureLocked') }}</BsText>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>

undefined
