<script setup lang="ts">
const { t } = useI18n()

const user = useSupabaseUser()





const navigation = [
  { to: '/#features', label: 'landing.navFeatures' },
  { to: '/#workflow', label: 'landing.navWorkflow' },
  { to: '/#pricing', label: 'landing.navPricing' },
  { to: '/about', label: 'marketing.about' },
  { to: '/contact', label: 'marketing.contact' },
] as const

const legalLinks = [
  { to: '/about', label: 'marketing.about' },
  { to: '/contact', label: 'marketing.contact' },
  { to: '/terms', label: 'marketing.terms' },
  { to: '/privacy', label: 'marketing.privacy' },
  { to: '/delivery-shipping', label: 'marketing.deliveryShipping' },
  { to: '/refund-cancellation', label: 'marketing.refundCancellation' },
] as const


</script>

<template>
  <BsMarketingLayout :navigation="navigation.map(item => ({ ...item, label: t(item.label) }))" :legal-links="legalLinks.map(item => ({ ...item, label: t(item.label) }))" :signed-in="!!user" :labels="{ home: t('marketing.home'), navigation: t('landing.navigation'), openApp: t('landing.openApp'), signIn: t('auth.signIn'), startTrial: t('landing.startTrial'), close: t('nav.close'), open: t('nav.open'), footer: t('landing.footer'), footerNavigation: t('marketing.footerNavigation') }">
    <template #logo><AppLogo class="my-2 h-auto w-auto max-w-36 sm:max-w-52" /></template>
    <slot />
  </BsMarketingLayout>
</template>
