<script setup lang="ts">
import { scopedQueryKey } from '@building-suit/data-access'
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: 'default' })
/**
 * Called "Accounts" for the user; internally this is the chart of accounts.
 * Balances come from public.account_balances, which derives them from posted
 * ledger entries — there is no stored balance to display.
 */

const supabase = useSupabaseClient<Database>()
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

interface BalanceRow {
  organization_id: string
  account_id: string
  code: string | null
  name: string
  type: Database['public']['Enums']['account_type']
  subtype: string
  currency: string
  account_role: 'posting' | 'group'
  normal_balance: Database['public']['Enums']['normal_balance']
  contra_account_id: string | null
  is_system: boolean
  classification_locked: boolean
  net_debit_minor: string
  statement_balance_minor: string
  entry_count: number
  is_archived: boolean
  is_liquid: boolean
  parent_account_id: string | null
}

const balanceKey = computed(() => `org:${scopedQueryKey({
  environment: String(config.public.supabase.url),
  portal: 'ledger-suit', userId: user.value?.id ?? '', tenantId: currentId.value ?? '',
}, 'account-balances')}`)

const { data: balances, pending: balancesPending, error: balancesError, refresh: refreshBalances } = useLazyAsyncData<BalanceRow[]>(balanceKey, async (_app, { signal }) => {
  const organizationId = currentId.value
  const requestKey = balanceKey.value
  if (!organizationId) return []

  const rows = await fetchAccountPages<BalanceRow>((from, to) => supabase
    .from('account_balances')
    .select('organization_id, account_id, code, name, type, subtype, currency, account_role, normal_balance, contra_account_id, is_system, classification_locked, net_debit_minor, statement_balance_minor, entry_count, is_archived, is_liquid, parent_account_id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('code', { ascending: true, nullsFirst: false })
    .order('account_id')
    .range(from, to)
    .abortSignal(signal)
    .overrideTypes<BalanceRow[], { merge: false }>(), signal)

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
  return activeGroup.value.rows.filter(account =>
    !query || account.name.toLocaleLowerCase().includes(query) || account.code?.toLocaleLowerCase().includes(query),
  )
})
const hasArchivedInGroup = computed(() => scopedBalances.value.some(row => row.type === tab.value && row.is_archived))
const hiddenSavedAccount = computed(() => {
  const account = scopedBalances.value.find(row => row.account_id === lastSavedId.value)
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
  await router.replace({ query: { ...route.query, tab: account.type } })
  searchInput.value?.focus()
}

const sortColumnPt = {
  columnHeaderContent: { class: 'flex items-center gap-2' },
  sortIcon: { class: 'h-3 w-3 shrink-0', 'aria-hidden': true },
  headerCell: { class: 'cursor-pointer select-none' },
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
  Object.assign(form, { name: '', code: '', contraAccountId: '', parentAccountId: '', accountRole: 'posting' })
}, { flush: 'sync' })

const subtypeOptions: Record<BalanceRow['type'], string[]> = {
  asset: ['cash', 'bank', 'mobile_wallet', 'accounts_receivable', 'inventory', 'prepaid_expenses', 'equipment', 'vehicles', 'property', 'other_asset'],
  liability: ['accounts_payable', 'credit_card', 'loan', 'taxes_payable', 'accrued_expenses', 'other_liability'],
  equity: ['owner_capital', 'retained_earnings', 'owner_drawings', 'opening_balance_equity', 'other_equity'],
  revenue: ['product_sales', 'service_revenue', 'commission', 'other_income'],
  expense: ['cost_of_sales', 'salaries', 'rent', 'utilities', 'marketing', 'transportation', 'software', 'professional_fees', 'bank_fees', 'interest_expense', 'depreciation', 'taxes', 'other_expense'],
}

function openCreate() {
  editing.value = null
  Object.assign(form, {
    name: '',
    code: '',
    type: tab.value,
    subtype: subtypeOptions[tab.value][0]!,
    currency: baseCurrency.value,
    normalBalance: defaultAccountNature(tab.value),
    contraAccountId: '', accountRole: 'posting', parentAccountId: '',
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
    accountRole: row.account_role, parentAccountId: row.parent_account_id ?? '' })
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
  editing.value.account_role === 'group' || editing.value.classification_locked || editing.value.is_system
  || scopedBalances.value.some(account => account.contra_account_id === editing.value?.account_id)
)))
const contraOptions = computed(() => scopedBalances.value.filter(account =>
  account.account_role === 'posting' && account.account_id !== editing.value?.account_id && !account.is_archived
  && !account.contra_account_id && account.type === form.type && account.currency === form.currency
  && account.normal_balance !== form.normalBalance,
))
watch([() => form.normalBalance, () => form.currency], () => {
  if (!natureLocked.value && !contraOptions.value.some(account => account.account_id === form.contraAccountId)) {
    form.contraAccountId = ''
  }
})
const parentOptions = computed(() => scopedBalances.value.filter(account =>
  account.account_role === 'group' && !account.is_archived
  && account.type === form.type && account.currency === form.currency,
))
watch([() => form.type, () => form.currency], () => {
  if (!editing.value && !parentOptions.value.some(account => account.account_id === form.parentAccountId)) form.parentAccountId = ''
})
watch(() => form.accountRole, (role) => {
  if (role === 'group') form.contraAccountId = ''
})
function accountName(id: string) {
  return scopedBalances.value.find(account => account.account_id === id)?.name ?? t('common.dash')
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
</script>

<template>
  <div class="space-y-6" :data-hydrated="hydrated">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-h1 font-bold">{{ t('accounts.title') }}</h1>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-fg-muted">
          <input v-model="showArchived" type="checkbox" class="rounded-sm border-[var(--bs-border)]">
          {{ t('accounts.showArchived') }}
        </label>
        <button v-if="can('accounts.create')" type="button" class="ls-btn ls-btn-primary" @click="openCreate">
          {{ t('accounts.add') }}
        </button>
      </div>
    </div>

    <div class="flex gap-1 overflow-x-auto border-b border-[var(--bs-border)]" role="tablist" :aria-label="t('accounts.tabsLabel')">
      <button
        v-for="type in GROUP_TYPES"
        :id="`account-tab-${type}`"
        :key="type"
        type="button"
        role="tab"
        :aria-controls="`account-panel-${type}`"
        :aria-selected="tab === type"
        class="ls-tab -mb-px whitespace-nowrap"
        :class="{ 'ls-tab-active': tab === type }"
        @click="selectTab(type)"
      >
        {{ t(`accounts.groups.${type}`) }}
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div class="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-md">
        <label for="account-search" class="mb-2 block text-sm font-semibold">{{ t('accounts.searchLabel') }}</label>
        <input id="account-search" ref="searchInput" v-model="search" type="search" class="ls-input" :placeholder="t('accounts.searchPlaceholder')" aria-controls="accounts-table" :disabled="!hydrated || balancesPending || !!balancesError">
      </div>
      <button v-if="search" type="button" class="ls-btn" @click="clearSearch">{{ t('accounts.clearSearch') }}</button>
      <p v-if="!balancesPending && !balancesError" class="py-2 text-sm text-fg-muted" role="status" data-testid="account-result-count">
        {{ t('accounts.resultCount', { count: filteredRows.length, total: activeGroup.rows.length, group: activeGroup.label }) }}
      </p>
    </div>

    <div v-if="hiddenSavedAccount && !balancesPending && !balancesError" class="ls-card flex flex-wrap items-center justify-between gap-3 p-4" role="status">
      <p class="text-sm">{{ t('accounts.savedHidden', { name: hiddenSavedAccount.name }) }}</p>
      <button type="button" class="ls-btn" @click="revealSavedAccount">{{ t('accounts.revealSaved') }}</button>
    </div>

    <div v-if="balancesPending" role="status" :aria-label="t('accounts.loading')">
      <span class="sr-only">{{ t('accounts.loading') }}</span>
      <SectionSkeleton variant="table" :rows="8" />
    </div>

    <div v-else-if="balancesError" class="ls-card space-y-3 p-6" role="alert">
      <h2 class="font-bold">{{ t('accounts.loadError') }}</h2>
      <p class="text-sm text-fg-muted">{{ t('accounts.loadErrorHint') }}</p>
      <button type="button" class="ls-btn" @click="refreshBalances()">{{ t('accounts.retry') }}</button>
    </div>

    <EmptyState
      v-else-if="!hasAccounts"
      :title="t('accounts.emptyTitle')"
      :description="t('accounts.emptyHint')"
      :action-label="can('accounts.create') ? t('accounts.add') : undefined"
      @action="openCreate"
    />

    <section
      v-else
      :id="`account-panel-${activeGroup.type}`"
      class="ls-card overflow-hidden"
      role="tabpanel"
      :aria-labelledby="`account-tab-${activeGroup.type}`"
    >
        <div class="flex items-center justify-between border-b border-[var(--bs-border)] px-6 py-3">
          <h2 class="text-sm font-bold">{{ activeGroup.label }}</h2>
          <MoneyText class="text-sm font-bold" :amount-minor="activeGroup.total" />
        </div>

        <p class="px-6 py-2 text-xs text-fg-muted">{{ t('accounts.totalHint', { currency: baseCurrency }) }}</p>
        <BsDataTable
          id="accounts-table"
          v-model:first="firstRow"
          v-model:sort-field="sortField"
          v-model:sort-order="sortOrder"
          paginator
          :rows="25"
          :always-show-paginator="false"
          :value="filteredRows"
          data-key="account_id"
          table-class="ls-table"
          :table-props="{ 'aria-label': t('accounts.caption', { group: activeGroup.label }) }"
          :pt="{ tableContainer: { class: 'overflow-x-auto', tabindex: 0, role: 'region', 'aria-label': t('accounts.tableScroll') } }"
        >
          <Column field="code" :header="t('accounts.code')" sortable :pt="sortColumnPt">
            <template #body="{ data: account }">
              <span class="font-mono text-xs text-fg-muted" dir="ltr">{{ account.code || t('common.dash') }}</span>
            </template>
          </Column>
          <Column field="name" :header="t('accounts.account')" sortable :pt="sortColumnPt">
            <template #body="{ data: account }">
              <button v-if="account.account_role === 'posting' && canReadActivity" type="button" :disabled="!hydrated" class="text-start font-medium text-link hover:underline" :class="{ 'ps-4': account.parent_account_id }" @click="activityAccountId = account.account_id">{{ account.name }}</button>
              <span v-else :class="{ 'ps-4': account.parent_account_id, 'font-semibold': activeGroup.parentIds.has(account.account_id) }">{{ account.name }}</span>
              <span v-if="account.is_archived" class="ls-badge ms-2 bg-[var(--bs-surface-muted)] text-fg-muted">{{ t('accounts.archived') }}</span>
              <span v-else-if="account.is_liquid" class="ls-badge ms-2 bg-[var(--bs-status-info-bg)] text-[var(--bs-status-info)]">{{ t('accounts.liquid') }}</span>
            </template>
          </Column>
          <Column field="account_role" :header="t('accounts.role')">
            <template #body="{ data: account }">{{ t(`accounts.roles.${account.account_role}`) }}</template>
          </Column>
          <Column field="subtype" :header="t('accounts.subtype')">
            <template #body="{ data: account }">{{ t(`accounts.subtypes.${account.subtype}`) }}</template>
          </Column>
          <Column field="normal_balance" :header="t('accounts.normalBalance')">
            <template #body="{ data: account }">{{ t(`accounts.sides.${account.normal_balance}`) }}</template>
          </Column>
          <Column field="contra_account_id" :header="t('accounts.contraAccount')">
            <template #body="{ data: account }">{{ account.contra_account_id ? accountName(account.contra_account_id) : t('common.dash') }}</template>
          </Column>
          <Column field="currency" :header="t('accounts.currency')">
            <template #body="{ data: account }"><span class="text-fg-muted" dir="ltr">{{ account.currency }}</span></template>
          </Column>
          <Column field="entry_count" :header="t('accounts.entries')" body-class="ls-num text-fg-muted" />
          <Column field="net_debit_minor" :header="t('accounts.balance')" body-class="ls-num whitespace-nowrap">
            <template #body="{ data: account }">
              <span v-if="account.account_role === 'group'" class="text-fg-muted">{{ t('accounts.groupBalance') }}</span>
              <template v-else>
                <MoneyText :amount-minor="accountBalanceDisplay(account.net_debit_minor).amount" />
                <span class="ms-2">{{ t(`accounts.sides.${accountBalanceDisplay(account.net_debit_minor).side}`) }}</span>
              </template>
            </template>
          </Column>
          <Column v-if="can('accounts.read')" :header="t('accounts.actions')" body-class="whitespace-nowrap text-end">
            <template #body="{ data: account }">
              <button v-if="account.account_role === 'posting' && ['asset', 'liability', 'equity'].includes(account.type)" type="button" class="ls-btn ls-btn-sm me-1" @click="statementAccount = account">{{ t('statementClassification.title') }}</button>
              <button v-if="can('accounts.update')" type="button" class="ls-btn ls-btn-sm" @click="openEdit(account)">{{ t('accounts.edit') }}</button>
              <button v-if="can('accounts.archive') && !account.is_archived" type="button" class="ls-btn ls-btn-sm ms-1" @click="archiveAccount(account)">{{ t('accounts.archive') }}</button>
            </template>
          </Column>
          <template #paginatorcontainer="{ page, pageCount, prevPageCallback, nextPageCallback }">
            <nav class="flex flex-wrap items-center justify-center gap-3 border-t border-[var(--bs-border)] p-3" :aria-label="t('accounts.pages')">
              <button type="button" class="ls-btn ls-btn-sm" :disabled="page === 0" @click="prevPageCallback">{{ t('accounts.previousPage') }}</button>
              <span class="text-sm text-fg-muted">{{ t('accounts.pageCount', { page: page + 1, total: pageCount }) }}</span>
              <button type="button" class="ls-btn ls-btn-sm" :disabled="page + 1 >= (pageCount ?? 1)" @click="nextPageCallback">{{ t('accounts.nextPage') }}</button>
            </nav>
          </template>
          <template #empty>
            <EmptyState
              class="m-4"
              :title="search || hasArchivedInGroup ? t('accounts.noResults') : t('accounts.emptyGroupTitle', { group: activeGroup.label })"
              :description="search || hasArchivedInGroup ? t('accounts.noResultsHint') : t('accounts.emptyGroupHint')"
              :action-label="search ? t('accounts.clearSearch') : hasArchivedInGroup ? t('accounts.showArchived') : can('accounts.create') ? t('accounts.add') : undefined"
              @action="search ? clearSearch() : hasArchivedInGroup ? showArchived = true : openCreate()"
            />
          </template>
        </BsDataTable>
    </section>
      <AccountActivityDialog v-if="activityAccountId" :key="`${balanceKey}:${activityAccountId}`" :account-id="activityAccountId" :scope="balanceKey" @close="activityAccountId = null" />
      <AccountStatementClassificationDialog v-if="statementAccount" :key="`${balanceKey}:${statementAccount.account_id}`" :account="statementAccount" :scope="balanceKey" @close="statementAccount = null" />
      <BsDialog v-if="editorOpen" :visible="true" :title="editing ? t('accounts.edit') : t('accounts.add')" :aria-label="editing ? t('accounts.edit') : t('accounts.add')" :show-header="false" size="md" :dirty="overlayDirty0" :pending="submitting" @update:visible="value => { if (!value) editorOpen = false }"><template #default="{ close: dismiss }">
<form class="space-y-4 p-6" @submit.prevent="saveAccount">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold">{{ editing ? t('accounts.edit') : t('accounts.add') }}</h2>
            <button type="button" class="ls-btn ls-btn-sm" :aria-label="t('common.close')" @click="dismiss"><AppIcon name="close" /></button>
          </div>
          <QuotaUsageMeter v-if="!editing" quota-key="max_accounts" compact />
          <FloatingField :label="t('accounts.name')"><input id="account-name" v-model="form.name" class="ls-input" required></FloatingField>
          <FloatingField :label="t('accounts.code')"><input id="account-code" v-model="form.code" class="ls-input" dir="ltr"></FloatingField>
          <FloatingField :label="t('accounts.role')">
            <select id="account-role" v-model="form.accountRole" class="ls-input" :disabled="!!editing" aria-describedby="account-role-help">
              <option value="posting">{{ t('accounts.roles.posting') }}</option>
              <option value="group">{{ t('accounts.roles.group') }}</option>
            </select>
          </FloatingField>
          <p id="account-role-help" class="text-sm text-fg-muted">{{ t('accounts.roleHint') }}</p>
          <template v-if="!editing">
            <FloatingField :label="t('accounts.type')"><select id="account-type" v-model="form.type" class="ls-input"><option v-for="type in GROUP_TYPES" :key="type" :value="type">{{ t(`accounts.groups.${type}`) }}</option></select></FloatingField>
            <FloatingField :label="t('accounts.subtype')"><select id="account-subtype" v-model="form.subtype" class="ls-input"><option v-for="subtype in subtypeOptions[form.type]" :key="subtype" :value="subtype">{{ t(`accounts.subtypes.${subtype}`) }}</option></select></FloatingField>
            <FloatingField v-if="canMultiCurrency" :label="t('accounts.currency')">
              <select id="account-currency" v-model="form.currency" class="ls-input">
                <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
                  {{ currency.code }} — {{ currency.name }}
                </option>
              </select>
            </FloatingField>
            <p v-else class="text-sm text-fg-muted">{{ t('accounts.multiCurrencyUpgrade') }}</p>
          </template>
          <FloatingField v-if="!editing" :label="t('accounts.parentGroup')">
            <select id="account-parent" v-model="form.parentAccountId" class="ls-input">
              <option value="">{{ t('accounts.noParent') }}</option>
              <option v-for="account in parentOptions" :key="account.account_id" :value="account.account_id">{{ account.name }}</option>
            </select>
          </FloatingField>
          <p v-else-if="form.parentAccountId" class="text-sm text-fg-muted">{{ t('accounts.parentAccount') }}: {{ accountName(form.parentAccountId) }}</p>
          <template v-if="form.accountRole === 'posting'">
          <FloatingField :label="t('accounts.normalBalance')">
            <select id="account-normal-balance" v-model="form.normalBalance" class="ls-input" :disabled="natureLocked" aria-describedby="account-nature-help">
              <option value="debit">{{ t('accounts.sides.debit') }}</option>
              <option value="credit">{{ t('accounts.sides.credit') }}</option>
            </select>
          </FloatingField>
          <p id="account-nature-help" class="text-sm text-fg-muted">{{ t('accounts.natureHint') }}</p>
          <FloatingField :label="t('accounts.contraAccount')">
            <select id="account-contra" v-model="form.contraAccountId" class="ls-input" :disabled="natureLocked" aria-describedby="account-contra-help">
              <option value="">{{ t('accounts.noContra') }}</option>
              <option v-if="natureLocked && form.contraAccountId" :value="form.contraAccountId">{{ accountName(form.contraAccountId) }}</option>
              <option v-for="account in natureLocked ? [] : contraOptions" :key="account.account_id" :value="account.account_id">{{ account.name }}</option>
            </select>
          </FloatingField>
          <p id="account-contra-help" class="text-sm text-fg-muted">{{ t('accounts.contraHint') }}</p>
          <p v-if="natureLocked" class="text-sm text-fg-muted">{{ t('accounts.natureLocked') }}</p>
          </template>
          <p v-if="editorError" class="ls-error" role="alert">{{ editorError }}</p>
          <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="dismiss">{{ t('common.cancel') }}</button><button class="ls-btn ls-btn-primary" :disabled="submitting">{{ submitting ? t('common.saving') : t('common.save') }}</button></div>
        </form>
</template></BsDialog>
  </div>
</template>
