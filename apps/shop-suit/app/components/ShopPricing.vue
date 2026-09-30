<script setup lang="ts">
const { data: plans, isLoading, error, refresh } = usePlans()
const { t, locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const families = computed(() => {
  const grouped = new Map<string, NonNullable<typeof plans.value>>()
  for (const offer of plans.value ?? []) {
    const family = grouped.get(offer.id) ?? []
    family.push(offer)
    grouped.set(offer.id, family)
  }
  return [...grouped.values()]
})

function money(value: number, currency: string) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

function variantName(variant: string, fallback: string) {
  if (variant === 'multi_2') return isArabic.value ? 'مالتي · فرعان' : 'Multi · 2 branches'
  if (variant === 'multi_3') return isArabic.value ? 'مالتي · 3 فروع' : 'Multi · 3 branches'
  return fallback
}
</script>
<template>
  <SectionSkeleton v-if="isLoading" />
  <div v-else-if="error" role="alert" class="ls-error"><p>{{ t('pricing.loadError') }}</p><BsButton type="button" severity="secondary" class="mt-3" @click="refresh()">{{ t('common.retry') }}</BsButton></div>
  <p v-else-if="!families.length" class="text-fg-muted">{{ t('pricing.empty') }}</p>
  <div v-else>
    <p class="mb-6 text-center text-sm text-muted-foreground">{{ t('pricing.notes.allPlansIncludeFreeTrial') }}</p>
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="family in families" :key="family[0]!.id" class="ls-card flex flex-col gap-5 p-6 text-start">
        <div><p class="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bs-link)]">{{ isArabic ? 'متاحة للاشتراك' : 'Available to buy' }}</p><h3 class="mt-2 text-xl font-extrabold">{{ family[0]!.name }}</h3></div>
        <div v-for="offer in family" :key="offer.catalog_terms_id" class="border-b border-border pb-3 last:border-0">
          <p v-if="family.some(item => item.plan_variant !== 'standard')" class="text-sm font-bold">{{ variantName(offer.plan_variant, offer.variant_name) }}</p>
          <p class="mt-1 text-xl font-black">{{ money(offer.price_amount, offer.currency) }} <span class="text-sm font-normal text-muted-foreground">/ {{ t(`pricing.${offer.billing_interval}`) }}</span></p>
        </div>
        <PlanResourceLimits :limits="family[0]!.resource_limits" />
        <NuxtLink v-if="family.some(plan => plan.is_purchasable && !plan.is_coming_soon)" to="/auth/signup" class="ls-btn ls-btn-primary mt-auto">{{ t('auth.signupAction') }}</NuxtLink>
        <p v-else class="mt-auto text-sm font-bold text-muted-foreground">{{ isArabic ? 'غير متاحة للشراء حاليًا' : 'Not currently available to buy' }}</p>
      </article>
    </div>
  </div>
</template>
