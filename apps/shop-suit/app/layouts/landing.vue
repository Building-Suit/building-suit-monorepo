<script setup lang="ts">
const { locale } = useI18n()
const user = useSupabaseUser()
const ui = useUiCopy()
const copy = computed(() => locale.value === 'ar' ? { home: 'الرئيسية', features: 'المميزات', workflow: 'طريقة العمل', pricing: 'الأسعار', signIn: 'تسجيل الدخول', startTrial: 'إنشاء حساب', openApp: 'فتح النظام', footer: 'إدارة متجرك بوضوح' } : { home: 'Home', features: 'Features', workflow: 'How it works', pricing: 'Pricing', signIn: 'Sign in', startTrial: 'Create account', openApp: 'Open app', footer: 'Manage your shop with clarity' })
</script>
<template>
  <BsMarketingLayout :navigation="[{ to: '/#features', label: copy.features }, { to: '/#workflow', label: copy.workflow }, { to: '/#pricing', label: copy.pricing }]" :legal-links="[]" :signed-in="!!user" login-path="/auth/login" signup-path="/auth/signup" :labels="{ ...copy, navigation: ui('navigation'), open: ui('open'), close: ui('close'), footerNavigation: ui('navigation') }">
    <template #logo><AppLogo class="my-2" /></template><slot />
  </BsMarketingLayout>
</template>
