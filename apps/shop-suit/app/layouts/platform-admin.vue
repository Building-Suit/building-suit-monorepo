<script setup lang="ts">
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const { locale } = useI18n()
const user = useSupabaseUser()
const accountOpen = ref(false)
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value
  ? { console: 'إدارة المنصة', navigation: 'إدارة المنصة', dashboard: 'نظرة عامة', account: 'الحساب', logout: 'تسجيل الخروج', open: 'فتح القائمة', close: 'إغلاق القائمة' }
  : { console: 'Platform administration', navigation: 'Platform administration', dashboard: 'Overview', account: 'Account', logout: 'Sign out', open: 'Open menu', close: 'Close menu' })

async function logout() {
  await supabase.auth.signOut()
  await nuxtApp.runWithContext(() => navigateTo('/auth/login?operator=1'))
}
</script>

<template>
  <BsAppShell
    product-name="Shop Suit"
    home-path="/platform-admin"
    :groups="[]"
    :labels="{ close: copy.close, open: copy.open, navigation: copy.navigation, dashboard: copy.dashboard }"
  >
    <template #logo><BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" /></template>
    <template #context><p class="px-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{{ copy.console }}</p></template>
    <template #header>
      <SettingsMenu />
      <div class="relative">
        <BsButton :aria-label="copy.account" :aria-expanded="accountOpen" class="ls-btn ls-btn-sm" @click="accountOpen = !accountOpen"><AppIcon name="user" /></BsButton>
        <div v-if="accountOpen" class="ls-card absolute end-0 top-12 z-50 w-64 p-2 shadow-overlay">
          <p class="truncate px-3 py-2 text-xs">{{ user?.email }}</p>
          <BsButton class="ls-btn w-full" @click="logout">{{ copy.logout }}</BsButton>
        </div>
      </div>
    </template>
    <slot />
    <template #overlays><ToastHost /><BsConfirmHost /></template>
  </BsAppShell>
</template>
