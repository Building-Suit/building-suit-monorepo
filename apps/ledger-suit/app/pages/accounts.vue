<script setup lang="ts">
import type { Database } from '~~/types/database.types'

definePageMeta({ layout: 'default' })
/**
 * Called "Accounts" for the user; internally this is the chart of accounts.
 * Balances come from public.account_balances, which derives them from posted
 * ledger entries — there is no stored balance to display.
 */

const supabase = useSupabaseClient<Database>()
const route = useRoute()
const router = useRouter()
const { currentId, can, baseCurrency } = useTenant()
const { t } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const { refresh: refreshPlanUsage } = usePlanUsage()

useHead({ title: () => `${t('accounts.title')} · ${t('app.name')}` })

const showArchived = ref(false)

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
  balance_minor: number
  entry_count: number
  is_archived: boolean
  is_liquid: boolean
  parent_account_id: string | null
}

const { data: balances, pending: balancesPending } = useLazyAsyncData<BalanceRow[]>('org:account-balances', async () => {
  if (!currentId.value) return []

  const { data, error } = await supabase
    .from('account_balances')
    .select('organization_id, account_id, code, name, type, subtype, currency, balance_minor, entry_count, is_archived, is_liquid, parent_account_id')
    .eq('organization_id', currentId.value)
    .order('code', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as BalanceRow[]
}, { watch: [currentId], default: () => [] })

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
    // Parents are headings; their own balance would double-count the children
    // beneath them, so the group total sums leaves only.
    const parentIds = new Set(rows.map(r => r.parent_account_id).filter(Boolean) as string[])
    const total = rows
      .filter(r => !parentIds.has(r.account_id))
      .reduce((sum, r) => sum + Number(r.balance_minor), 0)

    return { type, label: t(`accounts.groups.${type}`), rows, parentIds, total }
  }),
)

const activeGroup = computed(() => groups.value.find(group => group.type === tab.value)!)

const hasAccounts = computed(() => scopedBalances.value.length > 0)

const editorOpen = ref(false)
const editing = ref<BalanceRow | null>(null)
const submitting = ref(false)
const editorError = ref<string | null>(null)
const form = reactive({
  name: '', code: '', type: 'asset' as BalanceRow['type'], subtype: 'bank', currency: baseCurrency.value,
})

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
  Object.assign(form, { name: row.name, code: row.code ?? '', type: row.type, subtype: row.subtype })
  editorError.value = null
  editorOpen.value = true
}

watch(() => form.type, (type) => {
  if (!subtypeOptions[type].includes(form.subtype)) form.subtype = subtypeOptions[type][0]!
})

async function saveAccount() {
  if (!currentId.value) return
  submitting.value = true
  editorError.value = null
  try {
    const call = editing.value
      ? supabase.rpc('update_account' as never, {
          p_account_id: editing.value.account_id,
          p_name: form.name,
          p_code: form.code || undefined,
        } as never)
      : supabase.rpc('create_account' as never, {
          p_organization_id: currentId.value,
          p_name: form.name,
          p_code: form.code || undefined,
          p_type: form.type,
          p_subtype: form.subtype,
          p_currency: form.currency,
        } as never)
    const { error } = await call
    if (error) throw error
    if (!editing.value) await refreshPlanUsage()
    editorOpen.value = false
    toasts.success(t('accounts.saved'))
    await refreshNuxtData('org:account-balances')
    await refreshNuxtData('org:accounts')
  }
  catch (error) { editorError.value = describeError(error) }
  finally { submitting.value = false }
}

async function archiveAccount(row: BalanceRow) {
  const { error } = await supabase.rpc('archive_account' as never, { p_account_id: row.account_id } as never)
  if (error) return toasts.error(t('errors.generic'), describeError(error))
  toasts.success(t('accounts.archived'))
  await refreshNuxtData('org:account-balances')
  await refreshNuxtData('org:accounts')
}
const { dirty: overlayDirty0 } = useRecordAction(() => form, computed(() => Boolean(editorOpen.value)))
</script>

<template>
  <div class="space-y-6">
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

    <div class="flex gap-1 border-b border-[var(--bs-border)]" role="tablist" :aria-label="t('accounts.tabsLabel')">
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

    <SectionSkeleton v-if="balancesPending" variant="table" :rows="8" />

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

        <EmptyState
          v-if="activeGroup.rows.length === 0"
          class="m-4"
          :title="t('accounts.emptyGroupTitle', { group: activeGroup.label })"
          :description="t('accounts.emptyGroupHint')"
          :action-label="can('accounts.create') ? t('accounts.add') : undefined"
          @action="openCreate"
        />

        <div v-else class="overflow-x-auto">
          <BsDataTable :value="activeGroup.rows" data-key="account_id" :label="t('accounts.caption', { group: activeGroup.label })">
  <Column body-class="font-mono text-xs text-fg-muted">
    <template #header>{{ t('accounts.code') }}</template>
    <template #body="{ data: account }"><div dir="ltr">{{ account.code || t('common.dash') }}</div></template>
  </Column>
  <Column >
    <template #header>{{ t('accounts.account') }}</template>
    <template #body="{ data: account }"><span :class="{ 'ps-4': account.parent_account_id, 'font-semibold': activeGroup.parentIds.has(account.account_id) }">
                    {{ account.name }}
                  </span>
                  <span v-if="account.is_archived" class="ls-badge ms-2 bg-[var(--bs-surface-muted)] text-fg-muted">
                    {{ t('accounts.archived') }}
                  </span>
                  <span v-else-if="account.is_liquid" class="ls-badge ms-2 bg-[var(--bs-status-info-bg)] text-[var(--bs-status-info)]">
                    {{ t('accounts.liquid') }}
                  </span></template>
  </Column>
  <Column body-class="text-fg-muted">
    <template #header>{{ t('accounts.currency') }}</template>
    <template #body="{ data: account }"><div dir="ltr">{{ account.currency }}</div></template>
  </Column>
  <Column header-class="text-end" body-class="ls-num text-fg-muted">
    <template #header>{{ t('accounts.entries') }}</template>
    <template #body="{ data: account }">{{ account.entry_count }}</template>
  </Column>
  <Column header-class="text-end" body-class="ls-num">
    <template #header>{{ t('accounts.balance') }}</template>
    <template #body="{ data: account }"><MoneyText :amount-minor="account.balance_minor" /></template>
  </Column>
  <Column v-if="can('accounts.update')" body-class="whitespace-nowrap text-end">
    <template #header><span class="sr-only">{{ t('accounts.actions') }}</span></template>
    <template #body="{ data: account }"><button type="button" class="ls-btn ls-btn-sm" @click="openEdit(account)">{{ t('accounts.edit') }}</button>
                  <button
                    v-if="can('accounts.archive') && !account.is_archived"
                    type="button" class="ls-btn ls-btn-sm ms-1" @click="archiveAccount(account)"
                  >{{ t('accounts.archive') }}</button></template>
  </Column>
</BsDataTable>
        </div>
    </section>
      <BsDialog v-if="editorOpen" :visible="true" :title="editing ? t('accounts.edit') : t('accounts.add')" :aria-label="editing ? t('accounts.edit') : t('accounts.add')" :show-header="false" size="md" :dirty="overlayDirty0" :pending="submitting" @update:visible="value => { if (!value) editorOpen = false }"><template #default="{ close: dismiss }">
<form class="space-y-4 p-6" @submit.prevent="saveAccount">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold">{{ editing ? t('accounts.edit') : t('accounts.add') }}</h2>
            <button type="button" class="ls-btn ls-btn-sm" :aria-label="t('common.close')" @click="dismiss"><AppIcon name="close" /></button>
          </div>
          <QuotaUsageMeter v-if="!editing" quota-key="max_accounts" compact />
          <FloatingField :label="t('accounts.name')"><input id="account-name" v-model="form.name" class="ls-input" required></FloatingField>
          <FloatingField :label="t('accounts.code')"><input id="account-code" v-model="form.code" class="ls-input" dir="ltr"></FloatingField>
          <template v-if="!editing">
            <FloatingField :label="t('accounts.type')"><select id="account-type" v-model="form.type" class="ls-input"><option v-for="type in GROUP_TYPES" :key="type" :value="type">{{ t(`accounts.groups.${type}`) }}</option></select></FloatingField>
            <FloatingField :label="t('accounts.subtype')"><select id="account-subtype" v-model="form.subtype" class="ls-input"><option v-for="subtype in subtypeOptions[form.type]" :key="subtype" :value="subtype">{{ subtype.replaceAll('_', ' ') }}</option></select></FloatingField>
            <FloatingField v-if="canMultiCurrency" :label="t('accounts.currency')">
              <select id="account-currency" v-model="form.currency" class="ls-input">
                <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
                  {{ currency.code }} — {{ currency.name }}
                </option>
              </select>
            </FloatingField>
            <p v-else class="text-sm text-fg-muted">{{ t('accounts.multiCurrencyUpgrade') }}</p>
          </template>
          <p v-if="editorError" class="ls-error" role="alert">{{ editorError }}</p>
          <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="dismiss">{{ t('common.cancel') }}</button><button class="ls-btn ls-btn-primary" :disabled="submitting">{{ submitting ? t('common.saving') : t('common.save') }}</button></div>
        </form>
</template></BsDialog>
  </div>
</template>
