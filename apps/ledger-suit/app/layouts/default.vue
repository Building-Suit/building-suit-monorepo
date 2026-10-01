<script setup lang="ts">
import type { Database } from '~~/types/database.types'

const PRIMARY_NAV = [
  { to: '/dashboard', key: 'dashboard', icon: 'dashboard' },
  { to: '/transactions', key: 'transactions', icon: 'transactions' },
  { to: '/accounts', key: 'accounts', icon: 'wallet' },
  { to: '/reports', key: 'reports', icon: 'reports' },
] as const

const NAV_GROUPS = computed(() => [
  {
    key: 'ledger',
    links: [
      ...(can('transactions.read') || can('transactions.create') || can('transactions.adjust') || can('imports.create') ? [{ to: '/transactions', label: 'nav.transactions' }] : []),
      ...(can('accounts.read') ? [{ to: '/accounts', label: 'nav.accounts' }] : []),
      ...(can('migrations.read') ? [{ to: '/migration-center', label: 'nav.migrationCenter' }] : []),
      ...(can('opening_balances.read') ? [{ to: '/opening-balances', label: 'nav.openingBalances' }] : []),
      ...(can('periods.read') ? [{ to: '/periods', label: 'nav.periods' }] : []),
    ],
  },
  {
    key: 'subledgers',
    links: [
      ...(can('ar.read') ? [{ to: '/receivables', label: 'ar.title' }] : []),
      ...(can('ap.read') ? [{ to: '/payables', label: 'ap.title' }] : []),
      ...(can('bank.read') ? [{ to: '/bank-reconciliation', label: 'nav.bankReconciliation' }] : []),
      ...(can('assets.read') ? [{ to: '/fixed-assets', label: 'nav.fixedAssets' }] : []),
      ...(can('inventory.read') ? [{ to: '/inventory-accounting', label: 'nav.inventoryAccounting' }] : []),
      ...(can('tax.read') ? [{ to: '/tax-vat', label: 'nav.taxVat' }] : []),
    ],
  },
  {
    key: 'insights',
    links: [
      ...(organizations.value.length > 1 ? [{ to: '/clients', label: 'nav.clients' }] : []),
      ...(can('reports.read') ? [{ to: '/reports', label: 'nav.reports' }] : []),
      ...(can('dimensions.read') ? [{ to: '/accounting-dimensions', label: 'nav.accountingDimensions' }] : []),
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
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const { current, currentId, organizations, loadOrganizations, loading } = useTenant()
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
const signingOut = ref(false)
const signOutError = ref('')
const userId = computed(() => user.value?.id)
const { data: profile } = useLazyAsyncData('account:profile', async () => {
  if (!userId.value) return null
  const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId.value).maybeSingle()
  if (error) throw error
  return data
}, { watch: [userId] })
const fullName = computed(() => {
  if (profile.value?.full_name) return profile.value.full_name
  const metadataName = user.value?.user_metadata.full_name ?? user.value?.user_metadata.name
  return typeof metadataName === 'string' ? metadataName : ''
})
const userMenuActions = computed(() => can('billing.read')
  ? [{ to: '/billing', label: t('billing.title'), icon: 'wallet' }]
  : [])

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  signOutError.value = ''
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await navigateTo('/login')
  }
  catch {
    signOutError.value = t('errors.generic')
  }
  finally {
    signingOut.value = false
  }
}


watch(currentId, async (value, previous) => {
  if (value !== previous) await loadBilling()
})

</script>

<template>
  <div v-if="!showShell" class="min-h-dvh bg-background" aria-busy="true" />
  <BsAppShell v-else :product-name="t('app.name')" :groups="NAV_GROUPS.map(group => ({ ...group, label: t(`nav.groups.${group.key}`), links: group.links.map(item => ({ ...item, label: t(item.label) })) }))" :mobile-links="PRIMARY_NAV.map(item => ({ ...item, label: t(`nav.${item.key}`) }))" :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }">
    <template #logo><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" class="h-14 w-auto max-w-52" /></template>
    <template #context><OrganizationSwitcher /></template>
    <template #header>
      <TrialCountdown />
      <NotificationMenu />
      <BsUserMenu
        :name="fullName"
        :email="user?.email"
        :actions="userMenuActions"
        :account-label="t('common.accountMenu')"
        :sign-out-label="t('common.signOut')"
        :sign-out-pending="signingOut"
        :error="signOutError"
        @sign-out="signOut"
      />
    </template>
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
    <template #overlays><FinancialSystemMap v-if="current" /><AddTransactionDialog /><OperationsCenter /><TeamMenu :show-trigger="false" /><ToastHost /></template>
  </BsAppShell>
</template>
