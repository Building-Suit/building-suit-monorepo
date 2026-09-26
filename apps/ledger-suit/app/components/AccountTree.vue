<script setup lang="ts">
import type { AccountTreeRow, ChartAccount } from '~/utils/accountTree'

const props = defineProps<{ accounts: ChartAccount[], search: string, scope: string, hydrated: boolean }>()
const emit = defineEmits<{ activity: [account: ChartAccount], edit: [account: ChartAccount], archive: [account: ChartAccount], classify: [account: ChartAccount], createChild: [account: ChartAccount] }>()
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
function rowClass(row: AccountTreeRow) { return `chart-row chart-row-${row.kind}` }
</script>

<template>
  <section class="ls-card account-chart overflow-hidden" :aria-label="t('accountTree.title')">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
      <div>
        <h2 class="text-lg font-bold">{{ t('accountTree.title') }}</h2>
        <p class="mt-1 max-w-3xl text-sm leading-relaxed text-fg-muted">{{ t('accountTree.hint', { currency: baseCurrency }) }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="ls-btn ls-btn-sm" :disabled="!hydrated || !!search" @click="collapsed = new Set()">{{ t('accountTree.expandAll') }}</button>
        <button type="button" class="ls-btn ls-btn-sm" :disabled="!hydrated || !!search" @click="collapseAll">{{ t('accountTree.collapseAll') }}</button>
      </div>
    </div>
    <p v-if="search" role="status" class="px-4 py-3 text-sm text-fg-muted">{{ t('accountTree.searchCount', { count }) }}</p>
    <BsDataTable id="accounts-tree" :value="rows" data-key="id" :label="t('accountTree.title')" :row-class="rowClass" :table-props="{ 'aria-label': t('accountTree.title') }">
      <Column :header="t('accounts.account')" body-class="chart-name-cell" header-class="chart-name-cell">
        <template #body="{ data: node }">
          <div class="chart-branch" :class="{ 'chart-branch-nested': node.depth > 0 }" :style="{ '--tree-depth': node.depth }">
            <button v-if="node.children.length" type="button" class="ls-btn chart-toggle" :aria-expanded="node.expanded" :aria-label="t(node.expanded ? 'accountTree.collapse' : 'accountTree.expand', { name: node.label })" :disabled="!hydrated || !!search" @click="toggle(node.id)">
              <AppIcon :name="node.expanded ? 'arrowDown' : 'arrowRight'" directional :size="16" />
            </button>
            <span v-else class="chart-leaf" aria-hidden="true"><span /></span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span v-if="node.account?.code" class="rounded-control border border-line bg-surface px-2 py-0.5 font-mono text-sm text-fg-muted" dir="ltr">{{ node.account.code }}</span>
                <button v-if="node.account?.account_role !== 'group' && canReadActivity" type="button" :disabled="!hydrated" class="chart-label text-start font-semibold text-link hover:underline" @click="emit('activity', node.account)">{{ node.label }}</button>
                <span v-else class="chart-label">{{ node.label }}</span>
                <span v-if="node.kind !== 'account' || node.children.length" class="chart-count">{{ t('accountTree.accountCount', { count: node.count }) }}</span>
                <span v-if="node.account?.is_archived" class="ls-badge bg-surface-muted text-fg-muted">{{ t('accounts.archived') }}</span>
              </div>
              <p v-if="node.account" class="mt-1 text-sm font-normal text-fg-muted">
                {{ t(`accounts.roles.${node.account.account_role}`) }}
                <template v-if="node.account.control_subledger_type"> · {{ t(`controls.subledgers.${node.account.control_subledger_type}`) }}</template>
                <template v-else-if="node.account.account_role === 'posting'"> · {{ t(`accounts.subtypes.${node.account.subtype}`) }}</template>
              </p>
              <details v-if="node.account && ((writesAllowed && (can('accounts.update') || (can('accounts.archive') && !node.account.is_archived) || (node.account.account_role === 'group' && can('accounts.create') && !node.account.is_archived))) || (['posting', 'control'].includes(node.account.account_role)))" class="chart-actions" :aria-label="t('accountTree.actionsFor', { name: node.label })">
                <summary class="cursor-pointer text-sm font-medium text-link">{{ t('accountTree.more') }}</summary>
                <div class="mt-3 flex flex-wrap gap-2 font-normal">
                  <button v-if="can('accounts.update') && writesAllowed" type="button" class="ls-btn ls-btn-sm" @click="emit('edit', node.account)">{{ t('accounts.edit') }}</button>
                  <button v-if="node.account.account_role === 'group' && !node.account.is_archived && can('accounts.create') && writesAllowed" type="button" class="ls-btn ls-btn-sm" @click="emit('createChild', node.account)">{{ t('accountTree.addChild') }}</button>
                  <button v-if="['posting', 'control'].includes(node.account.account_role)" type="button" class="ls-btn ls-btn-sm" @click="emit('classify', node.account)">{{ t('statementClassification.title') }}</button>
                  <button v-if="can('accounts.archive') && !node.account.is_archived && writesAllowed" type="button" class="ls-btn ls-btn-sm" @click="emit('archive', node.account)">{{ t('accounts.archive') }}</button>
                </div>
              </details>
            </div>
          </div>
        </template>
      </Column>
      <Column :header="t('accounts.balance')" body-class="chart-balance-cell text-end whitespace-nowrap" header-class="text-end">
        <template #body="{ data: node }">
          <template v-if="node.account && node.account.account_role !== 'group' && !node.children.length">
            <MoneyText class="font-semibold" :amount-minor="accountBalanceDisplay(node.account.net_debit_minor).amount" />
            <p class="mt-1 text-xs font-normal text-fg-muted">{{ t(`accounts.sides.${accountBalanceDisplay(node.account.net_debit_minor).side}`) }}</p>
          </template>
          <template v-else>
            <MoneyText class="font-semibold" :amount-minor="node.total" />
            <p v-if="node.children.length" class="mt-1 text-xs font-normal text-fg-muted">{{ t('accountTree.subtotal') }}</p>
            <p v-if="node.account?.account_role === 'posting'" class="mt-1 text-xs font-normal text-fg-muted">{{ t('accountTree.directBalance') }}: <MoneyText :amount-minor="accountBalanceDisplay(node.account.net_debit_minor).amount" /> {{ t(`accounts.sides.${accountBalanceDisplay(node.account.net_debit_minor).side}`) }}</p>
          </template>
        </template>
      </Column>
      <template #empty><p class="p-6 text-fg-muted">{{ t('accounts.noResults') }}</p></template>
    </BsDataTable>
  </section>
</template>

<style scoped>
:deep(.ls-table) { table-layout: fixed; }
:deep(.chart-name-cell) { width: 70%; }
:deep(.ls-table td) { padding: 1rem 1.25rem; vertical-align: middle; font-size: 1rem; }
:deep(.ls-table th) { padding: .85rem 1.25rem; font-size: .8rem; }
:deep(.chart-row-type td) { background: var(--bs-surface-raised); border-block-start: 2px solid var(--bs-border-strong); font-weight: 700; }
:deep(.chart-row-type td:first-child) { border-inline-start: 4px solid var(--bs-primary); }
:deep(.chart-row-section td) { background: var(--bs-surface-muted); font-weight: 600; }
:deep(.chart-row-account:hover td) { background: var(--bs-surface-muted); }
.chart-branch { position: relative; display: flex; align-items: center; gap: .75rem; padding-inline-start: calc(var(--tree-depth) * 1.5rem); }
.chart-branch-nested::before { content: ''; position: absolute; inset-inline-start: calc((var(--tree-depth) - 1) * 1.5rem + 1rem); inset-block: -1rem; border-inline-start: 1px solid var(--bs-border-strong); }
.chart-branch-nested::after { content: ''; position: absolute; inset-inline-start: calc((var(--tree-depth) - 1) * 1.5rem + 1rem); width: .5rem; inset-block-start: 50%; border-block-start: 1px solid var(--bs-border-strong); }
.chart-label { line-height: 1.65; overflow-wrap: anywhere; }
:deep(.chart-row-type) .chart-label { font-size: 1.125rem; }
.chart-count { font-size: .8rem; font-weight: 500; color: var(--bs-text-muted); white-space: nowrap; }
.chart-toggle, .chart-leaf { display: grid; place-items: center; flex-shrink: 0; width: 2rem; min-width: 2rem; height: 2rem; min-height: 2rem; padding: 0; }
.chart-leaf span { width: .4rem; height: .4rem; border-radius: 50%; background: var(--bs-border-strong); }
.chart-actions { margin-block-start: .5rem; }
.chart-actions summary { width: fit-content; padding-block: .25rem; }
:deep(.chart-balance-cell) { font-variant-numeric: tabular-nums; }
@media (max-width: 639px) {
  :deep(.ls-table td), :deep(.ls-table th) { padding-inline: .6rem; }
  :deep(.chart-name-cell) { width: 56%; }
  :deep(.chart-balance-cell) { white-space: normal; font-size: .875rem; }
  :deep(.chart-balance-cell > .tabular-nums) { display: block; max-width: 100%; overflow-x: auto; white-space: nowrap; }
  .chart-branch { gap: .35rem; padding-inline-start: calc(min(var(--tree-depth), 4) * .55rem); }
  .chart-branch-nested::before { inset-inline-start: calc((min(var(--tree-depth), 4) - 1) * .55rem); }
  .chart-branch-nested::after { inset-inline-start: calc((min(var(--tree-depth), 4) - 1) * .55rem); width: .55rem; }
  .chart-toggle, .chart-leaf { width: 1.75rem; min-width: 1.75rem; }
}
</style>
