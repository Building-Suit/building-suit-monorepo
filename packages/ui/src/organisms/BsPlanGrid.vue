<script setup lang="ts">
import type { MarketingPricingCopy, MarketingPricingPlan } from '@building-suit/contracts'
const props = withDefaults(defineProps<{ variant?: 'default' | 'shop'; plans: MarketingPricingPlan[]; copy: MarketingPricingCopy; columns?: 3 | 4; testId?: string }>(), { variant: 'default', columns: 4, testId: 'plan-pricing' })
// Marketing emphasis is independent of the chosen or current subscription.
const featuredId = computed(() => props.plans.find(plan => plan.promoted)?.id)
defineEmits<{ 'update:variant': [planId: string, value: string]; action: [planId: string]; 'secondary-action': [planId: string] }>()
</script>
<template><div class="bs-plan-grid mt-6 grid items-stretch gap-4 md:grid-cols-2" :data-shop-pricing="variant === 'shop' || undefined" :class="columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'"><BsPlanCard v-for="plan in plans" :key="plan.id" :plan="plan" :variant="variant" :featured="variant === 'shop' && plan.id === featuredId" :copy="copy" :test-id="testId" @update:variant="$emit('update:variant', plan.id, $event)" @action="$emit('action', plan.id)" @secondary-action="$emit('secondary-action', plan.id)" /></div></template>

<style scoped>
.bs-plan-grid[data-shop-pricing] { grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--bs-component-pricing-card-width)), var(--bs-component-pricing-card-width))); justify-content: center; }
</style>
