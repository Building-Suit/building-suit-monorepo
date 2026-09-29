<script setup lang="ts">
import { businessAreaForPath, businessModeSupportsPath, businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'

const route = useRoute()
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { locale, t } = useI18n()
const { shops, current, currentId, activeLocations, currentLocationId, loading, loadError, loadShops, selectShop, selectLocation } = useShop()

const accountOpen = ref(false)
const showErrorDetails = import.meta.dev
const isArabic = computed(() => locale.value === 'ar')

const copy = computed(() => isArabic.value
  ? { dashboard: 'التقارير ونظرة عامة', daily: 'العمل اليومي', manage: 'إدارة النشاط', pos: 'نقطة البيع', cashShifts: 'ورديات الخزنة', invoices: 'الفواتير', products: 'المنتجات', catalogSetup: 'إعداد الكتالوج والاستيراد', services: 'الخدمات', appointments: 'التقويم والمواعيد', inventory: 'المخزون', purchases: 'المشتريات', expenses: 'المصروفات', settings: 'إعدادات النشاط', billing: 'الاشتراك والفوترة', team: 'الفريق', reports: 'التقارير', soon: 'قريبًا', shop: 'المتجر', location: 'الفرع', account: 'الحساب', logout: 'تسجيل الخروج', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', loadFailed: 'تعذّر تحميل بيانات المتجر. حاول مرة أخرى.', retry: 'إعادة المحاولة' }
  : { dashboard: 'Reports & overview', daily: 'Daily work', manage: 'Business management', pos: 'Point of sale', cashShifts: 'Cashier shifts', invoices: 'Invoices', products: 'Products', catalogSetup: 'Catalog setup & import', services: 'Services', appointments: 'Calendar & appointments', inventory: 'Inventory', purchases: 'Purchases', expenses: 'Expenses', settings: 'Business settings', billing: 'Subscription & billing', team: 'Team', reports: 'Reports', soon: 'Soon', shop: 'Shop', location: 'Location', account: 'Account', logout: 'Sign out', openMenu: 'Open menu', closeMenu: 'Close menu', loadFailed: 'Unable to load shop data. Please try again.', retry: 'Retry' })

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
      { to: '/catalog-import', label: copy.value.catalogSetup, icon: 'ledger' },
      ...(businessModeSupportsServices(mode) ? [{ to: '/services', label: copy.value.services, icon: 'invoice' }] : []),
      { to: '/expenses', label: copy.value.expenses, icon: 'cash' },
      { to: '/billing', label: copy.value.billing, icon: 'wallet' },
      { to: '/settings', label: copy.value.settings, icon: 'settings' },
    ] },
  ]
})
await loadShops()

watch(() => route.fullPath, () => {
  accountOpen.value = false
})

watch(
  [() => current.value?.business_mode, () => route.path],
  ([mode, path]) => {
    if (!mode || businessModeSupportsPath(mode, path)) return
    void navigateTo({ path: '/dashboard', query: { modeDisabled: businessAreaForPath(path) ?? undefined } })
  },
)

async function logout() {
  await supabase.auth.signOut()
  await nuxtApp.runWithContext(() => navigateTo('/auth/login'))
}
</script>

<template>
  <BsAppShell product-name="Shop Suit" :groups="groups" :mobile-links="[...(groups[0]?.links.slice(0, 3) ?? []), { to: '/dashboard', label: copy.reports, icon: 'dashboard' }]" :labels="{ close: copy.closeMenu, open: copy.openMenu, navigation: copy.shop, dashboard: copy.dashboard }">
    <template #logo><AppLogo /></template>
    <template #context>
      <label v-if="shops.length" class="grid gap-1 text-xs font-bold sm:hidden">{{ copy.shop }}<select :value="currentId ?? ''" class="ls-select min-h-11 w-full" @change="selectShop(($event.target as HTMLSelectElement).value)"><option v-for="shop in shops" :key="shop.id" :value="shop.id">{{ shop.name }}</option></select></label>
    </template>
    <template #header>
      <SettingsMenu />
      <select v-if="shops.length" :value="currentId ?? ''" class="ls-select hidden min-h-11 w-36 truncate sm:block lg:w-48" :aria-label="copy.shop" @change="selectShop(($event.target as HTMLSelectElement).value)"><option v-for="shop in shops" :key="shop.id" :value="shop.id">{{ shop.name }}</option></select>
      <select v-if="activeLocations.length" :value="currentLocationId ?? ''" class="ls-select min-h-11 w-28 truncate sm:w-36 lg:w-48" :aria-label="copy.location" @change="selectLocation(($event.target as HTMLSelectElement).value)"><option v-for="location in activeLocations" :key="location.id" :value="location.id">{{ location.name }}</option></select>
      <div class="relative">
        <button type="button" class="ls-btn min-h-11 min-w-11" :aria-label="copy.account" :aria-expanded="accountOpen" @click="accountOpen = !accountOpen"><AppIcon name="user" /></button>
        <div v-if="accountOpen" class="ls-card absolute end-0 top-12 z-50 w-56 p-2 shadow-overlay"><p class="truncate px-3 py-2 text-xs">{{ user?.email }}</p><button type="button" class="ls-btn w-full" @click="logout">{{ copy.logout }}</button></div>
      </div>
    </template>
        <div v-if="loadError" class="rounded-2xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-5 text-[var(--bs-status-error)] dark:bg-[var(--bs-status-error-bg)] dark:text-[var(--bs-status-error)]" role="alert">
          <p class="text-sm font-bold">{{ copy.loadFailed }}</p>
          <p v-if="showErrorDetails" class="mt-2 text-xs opacity-75">{{ loadError }}</p>
          <button type="button" class="mt-3 rounded-lg border border-current px-3 py-2 text-sm font-semibold" @click="loadShops({ force: true })">{{ copy.retry }}</button>
        </div>
        <div v-else-if="loading" class="space-y-4">
          <div class="h-8 w-48 animate-pulse rounded-lg bg-muted" />
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div v-for="index in 4" :key="index" class="h-32 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
        <slot v-else />
    <template #overlays><ToastHost /></template>
  </BsAppShell>
</template>
