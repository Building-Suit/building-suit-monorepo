<script setup lang="ts">
import type { AccountTreeRow, ChartAccount } from '~/utils/accountTree'

const props = defineProps<{ accounts: ChartAccount[], search: string, scope: string, hydrated: boolean }>()
const emit = defineEmits<{ activity: [account: ChartAccount], edit: [account: ChartAccount], archive: [account: ChartAccount], classify: [account: ChartAccount], createChild: [account: ChartAccount] }>()
const { t } = useI18n()
const { can, baseCurrency } = useTenant()
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
function rowClass(row: AccountTreeRow) { return row.kind === 'type' ? 'bg-surface-muted font-bold' : row.kind === 'section' ? 'font-semibold' : '' }
</script>

<template>
  <section class="ls-card overflow-hidden" :aria-label="t('accountTree.title')">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
      <div>
        <h2 class="font-bold">{{ t('accountTree.title') }}</h2>
        <p class="mt-1 text-xs text-fg-muted">{{ t('accountTree.hint', { currency: baseCurrency }) }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="ls-btn ls-btn-sm" :disabled="!hydrated || !!search" @click="collapsed = new Set()">{{ t('accountTree.expandAll') }}</button>
        <button type="button" class="ls-btn ls-btn-sm" :disabled="!hydrated || !!search" @click="collapseAll">{{ t('accountTree.collapseAll') }}</button>
      </div>
    </div>
    <p v-if="search" role="status" class="px-4 py-3 text-sm text-fg-muted">{{ t('accountTree.searchCount', { count }) }}</p>
    <BsDataTable id="accounts-tree" :value="rows" data-key="id" :label="t('accountTree.title')" :row-class="rowClass" :table-props="{ 'aria-label': t('accountTree.title') }">
      <Column :header="t('accounts.account')" body-class="chart-name-cell">
        <template #body="{ data: node }">
          <div class="flex items-start gap-2" :style="{ paddingInlineStart: `${node.depth * 1.125}rem` }">
            <button v-if="node.children.length" type="button" class="ls-btn ls-btn-sm shrink-0 p-1" :aria-expanded="node.expanded" :aria-label="t(node.expanded ? 'accountTree.collapse' : 'accountTree.expand', { name: node.label })" :disabled="!hydrated || !!search" @click="toggle(node.id)">
              <AppIcon :name="node.expanded ? 'arrowDown' : 'arrowRight'" directional :size="16" />
            </button>
            <span v-else class="w-5 shrink-0 border-b border-line mt-3" aria-hidden="true" />
            <div class="min-w-0 border-s border-line ps-3">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span v-if="node.account?.code" class="font-mono text-xs text-fg-muted" dir="ltr">{{ node.account.code }}</span>
                <button v-if="node.account?.account_role === 'posting' && canReadActivity" type="button" :disabled="!hydrated" class="text-start font-semibold text-link hover:underline" @click="emit('activity', node.account)">{{ node.label }}</button>
                <span v-else>{{ node.label }}</span>
                <span v-if="node.kind !== 'account' || node.children.length" class="ls-badge bg-surface-muted text-fg-muted">{{ node.count }}</span>
                <span v-if="node.account?.is_archived" class="ls-badge bg-surface-muted text-fg-muted">{{ t('accounts.archived') }}</span>
              </div>
              <p v-if="node.account" class="mt-1 text-xs font-normal text-fg-muted">{{ t(`accounts.subtypes.${node.account.subtype}`) }} · {{ t(`accounts.roles.${node.account.account_role}`) }}</p>
              <p v-else-if="!node.count" class="mt-1 text-xs font-normal text-fg-muted">{{ t('accountTree.emptySection') }}</p>
              <div v-if="node.account" class="mt-2 flex flex-wrap gap-1 font-normal">
                <button v-if="can('accounts.update')" type="button" class="ls-btn ls-btn-sm" @click="emit('edit', node.account)">{{ t('accounts.edit') }}</button>
                <button v-if="node.account.account_role === 'group' && !node.account.is_archived && can('accounts.create')" type="button" class="ls-btn ls-btn-sm" @click="emit('createChild', node.account)">{{ t('accountTree.addChild') }}</button>
                <details v-if="(node.account.account_role === 'posting' && ['asset', 'liability', 'equity'].includes(node.account.type)) || (can('accounts.archive') && !node.account.is_archived)" class="relative" :aria-label="t('accounts.actions')">
                  <summary class="ls-btn ls-btn-sm cursor-pointer">{{ t('accountTree.more') }}</summary>
                  <div class="mt-2 flex flex-wrap gap-1">
                    <button v-if="node.account.account_role === 'posting' && ['asset', 'liability', 'equity'].includes(node.account.type)" type="button" class="ls-btn ls-btn-sm" @click="emit('classify', node.account)">{{ t('statementClassification.title') }}</button>
                    <button v-if="can('accounts.archive') && !node.account.is_archived" type="button" class="ls-btn ls-btn-sm" @click="emit('archive', node.account)">{{ t('accounts.archive') }}</button>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </template>
      </Column>
      <Column :header="t('accounts.balance')" body-class="text-end align-top whitespace-nowrap" header-class="text-end">
        <template #body="{ data: node }">
          <template v-if="node.account?.account_role === 'posting' && !node.children.length">
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
:deep(.chart-name-cell) { width: 100%; min-width: 12rem; }
:deep(.ls-table td) { padding-block: 1rem; }
@media (max-width: 639px) {
  :deep(.ls-table th), :deep(.ls-table td) { padding-inline: .5rem; }
}
</style>
