<script setup lang="ts">
const { data: plans, isLoading, error, refresh } = usePlans()
const { t, locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')

function money(value: number, currency: string) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}
</script>
<template>
  <SectionSkeleton v-if="isLoading" />
  <div v-else-if="error" role="alert" class="ls-error"><p>{{ t('pricing.loadError') }}</p><BsButton type="button" severity="secondary" class="mt-3" @click="refresh()">{{ t('common.retry') }}</BsButton></div>
  <p v-else-if="!plans?.length" class="text-fg-muted">{{ t('pricing.empty') }}</p>
  <div v-else>
    <p class="mb-6 text-center text-sm text-muted-foreground">{{ t('pricing.notes.allPlansIncludeFreeTrial') }}</p>
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="plan in plans" :key="plan.id" class="ls-card flex flex-col gap-5 p-6 text-start">
        <div><p class="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bs-link)]">{{ isArabic ? 'متاحة للاشتراك' : 'Available to buy' }}</p><h3 class="mt-2 text-xl font-extrabold">{{ plan.name }}</h3></div>
        <p class="text-3xl font-black">{{ money(plan.price_amount, plan.currency) }} <span class="text-sm font-normal text-muted-foreground">/ {{ t(`pricing.${plan.billing_interval}`) }}</span></p>
        <PlanResourceLimits :limits="plan.resource_limits" />
        <NuxtLink v-if="plan.is_purchasable && !plan.is_coming_soon" to="/auth/signup" class="ls-btn ls-btn-primary mt-auto">{{ t('auth.signupAction') }}</NuxtLink>
        <p v-else class="mt-auto text-sm font-bold text-muted-foreground">{{ isArabic ? 'غير متاحة للشراء حاليًا' : 'Not currently available to buy' }}</p>
      </article>
    </div>
  </div>
</template>
