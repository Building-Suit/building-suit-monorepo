<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'
definePageMeta({ layout: 'landing' })
const { t, locale } = useI18n()
useHead({ title: 'Shop Suit · Building Suit', meta: [{ name: 'description', content: () => t('hero.description') }] })
const content = computed<LandingContent>(() => ({
  eyebrow: t('hero.badge'), heroTitle: `${t('hero.title')} ${t('hero.subtitle')}`, heroBody: t('hero.description'),
  createWorkspace: t('auth.signupAction'), explore: locale.value === 'ar' ? 'استكشف المميزات' : 'Explore features', trialNote: t('hero.noCreditCard'),
  featuresEyebrow: 'Shop Suit', featuresTitle: t('features.title'), featuresBody: t('features.description'),
  features: ['invoicesAndServices', 'employeesManagement', 'dashboardAndReports', 'expensesTracking'].map((key, i) => ({ icon: ['invoice', 'team', 'reports', 'wallet'][i]!, title: t(`features.${key}.title`), body: t(`features.${key}.description`) })),
  workflowEyebrow: locale.value === 'ar' ? 'طريقة العمل' : 'How it works', workflowTitle: locale.value === 'ar' ? 'من الإعداد إلى المتابعة اليومية' : 'From setup to daily operations',
  workflow: locale.value === 'ar' ? [ { title: 'أنشئ حسابك', body: 'أكد بريدك الإلكتروني وأكمل بيانات متجرك.' }, { title: 'أضف منتجاتك وخدماتك', body: 'نظم الكتالوج وسجل حركة المخزون.' }, { title: 'تابع العمل', body: 'راجع المصروفات والمخزون ولوحة التحكم.' } ] : [ { title: 'Create your account', body: 'Verify your email and complete your shop details.' }, { title: 'Add products and services', body: 'Organize your catalogue and record stock movements.' }, { title: 'Track operations', body: 'Review expenses, inventory and your dashboard.' } ],
  pricingEyebrow: locale.value === 'ar' ? 'الخطط' : 'Plans', pricingTitle: t('pricing.title'), pricingBody: t('pricing.description'),
}))
</script>
<template>
  <BsLandingPage :content="content" signup-path="/auth/signup">
    <template #preview><div class="ls-card ls-hero-preview space-y-5 p-6"><p class="font-bold">Shop Suit</p><div v-for="feature in content.features" :key="feature.title" class="flex items-center gap-4 rounded-control border border-line bg-surface-muted p-4"><AppIcon :name="feature.icon" /><span class="font-semibold">{{ feature.title }}</span></div></div></template>
    <template #pricing><ShopPricing /></template>
  </BsLandingPage>
</template>
