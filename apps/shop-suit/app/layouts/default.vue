<script setup lang="ts">
import { businessAreaForPath, businessModeSupportsPath, businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'

const route = useRoute()
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { locale } = useI18n()
const { shops, current, currentId, loading, loadError, loadShops, selectShop } = useShop()

const accountOpen = ref(false)
const showErrorDetails = import.meta.dev
const isArabic = computed(() => locale.value === 'ar')

const copy = computed(() => isArabic.value
  ? { dashboard: 'لوحة التحكم', invoices: 'الفواتير', products: 'المنتجات', services: 'الخدمات', inventory: 'المخزون', purchases: 'المشتريات', expenses: 'المصروفات', settings: 'إعدادات النشاط', team: 'الفريق', reports: 'التقارير', soon: 'قريبًا', shop: 'المتجر', account: 'الحساب', logout: 'تسجيل الخروج', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', loadFailed: 'تعذّر تحميل بيانات المتجر. حاول مرة أخرى.', retry: 'إعادة المحاولة' }
  : { dashboard: 'Dashboard', invoices: 'Invoices', products: 'Products', services: 'Services', inventory: 'Inventory', purchases: 'Purchases', expenses: 'Expenses', settings: 'Business settings', team: 'Team', reports: 'Reports', soon: 'Soon', shop: 'Shop', account: 'Account', logout: 'Sign out', openMenu: 'Open menu', closeMenu: 'Close menu', loadFailed: 'Unable to load shop data. Please try again.', retry: 'Retry' })

const links = computed(() => {
  const mode = current.value?.business_mode ?? 'mixed'
  return [
    ...(businessModeSupportsProducts(mode) ? [
      { to: '/products', label: copy.value.products, icon: 'ledger' },
      { to: '/inventory', label: copy.value.inventory, icon: 'wallet' },
      { to: '/purchases', label: copy.value.purchases, icon: 'cash' },
    ] : []),
    ...(businessModeSupportsServices(mode) ? [
      { to: '/services', label: copy.value.services, icon: 'invoice' },
    ] : []),
    { to: '/expenses', label: copy.value.expenses, icon: 'cash' },
    { to: '/settings', label: copy.value.settings, icon: 'settings' },
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
  <BsAppShell product-name="Shop Suit" :groups="[{ key: 'shop', label: copy.shop, links }]" :mobile-links="[{ to: '/dashboard', label: copy.dashboard, icon: 'dashboard' }, ...links.slice(0, 3)]" :labels="{ close: copy.closeMenu, open: copy.openMenu, navigation: copy.shop, dashboard: copy.dashboard }">
    <template #logo><AppLogo /></template>
    <template #header>
      <SettingsMenu />
      <select v-if="shops.length" :value="currentId ?? ''" class="ls-select max-w-64" :aria-label="copy.shop" @change="selectShop(($event.target as HTMLSelectElement).value)"><option v-for="shop in shops" :key="shop.id" :value="shop.id">{{ shop.name }}</option></select>
      <div class="relative">
        <button type="button" class="ls-btn ls-btn-sm" :aria-label="copy.account" :aria-expanded="accountOpen" @click="accountOpen = !accountOpen"><AppIcon name="user" /></button>
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
