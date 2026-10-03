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
  <ShopPlanCards
    :offers="offers"
    action="signup"
    :loading="isLoading"
    :error="error ? t('pricing.loadError') : null"
    :intro="t('pricing.notes.allPlansIncludeFreeTrial')"
    :empty-label="t('pricing.empty')"
    @retry="refresh"
  />
</template>
