<script setup lang="ts">
import type { MarketingPricingCopy, MarketingPricingOption, MarketingPricingPlan } from '@building-suit/contracts'

withDefaults(defineProps<{
  plans: MarketingPricingPlan[]
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
  annualSaving: null,
  intro: undefined,
  loading: false,
  error: null,
  columns: 4,
  testId: 'plan-pricing',
})

defineEmits<{
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

    <BsBillingCycleToggle :model-value="interval" :label="copy.cycleLabel" :options="intervalOptions" :saving="annualSaving" :name="`${testId}-billing-cycle`" @update:model-value="$emit('update:interval', $event)" />

    <BsStateSurface v-if="loading && !plans.length" class="mt-6" state="loading" :title="copy.loading" />
    <BsStateSurface v-else-if="error" class="mt-6" state="error" :title="error" :action-label="copy.retry" @action="$emit('retry')" />
    <BsStateSurface v-else-if="!plans.length" class="mt-6" state="empty" :title="copy.empty" />

    <BsPlanGrid v-else :plans="plans" :copy="copy" :columns="columns" :test-id="testId" @update:variant="(planId, value) => $emit('update:variant', planId, value)" @action="$emit('action', $event)" @secondary-action="$emit('secondary-action', $event)" />
  </div>
</template>
