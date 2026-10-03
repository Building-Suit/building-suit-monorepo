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
  subscription,
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
const { data: notifications, refresh: refreshNotifications } = useLazyAsyncData('org:notifications', async () => {
  if (!currentId.value) return []
  const { data, error } = await supabase.from('notifications').select('*').eq('organization_id', currentId.value).order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data ?? []
}, { watch: [currentId], default: () => [] })
const notificationItems = computed(() => notifications.value.map(item => ({ id: item.id, title: item.title, body: item.body ?? undefined, read: Boolean(item.read_at) })))
async function markNotificationRead(id: string) { await supabase.rpc('mark_notification_read' as never, { p_notification_id: id } as never); await refreshNotifications() }
async function markAllNotificationsRead() { if (!currentId.value) return; await supabase.rpc('mark_all_notifications_read' as never, { p_organization_id: currentId.value } as never); await refreshNotifications() }

const now = ref(Date.now())
const checkingTrialExpiration = ref(false)
const remainingTrialMilliseconds = computed(() => accessState.value === 'trialing' && subscription.value?.trial_ends_at ? Math.max(0, new Date(subscription.value.trial_ends_at).getTime() - now.value) : null)
const trialParts = computed(() => { const totalMinutes = Math.ceil((remainingTrialMilliseconds.value ?? 0) / 60_000); return { days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60 } })
let trialTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => { now.value = Date.now(); trialTimer = setInterval(() => { now.value = Date.now() }, 30_000) })
onBeforeUnmount(() => clearInterval(trialTimer))
watch(remainingTrialMilliseconds, async (remaining) => {
  if (remaining !== 0 || checkingTrialExpiration.value) return
  checkingTrialExpiration.value = true
  try { await loadBilling({ force: true }); if (paymentRequired.value) await navigateTo('/subscribe', { replace: true }) }
  finally { checkingTrialExpiration.value = false }
})

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
  <BsStateSurface v-if="!showShell" state="loading" :title="t('app.loading')" />
  <BsAppShell v-else :product-name="t('app.name')" :groups="NAV_GROUPS.map(group => ({ ...group, label: t(`nav.groups.${group.key}`), links: group.links.map(item => ({ ...item, label: t(item.label) })) }))" :mobile-links="PRIMARY_NAV.map(item => ({ ...item, label: t(`nav.${item.key}`) }))" :labels="{ close: t('nav.close'), open: t('nav.open'), navigation: t('nav.primary'), dashboard: t('nav.dashboard') }">
    <template #logo><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" size="navigation" /></template>
    <template #context><OrganizationSwitcher /></template>
    <template #header>
      <BsTrialCountdown v-if="remainingTrialMilliseconds !== null" to="/billing" :label="t('billing.trialCountdown', trialParts)" :compact-label="t('billing.trialCountdownCompact', trialParts)" />
      <BsNotificationMenu :items="notificationItems" :label="t('notifications.title')" :empty-label="t('notifications.empty')" :mark-all-label="t('notifications.markAll')" @select="markNotificationRead" @mark-all="markAllNotificationsRead" />
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
        <BsStateSurface v-if="loading" state="loading" :title="t('app.loading')" />

        <OrganizationSetup v-else-if="!current" />

        <template v-else>
          <BsReadOnlyBanner v-if="readOnly" :title="t('billing.readOnlyTitle')" :description="t('billing.readOnlyBody')" :action-label="can('billing.manage') ? t('billing.fixBilling') : undefined" action-to="/billing" />
          <BsPageBody><BsSlot :render="$slots.default" /></BsPageBody>
        </template>
    <template #overlays><FinancialSystemMap v-if="current" /><AddTransactionDialog /><OperationsCenter /><TeamMenu :show-trigger="false" /><BsToastHost /></template>
  </BsAppShell>
</template>
