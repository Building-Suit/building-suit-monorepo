<script setup lang="ts">
const PRIMARY_NAV = [
  { to: '/dashboard', key: 'dashboard', icon: 'dashboard' },
  { to: '/transactions', key: 'transactions', icon: 'transactions' },
  { to: '/accounts', key: 'accounts', icon: 'wallet' },
  { to: '/reports', key: 'reports', icon: 'reports' },
] as const

const NAV_GROUPS = computed(() => [
  {
    key: 'finance',
    links: [
      ...(can('transactions.read') || can('transactions.create') || can('transactions.adjust') || can('imports.create') ? [{ to: '/transactions', label: 'nav.transactions' }] : []),
      ...(can('accounts.read') ? [{ to: '/accounts', label: 'nav.accounts' }] : []),
      ...(can('reports.read') ? [{ to: '/reports', label: 'nav.reports' }] : []),
      ...(can('opening_balances.read') ? [{ to: '/opening-balances', label: 'nav.openingBalances' }] : []),
      ...(can('bank.read') ? [{ to: '/bank-reconciliation', label: 'nav.bankReconciliation' }] : []),
      ...(can('assets.read') ? [{ to: '/fixed-assets', label: 'nav.fixedAssets' }] : []),
      ...(can('dimensions.read') ? [{ to: '/accounting-dimensions', label: 'nav.accountingDimensions' }] : []),
      ...(can('inventory.read') ? [{ to: '/inventory-accounting', label: 'nav.inventoryAccounting' }] : []),
      ...(can('tax.read') ? [{ to: '/tax-vat', label: 'nav.taxVat' }] : []),
      ...(can('ar.read') ? [{ to: '/receivables', label: 'ar.title' }] : []),
      ...(can('ap.read') ? [{ to: '/payables', label: 'ap.title' }] : []),
      ...(can('periods.read') ? [{ to: '/periods', label: 'nav.periods' }] : []),
    ],
  },
  {
    key: 'operations',
    links: [
      ...(can('commitments.read') ? [{ to: '/records/commitments', label: 'operations.tabs.commitments' }] : []),
      ...(can('recurring.read') ? [{ to: '/records/recurring', label: 'add.items.recurring' }] : []),
    ],
  },
  {
    key: 'directory',
    links: [
      ...(can('counterparties.read') ? [{ to: '/records/counterparties', label: 'operations.tabs.counterparties' }] : []),
      ...(can('tags.read') ? [{ to: '/records/tags', label: 'operations.tabs.tags' }] : []),
    ],
  },
  {
    key: 'workspace',
    links: [
      ...(can('members.read') ? [{ to: '/team', label: 'nav.teamInvitations' }] : []),
      ...(can('audit.read') ? [{ to: '/audit', label: 'nav.auditHistory' }] : []),
    ],
  },
].filter(group => group.links.length))


const { t } = useI18n()
const { current, currentId, loadOrganizations, loading } = useTenant()
const { can } = useTenant()
const {
  accessState,
  paymentRequired,
  readOnly,
  load: loadBilling,
} = useBilling()




await loadOrganizations()
await loadBilling()

const accessReady = computed(() => accessState.value !== 'loading' && !paymentRequired.value)
// Billing may resolve on the client before hydration finishes. Keep the server's
// initial branch until mount so Vue does not hydrate the shell into the loading
// div and retain that div's attributes instead of the shell's grid classes.
const initialShellReady = useState('ledger:initial-shell-ready', () => accessReady.value)
const hydrating = ref(useNuxtApp().isHydrating)
onMounted(() => { hydrating.value = false })
const showShell = computed(() => hydrating.value ? initialShellReady.value : accessReady.value)


watch(currentId, async (value, previous) => {
  if (value !== previous) await loadBilling()
})

</script>

<template>
  <div v-if="!showShell" class="min-h-dvh bg-background" aria-busy="true" />
  <BsAppShell v-else :product-name="t('app.name')" :groups="NAV_GROUPS.map(group => ({ ...group, label: t(`nav.groups.${group.key}`), links: group.links.map(item => ({ ...item, label: t(item.label) })) }))" :mobile-links="PRIMARY_NAV.map(item => ({ ...item, label: t(`nav.${item.key}`) }))" :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }">
    <template #logo><AppLogo class="h-14 w-auto max-w-52" /></template>
    <template #header><TrialCountdown /><NotificationMenu /><AccountMenu /><OrganizationSwitcher class="w-64" /></template>
        <div v-if="loading" class="text-sm text-fg-muted">{{ t('app.loading') }}</div>

        <OrganizationSetup v-else-if="!current" />

        <template v-else>
          <div v-if="readOnly" class="mb-6 rounded-control border border-warning bg-[var(--bs-status-warning-bg)] p-4 text-sm" role="status">
            <p class="font-semibold">{{ t('billing.readOnlyTitle') }}</p>
            <p>{{ t('billing.readOnlyBody') }}</p>
            <NuxtLink v-if="can('billing.manage')" to="/billing" class="mt-2 inline-block text-link">{{ t('billing.fixBilling') }}</NuxtLink>
          </div>
          <div class="pb-16"><slot /></div>
        </template>
    <template #overlays><FinancialSystemMap v-if="current" /><AddTransactionDialog /><OperationsCenter /><ToastHost /></template>
  </BsAppShell>
</template>
