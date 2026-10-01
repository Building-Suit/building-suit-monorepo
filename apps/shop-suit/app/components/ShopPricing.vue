<script setup lang="ts">
import type { ShopPlanOffer } from '~/types/plans'

const { data: plans, isLoading, error, refresh } = usePlans()
const { t } = useI18n()
const offers = computed<ShopPlanOffer[]>(() => (plans.value ?? [])
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
</script>
<template>
  <SectionSkeleton v-if="isLoading && !offers.length" />
  <div v-else-if="error" role="alert" class="ls-error"><p>{{ t('pricing.loadError') }}</p><BsButton type="button" severity="secondary" class="mt-3" @click="refresh()">{{ t('common.retry') }}</BsButton></div>
  <p v-else-if="!offers.length" class="text-fg-muted">{{ t('pricing.empty') }}</p>
  <div v-else>
    <p class="mb-6 text-center text-sm text-muted-foreground">{{ t('pricing.notes.allPlansIncludeFreeTrial') }}</p>
    <ShopPlanCards :offers="offers" action="signup" />
  </div>
</template>
