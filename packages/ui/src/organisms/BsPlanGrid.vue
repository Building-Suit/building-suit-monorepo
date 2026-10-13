<script setup lang="ts">
import type { MarketingPricingCopy, MarketingPricingPlan } from '@building-suit/contracts'
const props = withDefaults(defineProps<{ variant?: 'default' | 'shop'; plans: MarketingPricingPlan[]; copy: MarketingPricingCopy; columns?: 3 | 4; testId?: string }>(), { variant: 'default', columns: 4, testId: 'plan-pricing' })
// Visual emphasis conveys selection/current state; a center-card fallback makes no popularity claim.
const featuredId = computed(() => props.plans.find(plan => plan.selected)?.id ?? props.plans.find(plan => plan.badgeTone === 'current')?.id ?? props.plans.find(plan => plan.promoted)?.id ?? props.plans[Math.floor(props.plans.length / 2)]?.id)
defineEmits<{ 'update:variant': [planId: string, value: string]; action: [planId: string]; 'secondary-action': [planId: string] }>()
</script>
<template><div class="bs-plan-grid mt-6 grid items-stretch gap-4 md:grid-cols-2" :class="columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'"><BsPlanCard v-for="plan in plans" :key="plan.id" :plan="plan" :variant="variant" :featured="variant === 'shop' && plan.id === featuredId" :copy="copy" :test-id="testId" @update:variant="$emit('update:variant', plan.id, $event)" @action="$emit('action', plan.id)" @secondary-action="$emit('secondary-action', plan.id)" /></div></template>
