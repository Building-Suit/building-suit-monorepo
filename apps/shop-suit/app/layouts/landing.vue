<script setup lang="ts">
const { t, locale } = useI18n()
const user = useSupabaseUser()
const ui = useUiCopy()
const copy = computed(() => locale.value === 'ar' ? { home: 'الرئيسية', features: 'المميزات', workflow: 'طريقة العمل', pricing: 'الأسعار', signIn: 'تسجيل الدخول', startTrial: 'إنشاء حساب', openApp: 'فتح النظام', footer: 'إدارة متجرك بوضوح' } : { home: 'Home', features: 'Features', workflow: 'How it works', pricing: 'Pricing', signIn: 'Sign in', startTrial: 'Create account', openApp: 'Open app', footer: 'Manage your shop with clarity' })

const navigation = computed(() => [
  { to: '/#features', label: copy.value.features },
  { to: '/#workflow', label: copy.value.workflow },
  { to: '/#pricing', label: copy.value.pricing },
  { to: '/about', label: t('marketing.about') },
  { to: '/contact', label: t('marketing.contact') },
])
const legalLinks = computed(() => [
  { to: '/about', label: t('marketing.about') },
  { to: '/contact', label: t('marketing.contact') },
  { to: '/terms', label: t('marketing.terms') },
  { to: '/privacy', label: t('marketing.privacy') },
  { to: '/delivery-shipping', label: t('marketing.deliveryShipping') },
  { to: '/refund-cancellation', label: t('marketing.refundCancellation') },
])
</script>
<template>
  <BsMarketingLayout :navigation="navigation" :legal-links="legalLinks" :signed-in="!!user" login-path="/auth/login" signup-path="/auth/signup" :labels="{ ...copy, navigation: ui('navigation'), open: ui('open'), close: ui('close'), footerNavigation: t('marketing.footerNavigation') }">
    <template #logo>
      <BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" size="marketing"/>
    </template>
    <BsSlot :render="$slots.default"/>
  </BsMarketingLayout>
</template>
