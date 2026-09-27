<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'
definePageMeta({ layout: 'landing' })
const { t, locale } = useI18n()
useHead({ title: 'Shop Suit · Building Suit', meta: [{ name: 'description', content: () => t('hero.description') }] })
const content = computed<LandingContent>(() => ({
  eyebrow: 'Shop Suit', heroTitle: `${t('hero.title')} ${t('hero.subtitle')}`, heroBody: t('hero.description'),
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
    <template #preview>
      <div class="ls-hero-preview overflow-hidden rounded-modal border">
        <div class="flex items-center gap-2 border-b border-[var(--bs-border)] px-4 py-3 text-[.65rem] text-fg-muted">
          <span class="h-2 w-2 rounded-full bg-brand-gold" /><span class="h-2 w-2 rounded-full bg-[var(--bs-border-strong)]" /><span class="h-2 w-2 rounded-full bg-[var(--bs-border)]" />
          <span class="ms-auto font-semibold uppercase tracking-[.12em]">Shop Suit</span>
        </div>
        <div class="grid min-h-[29rem] sm:grid-cols-[10rem_1fr]">
          <div class="hidden border-e border-[var(--bs-border)] p-4 sm:block">
            <p class="text-xs font-bold text-fg">Shop Suit</p>
            <div class="mt-7 space-y-1.5">
              <div v-for="(feature, index) in content.features" :key="feature.title" class="flex items-center gap-2 rounded-control px-2 py-2 text-[.65rem]" :class="index === 0 ? 'bg-surface-muted text-fg' : 'text-fg-muted'">
                <AppIcon :name="feature.icon" :size="15" /><span class="truncate">{{ feature.title }}</span>
              </div>
            </div>
          </div>
          <div class="min-w-0 p-4 sm:p-5">
            <div class="flex items-center justify-between gap-3 border-b border-[var(--bs-border)] pb-4"><div><p class="text-[.65rem] text-fg-muted">{{ content.eyebrow }}</p><p class="mt-1 text-base font-bold">{{ content.featuresTitle }}</p></div><span class="grid h-8 w-8 place-items-center rounded-full border border-[var(--bs-border)]"><AppIcon name="user" :size="16" /></span></div>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <article v-for="(feature, index) in content.features" :key="feature.title" class="min-h-28 border-b border-[var(--bs-border)] pb-4" :class="index % 2 === 0 ? 'sm:border-e sm:pe-4' : 'sm:ps-1'">
                <AppIcon :name="feature.icon" :size="20" class="text-brand-gold" />
                <p class="mt-4 text-xs font-bold leading-5">{{ feature.title }}</p>
              </article>
            </div>
            <div class="mt-5 flex items-center gap-3 border border-[var(--bs-border)] bg-surface-muted p-3 text-xs"><span class="h-2 w-2 rounded-full bg-brand-gold" /><span class="truncate text-fg-muted">{{ content.workflow[2]?.title }}</span></div>
          </div>
        </div>
      </div>
    </template>
    <template #pricing><ShopPricing /></template>
  </BsLandingPage>
</template>
