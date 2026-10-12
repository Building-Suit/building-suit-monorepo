<script setup lang="ts">
import type { ShopBilling } from '~/types/billing'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { businessAreaForPath, businessModeSupportsPath, businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'

const route = useRoute()
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { locale, t } = useI18n()
const { shops, current, currentId, activeLocations, currentLocationId, loading, loadError, loadShops, selectShop, selectLocation } = useShop()

const { isOwner, currentMembership } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const billingRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { data: sidebarSnapshot } = useAsyncData('shop-data:sidebar-subscription', async () => {
  if (loading.value || !currentId.value || !isOwner.value || !currentMembership.value) return null
  const shopId = currentId.value, profileId = currentMembership.value.profile_id
  const { data, error } = await billingRpc.rpc('shop_billing_read', { p_shop_id: shopId })
  if (error) throw error
  return { shopId, profileId, subscription: (data as ShopBilling | null)?.subscription ?? null }
}, { watch: [currentId, loading, isOwner, () => currentMembership.value?.profile_id, () => route.path], default: () => null })
const sidebarSubscription = computed(() => isOwner.value && sidebarSnapshot.value?.shopId === currentId.value && sidebarSnapshot.value?.profileId === currentMembership.value?.profile_id ? sidebarSnapshot.value.subscription : null)
const planStatus = computed(() => {
  const status = sidebarSubscription.value?.accessState
  const labels = isArabic.value ? { trialing: 'فترة التجربة', active: 'اشتراك نشط', read_only: 'للقراءة فقط', suspended: 'موقوف' } : { trialing: 'Free trial', active: 'Active subscription', read_only: 'Read only', suspended: 'Suspended' }
  return status ? labels[status] : ''
})
const planDetail = computed(() => {
  const subscription = sidebarSubscription.value
  if (!subscription) return ''
  const expiry = subscription.accessState === 'trialing' ? subscription.trialEndAt : subscription.periodEnd
  if (!expiry || !Number.isFinite(new Date(expiry).getTime())) return ''
  return expiry ? `${isArabic.value ? 'حتى' : 'Until'} ${new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium' }).format(new Date(expiry))}` : ''
})
const signingOut = ref(false)
const signOutError = ref('')
const showErrorDetails = import.meta.dev
const fullName = computed(() => {
  const value = user.value?.user_metadata.full_name ?? user.value?.user_metadata.name
  return typeof value === 'string' ? value : ''
})
const shopOptions = computed(() => shops.value.map(shop => ({ id: shop.id, label: shop.name })))
const locationOptions = computed(() => activeLocations.value.map(location => ({ id: location.id, label: location.name })))

const copy = computed(() => isArabic.value
  ? { dashboard: 'التقارير ونظرة عامة', daily: 'العمل اليومي', manage: 'إدارة النشاط', pos: 'نقطة البيع', cashShifts: 'ورديات الخزنة', invoices: 'الفواتير', products: 'المنتجات', catalogSetup: 'إعداد الكتالوج والاستيراد', services: 'الخدمات', appointments: 'التقويم والمواعيد', inventory: 'المخزون', purchases: 'المشتريات', expenses: 'المصروفات', settings: 'إعدادات النشاط', billing: 'الاشتراك والفوترة', team: 'الفريق', reports: 'التقارير', soon: 'قريبًا', shop: 'المتجر', location: 'الفرع', account: 'الحساب', logout: 'تسجيل الخروج', openMenu: 'فتح القائمة', collapseMenu: 'طي القائمة', closeMenu: 'إغلاق القائمة', loadFailed: 'تعذّر تحميل بيانات المتجر. حاول مرة أخرى.', retry: 'إعادة المحاولة', loading: 'جاري تحميل المتجر…', signOutFailed: 'تعذّر تسجيل الخروج. حاول مرة أخرى.' }
  : { dashboard: 'Reports & overview', daily: 'Daily work', manage: 'Business management', pos: 'Point of sale', cashShifts: 'Cashier shifts', invoices: 'Invoices', products: 'Products', catalogSetup: 'Catalog setup & import', services: 'Services', appointments: 'Calendar & appointments', inventory: 'Inventory', purchases: 'Purchases', expenses: 'Expenses', settings: 'Business settings', billing: 'Subscription & billing', team: 'Team', reports: 'Reports', soon: 'Soon', shop: 'Shop', location: 'Location', account: 'Account', logout: 'Sign out', openMenu: 'Open menu', collapseMenu: 'Collapse sidebar', closeMenu: 'Close menu', loadFailed: 'Unable to load shop data. Please try again.', retry: 'Retry', loading: 'Loading shop…', signOutFailed: 'Could not sign out. Please try again.' })

const groups = computed(() => {
  const mode = current.value?.business_mode ?? 'mixed'
  return [
    { key: 'daily', label: copy.value.daily, links: [
      ...(businessModeSupportsServices(mode) ? [{ to: '/appointments', label: copy.value.appointments, icon: 'invoice' }] : []),
      { to: '/pos', label: copy.value.pos, icon: 'cash' },
      { to: '/customers', label: t('customers.title'), icon: 'user' },
      { to: '/team', label: copy.value.team, icon: 'user' },
      { to: '/cash-shifts', label: copy.value.cashShifts, icon: 'wallet' },
      { to: '/sales', label: t('sales.title'), icon: 'invoice' },
    ] },
    ...(businessModeSupportsProducts(mode) ? [{ key: 'stock', label: copy.value.inventory, links: [
      { to: '/products', label: copy.value.products, icon: 'ledger' },
      { to: '/inventory', label: copy.value.inventory, icon: 'wallet' },
      { to: '/purchases', label: copy.value.purchases, icon: 'cash' },
    ] }] : []),
    { key: 'manage', label: copy.value.manage, links: [
      { to: '/reports', label: copy.value.reports, icon: 'reports' },
      { to: '/catalog-import', label: copy.value.catalogSetup, icon: 'ledger' },
      ...(businessModeSupportsServices(mode) ? [{ to: '/services', label: copy.value.services, icon: 'invoice' }] : []),
      { to: '/expenses', label: copy.value.expenses, icon: 'cash' },
      { to: '/billing', label: copy.value.billing, icon: 'wallet' },
      { to: '/settings', label: copy.value.settings, icon: 'settings' },
    ] },
  ]
})
await loadShops()

watch(
  [() => current.value?.business_mode, () => route.path],
  ([mode, path]) => {
    if (!mode || businessModeSupportsPath(mode, path)) return
    void navigateTo({ path: '/dashboard', query: { modeDisabled: businessAreaForPath(path) ?? undefined } })
  },
)

async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  signOutError.value = ''
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    await nuxtApp.runWithContext(() => navigateTo('/auth/login'))
  } catch { signOutError.value = copy.value.signOutFailed }
  finally { signingOut.value = false }
}

const shellHeaderScopes = computed(() => [
  ...(shops.value.length ? [{ key: 'workspace', value: currentId.value, label: copy.value.shop, options: shopOptions.value, visibility: 'desktop' as const }] : []),
  ...(activeLocations.value.length ? [{ key: 'location', value: currentLocationId.value, label: copy.value.location, options: locationOptions.value }] : []),
])
function selectShellScope(key: string, value: string | null) { if (!value) return; if (key === 'workspace') return selectShop(value); if (key === 'location') return selectLocation(value) }
</script>
<template>
  <BsWorkspaceShell variant="shop" :sidebar-plan="sidebarSubscription ? { name: sidebarSubscription.planName, status: planStatus, detail: planDetail, actionLabel: copy.billing, to: '/billing' } : undefined" home-path="/dashboard" product-name="Shop Suit" :groups="groups" :mobile-links="[...(groups[0]?.links.slice(0, 3) ?? []), { to: '/dashboard', label: copy.reports, icon: 'dashboard' }]" :labels="{ close: copy.closeMenu, open: copy.openMenu, collapse: copy.collapseMenu, navigation: copy.shop, dashboard: copy.dashboard }" :logo="{ kind: 'product', assetPrefix: '/brand/shop-suit' }" :context-scope="shops.length ? { key: 'workspace', value: currentId, label: copy.shop, options: shopOptions } : undefined" :header-scopes="shellHeaderScopes" :account="{ actions: [{ to: '/settings#shop-profile', label: copy.settings, icon: 'settings' }, ...(isOwner ? [{ to: '/billing', label: copy.billing, icon: 'wallet' }] : [])], name: fullName, email: user?.email, label: copy.account, signOut: copy.logout, pending: signingOut, error: signOutError }" :state="{ loading, error: Boolean(loadError), title: copy.loadFailed, description: showErrorDetails ? loadError || undefined : undefined, retry: copy.retry }" feedback @scope="selectShellScope" @retry="loadShops({ force: true })" @sign-out="logout"><slot /></BsWorkspaceShell>
</template>
