<script setup lang="ts">
const { data: plans, isLoading, error, refresh } = usePlans()
const { t, locale } = useI18n()
</script>
<template>
  <SectionSkeleton v-if="isLoading" />
  <div v-else-if="error" role="alert" class="ls-error"><p>{{ t('pricing.loadError') }}</p><button type="button" class="ls-btn mt-3" @click="refresh()">{{ t('common.retry') }}</button></div>
  <p v-else-if="!plans?.length" class="text-fg-muted">{{ t('pricing.empty') }}</p>
  <div v-else class="grid gap-6 md:grid-cols-2">
    <article v-for="plan in plans" :key="plan.id" class="ls-card flex flex-col gap-6 p-8 text-start"><h3 class="text-xl font-bold">{{ plan.name }}</h3><p class="text-3xl font-black">{{ new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency }).format(plan.price_amount) }} <span class="text-sm font-normal">/ {{ t(`pricing.${plan.billing_interval}`) }}</span></p><p>{{ t('pricing.trial', { trialDays: plan.trial_days }) }}</p><NuxtLink v-if="!plan.is_coming_soon" :to="{ path: '/auth/signup', query: { plan: plan.slug } }" class="ls-btn ls-btn-primary">{{ t('auth.signupAction') }}</NuxtLink><p v-else class="text-fg-muted">{{ locale === 'ar' ? 'قريبًا' : 'Coming soon' }}</p></article>
  </div>
</template>
