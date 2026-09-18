<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { locale } = useI18n()
const { shops, current, currentId, loading, loadError, loadShops, selectShop } = useShop()

const mobileOpen = ref(false)
const accountOpen = ref(false)
const showErrorDetails = import.meta.dev
const isArabic = computed(() => locale.value === 'ar')

const copy = computed(() => isArabic.value
  ? { dashboard: 'لوحة التحكم', invoices: 'الفواتير', products: 'المنتجات', services: 'الخدمات', inventory: 'المخزون', expenses: 'المصروفات', team: 'الفريق', reports: 'التقارير', soon: 'قريبًا', shop: 'المتجر', account: 'الحساب', logout: 'تسجيل الخروج', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', loadFailed: 'تعذّر تحميل بيانات المتجر. حاول مرة أخرى.', retry: 'إعادة المحاولة' }
  : { dashboard: 'Dashboard', invoices: 'Invoices', products: 'Products', services: 'Services', inventory: 'Inventory', expenses: 'Expenses', team: 'Team', reports: 'Reports', soon: 'Soon', shop: 'Shop', account: 'Account', logout: 'Sign out', openMenu: 'Open menu', closeMenu: 'Close menu', loadFailed: 'Unable to load shop data. Please try again.', retry: 'Retry' })

const plannedNav = computed(() => [
  { label: copy.value.invoices, icon: 'lucide:receipt-text' },
  { label: copy.value.team, icon: 'lucide:users-round' },
  { label: copy.value.reports, icon: 'lucide:chart-no-axes-combined' },
])

await loadShops()

watch(() => route.fullPath, () => {
  mobileOpen.value = false
  accountOpen.value = false
})

async function logout() {
  await supabase.auth.signOut()
  await nuxtApp.runWithContext(() => navigateTo('/auth/login'))
}

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-4 lg:p-4">
    <aside
      class="fixed inset-y-0 start-0 z-50 w-[17rem] border-e border-border bg-[#0b0b0d] text-white lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)] lg:rounded-2xl lg:border lg:border-white/10"
      :class="mobileOpen ? 'block' : 'hidden'"
    >
      <div class="flex h-full min-h-0 flex-col p-4">
        <div class="mb-6 flex items-center justify-between">
          <NuxtLink to="/dashboard" class="flex items-center gap-3">
            <div class="grid size-10 place-items-center rounded-xl border border-[#d89b42]/30 bg-[#141416]">
              <span class="font-extrabold text-[#ebb45a]">S</span>
            </div>
            <div>
              <p class="font-extrabold tracking-tight">Shop Suit</p>
              <p class="text-[10px] text-white/40">by Building Suit</p>
            </div>
          </NuxtLink>

          <button type="button" class="grid size-10 place-items-center rounded-xl text-white/60 hover:bg-white/5 hover:text-white lg:hidden" :aria-label="copy.closeMenu" @click="mobileOpen = false">
            <Icon name="lucide:x" class="size-5" />
          </button>
        </div>

        <div v-if="shops.length" class="mb-5">
          <label for="shop-switcher" class="mb-2 block px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{{ copy.shop }}</label>
          <select
            id="shop-switcher"
            :value="currentId ?? ''"
            class="h-11 w-full rounded-xl border border-white/10 bg-[#141416] px-3 text-sm font-semibold text-white outline-none focus:border-[#d89b42]"
            @change="selectShop(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="shop in shops" :key="shop.id" :value="shop.id">{{ shop.name }}</option>
          </select>
        </div>

        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <NuxtLink
            to="/dashboard"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
            :class="isActive('/dashboard') ? 'bg-[#d89b42] text-[#0b0b0d]' : 'text-white/65 hover:bg-white/5 hover:text-white'"
          >
            <Icon name="lucide:layout-dashboard" class="size-[18px]" />
            <span>{{ copy.dashboard }}</span>
          </NuxtLink>

          <div class="my-4 h-px bg-white/[0.07]" />

          <NuxtLink
            to="/products"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
            :class="isActive('/products') ? 'bg-[#d89b42] text-[#0b0b0d]' : 'text-white/65 hover:bg-white/5 hover:text-white'"
          >
            <Icon name="lucide:package" class="size-[18px]" />
            <span>{{ copy.products }}</span>
          </NuxtLink>
          <NuxtLink
            to="/inventory"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
            :class="isActive('/inventory') ? 'bg-[#d89b42] text-[#0b0b0d]' : 'text-white/65 hover:bg-white/5 hover:text-white'"
          >
            <Icon name="lucide:warehouse" class="size-[18px]" />
            <span>{{ copy.inventory }}</span>
          </NuxtLink>
          <NuxtLink
            to="/services"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
            :class="isActive('/services') ? 'bg-[#d89b42] text-[#0b0b0d]' : 'text-white/65 hover:bg-white/5 hover:text-white'"
          >
            <Icon name="lucide:briefcase-business" class="size-[18px]" />
            <span>{{ copy.services }}</span>
          </NuxtLink>
          <NuxtLink
            to="/expenses"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
            :class="isActive('/expenses') ? 'bg-[#d89b42] text-[#0b0b0d]' : 'text-white/65 hover:bg-white/5 hover:text-white'"
          >
            <Icon name="lucide:wallet-cards" class="size-[18px]" />
            <span>{{ copy.expenses }}</span>
          </NuxtLink>

          <button v-for="item in plannedNav" :key="item.label" type="button" disabled class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-white/30">
            <Icon :name="item.icon" class="size-[18px]" />
            <span class="flex-1">{{ item.label }}</span>
            <span class="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/30">{{ copy.soon }}</span>
          </button>
        </nav>

        <p class="mt-4 truncate border-t border-white/[0.07] px-3 pt-4 text-xs text-white/40">{{ user?.email }}</p>
      </div>
    </aside>

    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden" @click="mobileOpen = false" />

    <div class="min-w-0">
      <header class="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl lg:top-4 lg:rounded-2xl lg:border lg:bg-card/90 lg:px-5">
        <div class="mx-auto flex max-w-[1280px] items-center gap-3">
          <button type="button" class="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card lg:hidden" :aria-label="copy.openMenu" @click="mobileOpen = true">
            <Icon name="lucide:menu" class="size-5" />
          </button>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold">{{ current?.name || 'Shop Suit' }}</p>
            <p v-if="current" class="truncate text-xs text-muted-foreground">{{ copy.shop }}</p>
          </div>

          <ThemeToggle />

          <div class="relative">
            <button type="button" class="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground" :aria-label="copy.account" @click="accountOpen = !accountOpen">
              <Icon name="lucide:circle-user-round" class="size-5" />
            </button>
            <div v-if="accountOpen" class="absolute end-0 top-12 z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <div class="border-b border-border px-3 py-2"><p class="truncate text-xs font-semibold">{{ user?.email }}</p></div>
              <button type="button" class="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--bs-error)] transition hover:bg-muted" @click="logout">
                <Icon name="lucide:log-out" class="size-4" />
                {{ copy.logout }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="mx-auto w-full max-w-[1280px] px-4 py-6 pb-10 lg:px-8 lg:py-8">
        <div v-if="loadError" class="rounded-2xl border border-[var(--bs-error)]/30 bg-[var(--bs-error-bg)] p-5 text-[var(--bs-error-fg)] dark:bg-[var(--bs-error-bg-dark)] dark:text-[var(--bs-error-dark)]" role="alert">
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
      </main>
    </div>
  </div>
</template>
