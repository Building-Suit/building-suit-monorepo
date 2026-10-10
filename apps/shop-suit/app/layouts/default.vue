<script setup lang="ts">
import { businessAreaForPath, businessModeSupportsPath, businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'

const route = useRoute()
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { locale, t } = useI18n()
const { shops, current, currentId, activeLocations, currentLocationId, loading, loadError, loadShops, selectShop, selectLocation } = useShop()

const signingOut = ref(false)
const signOutError = ref('')
const showErrorDetails = import.meta.dev
const isArabic = computed(() => locale.value === 'ar')
const fullName = computed(() => {
  const value = user.value?.user_metadata.full_name ?? user.value?.user_metadata.name
  return typeof value === 'string' ? value : ''
})
const shopOptions = computed(() => shops.value.map(shop => ({ id: shop.id, label: shop.name })))
const locationOptions = computed(() => activeLocations.value.map(location => ({ id: location.id, label: location.name })))

const copy = computed(() => isArabic.value
  ? { dashboard: 'التقارير ونظرة عامة', daily: 'العمل اليومي', manage: 'إدارة النشاط', pos: 'نقطة البيع', cashShifts: 'ورديات الخزنة', invoices: 'الفواتير', products: 'المنتجات', catalogSetup: 'إعداد الكتالوج والاستيراد', services: 'الخدمات', appointments: 'التقويم والمواعيد', inventory: 'المخزون', purchases: 'المشتريات', expenses: 'المصروفات', settings: 'إعدادات النشاط', billing: 'الاشتراك والفوترة', team: 'الفريق', reports: 'التقارير', soon: 'قريبًا', shop: 'المتجر', location: 'الفرع', account: 'الحساب', logout: 'تسجيل الخروج', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', loadFailed: 'تعذّر تحميل بيانات المتجر. حاول مرة أخرى.', retry: 'إعادة المحاولة', loading: 'جاري تحميل المتجر…', signOutFailed: 'تعذّر تسجيل الخروج. حاول مرة أخرى.' }
  : { dashboard: 'Reports & overview', daily: 'Daily work', manage: 'Business management', pos: 'Point of sale', cashShifts: 'Cashier shifts', invoices: 'Invoices', products: 'Products', catalogSetup: 'Catalog setup & import', services: 'Services', appointments: 'Calendar & appointments', inventory: 'Inventory', purchases: 'Purchases', expenses: 'Expenses', settings: 'Business settings', billing: 'Subscription & billing', team: 'Team', reports: 'Reports', soon: 'Soon', shop: 'Shop', location: 'Location', account: 'Account', logout: 'Sign out', openMenu: 'Open menu', closeMenu: 'Close menu', loadFailed: 'Unable to load shop data. Please try again.', retry: 'Retry', loading: 'Loading shop…', signOutFailed: 'Could not sign out. Please try again.' })

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
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await nuxtApp.runWithContext(() => navigateTo('/auth/login'))
  } catch { signOutError.value = copy.value.signOutFailed }
  finally { signingOut.value = false }
}
</script>

<template>
  <BsAppShell product-name="Shop Suit" :groups="groups" :mobile-links="[...(groups[0]?.links.slice(0, 3) ?? []), { to: '/dashboard', label: copy.reports, icon: 'dashboard' }]" :labels="{ close: copy.closeMenu, open: copy.openMenu, navigation: copy.shop, dashboard: copy.dashboard }">
    <template #logo><BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" /></template>
    <template #context>
      <BsScopeSwitcher v-if="shops.length" :model-value="currentId" :label="copy.shop" :options="shopOptions" visibility="mobile" @update:model-value="value => { if (value) selectShop(value) }" />
    </template>
    <template #header>
      <BsScopeSwitcher v-if="shops.length" :model-value="currentId" :label="copy.shop" :options="shopOptions" compact visibility="desktop" @update:model-value="value => { if (value) selectShop(value) }" />
      <BsScopeSwitcher v-if="activeLocations.length" :model-value="currentLocationId" :label="copy.location" :options="locationOptions" compact @update:model-value="value => { if (value) selectLocation(value) }" />
      <BsUserMenu
        :name="fullName"
        :email="user?.email"
        :account-label="copy.account"
        :sign-out-label="copy.logout"
        :sign-out-pending="signingOut"
        :error="signOutError"
        @sign-out="logout"
      />
    </template>
        <BsStateSurface v-if="loadError" state="error" :title="copy.loadFailed" :description="showErrorDetails ? loadError : undefined" :action-label="copy.retry" @action="loadShops({ force: true })" />
        <BsSectionSkeleton v-else-if="loading" variant="cards" />
        <BsSlot v-else :render="$slots.default" />
    <template #overlays>
      <BsToastHost />
    </template>
  </BsAppShell>
</template>
