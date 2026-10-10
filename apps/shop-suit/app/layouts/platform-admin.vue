<script setup lang="ts">
const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const { locale } = useI18n()
const user = useSupabaseUser()
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
  <BsAppShell product-name="Shop Suit" home-path="/platform-admin" :groups="[]" :labels="{ close: copy.close, open: copy.open, navigation: copy.navigation, dashboard: copy.dashboard }">
    <template #logo>
      <BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit"/>
    </template>
    <template #context>
      <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.console }}</BsText>
    </template>
    <template #header>
      <BsUserMenu :email="user?.email" :account-label="copy.account" :sign-out-label="copy.logout" @sign-out="logout"/>
    </template>
    <BsSlot :render="$slots.default" />
    <template #overlays>
      <BsToastHost/>
      <BsConfirmHost/>
    </template>
  </BsAppShell>
</template>
