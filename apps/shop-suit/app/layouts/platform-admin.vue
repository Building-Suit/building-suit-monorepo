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
  await supabase.auth.signOut({ scope: 'local' })
  await nuxtApp.runWithContext(() => navigateTo('/auth/login?operator=1'))
}
</script>

<template>
  <BsWorkspaceShell product-name="Shop Suit" home-path="/platform-admin" :groups="[]" :labels="{ close: copy.close, open: copy.open, navigation: copy.navigation, dashboard: copy.dashboard }" :logo="{ kind: 'product', assetPrefix: '/brand/shop-suit' }" :context="copy.console" :account="{ email: user?.email, label: copy.account, signOut: copy.logout }" feedback @sign-out="logout"><slot /></BsWorkspaceShell>
</template>
