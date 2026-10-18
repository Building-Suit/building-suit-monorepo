<script setup lang="ts">
import type { BsLandingPricing } from '../types/landingPresentation'
import type { MarketingPricingCopy, MarketingPricingOption, MarketingPricingPlan } from '@building-suit/contracts'

withDefaults(defineProps<{
  variant?: 'default' | 'shop'
  plans: MarketingPricingPlan[]
  currencySelection?: BsLandingPricing['currencySelection']
  interval: string
  intervalOptions: MarketingPricingOption[]
  copy: MarketingPricingCopy
  annualSaving?: string | null
  intro?: string
  loading?: boolean
  error?: string | null
  columns?: 3 | 4
  testId?: string
}>(), {
  variant: 'default',
  currencySelection: undefined,
  annualSaving: null,
  intro: undefined,
  loading: false,
  error: null,
  columns: 4,
  testId: 'plan-pricing',
})

defineEmits<{
  'update:currency': [value: string]
  'update:interval': [value: string]
  'update:variant': [planId: string, value: string]
  'action': [planId: string]
  'secondary-action': [planId: string]
  'retry': []
}>()
</script>

<template>
  <div class="bs-marketing-pricing" :data-testid="testId">
    <p v-if="intro" class="mb-6 text-center text-sm text-fg-muted">{{ intro }}</p>

    <BsBillingCycleToggle v-if="currencySelection" :model-value="currencySelection.value" :label="currencySelection.label" :options="currencySelection.options" :disabled="currencySelection.pending" :name="`${testId}-currency`" @update:model-value="$emit('update:currency', $event)" />
    <BsText v-if="currencySelection?.notice" as="p" role="status" align="center" tone="muted" size="sm">{{ currencySelection.notice }}</BsText>
    <BsBillingCycleToggle :model-value="interval" :label="copy.cycleLabel" :options="intervalOptions" :saving="annualSaving" :name="`${testId}-billing-cycle`" @update:model-value="$emit('update:interval', $event)" />

    <BsStateSurface v-if="loading && !plans.length" class="mt-6" state="loading" :title="copy.loading" />
    <BsStateSurface v-else-if="error" class="mt-6" state="error" :title="error" :action-label="copy.retry" @action="$emit('retry')" />
    <BsStateSurface v-else-if="!plans.length" class="mt-6" state="empty" :title="copy.empty" />

    <BsPlanGrid v-else :variant="variant" :plans="plans" :copy="copy" :columns="columns" :test-id="testId" @update:variant="(planId, value) => $emit('update:variant', planId, value)" @action="$emit('action', $event)" @secondary-action="$emit('secondary-action', $event)" />
  </div>
</template>
