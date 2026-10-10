<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'

import type { ShopPlanOffer } from '~/types/plans'
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

const { data: plans, isLoading, error, refresh } = usePlans()
const publicOffers = computed<ShopPlanOffer[]>(() => (plans.value ?? [])
  .filter(plan => plan.is_purchasable && !plan.is_coming_soon)
  .map(plan => ({
    catalogTermsId: plan.catalog_terms_id,
    planSlug: plan.slug,
    planName: plan.name,
    planVariant: plan.plan_variant,
    variantName: plan.variant_name,
    billingInterval: plan.billing_interval,
    currency: plan.currency,
    listPriceAmount: plan.price_amount,
    effectivePriceAmount: plan.price_amount,
    priceSource: 'catalog',
    resourceLimits: plan.resource_limits,
    blockers: [],
  })))

const publicPricing = reactive(useShopPlanPresentation({ get offers() { return publicOffers.value }, action: 'signup' }))
</script>
<template>
  <BsLandingPage :content="content" signup-path="/auth/signup">
    <template #preview>
      <BsBox>
        <BsInline>
          <BsText as="span" emphasis="semibold">Shop Suit</BsText>
        </BsInline>
        <BsGrid :columns="1">
          <BsBox padding="md">
            <BsText as="p" size="xs" emphasis="semibold">Shop Suit</BsText>
            <BsStack>
              <BsInline v-for="feature in content.features" :key="feature.title">
                <BsIcon :name="feature.icon" :size="15"/>
                <BsText as="span">{{ feature.title }}</BsText>
              </BsInline>
            </BsStack>
          </BsBox>
          <BsBox padding="md">
            <BsInline justify="between">
              <BsBox>
                <BsText as="p" tone="muted">{{ content.eyebrow }}</BsText>
                <BsText as="p" emphasis="semibold">{{ content.featuresTitle }}</BsText>
              </BsBox>
              <BsText as="span">
                <BsIcon name="user" :size="16"/>
              </BsText>
            </BsInline>
            <BsGrid :columns="2">
              <BsBox v-for="feature in content.features" :key="feature.title" as="article">
                <BsIcon :name="feature.icon" :size="20"/>
                <BsText as="p" size="xs" emphasis="semibold">{{ feature.title }}</BsText>
              </BsBox>
            </BsGrid>
            <BsInline>
              <BsText as="span" tone="muted">{{ content.workflow[2]?.title }}</BsText>
            </BsInline>
          </BsBox>
        </BsGrid>
      </BsBox>
    </template>
    <template #pricing>
      <BsMarketingPricing :interval="publicPricing.interval" :plans="publicPricing.pricingPlans" :interval-options="[{ value: 'monthly', label: publicPricing.copy.monthly }, { value: 'annual', label: publicPricing.copy.yearly }]" :copy="{ cycleLabel: publicPricing.copy.cycle, loading: publicPricing.copy.loading, empty: t('pricing.empty'), retry: publicPricing.copy.retry, included: publicPricing.copy.included, notIncluded: publicPricing.copy.notIncluded }" :annual-saving="publicPricing.annualDiscount === null ? null : publicPricing.copy.annualSaving(publicPricing.annualDiscount)" :columns="3" :intro="t('pricing.notes.allPlansIncludeFreeTrial')"  :loading="isLoading" :error="error ? t('pricing.loadError') : null" test-id="shop-plan-cards" @update:interval="value => { if (value === 'monthly' || value === 'annual') publicPricing.interval = value }" @update:variant="publicPricing.chooseVariant" @action="publicPricing.choose" @retry="refresh()"/>
    </template>
  </BsLandingPage>
</template>
