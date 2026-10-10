<script setup lang="ts">
import type { MarketingPricingCopy, MarketingPricingPlan } from '@building-suit/contracts'
withDefaults(defineProps<{ plans: MarketingPricingPlan[]; copy: MarketingPricingCopy; columns?: 3 | 4; testId?: string }>(), { columns: 4, testId: 'plan-pricing' })
defineEmits<{ 'update:variant': [planId: string, value: string]; action: [planId: string]; 'secondary-action': [planId: string] }>()
</script>
<template><div class="bs-plan-grid mt-6 grid items-stretch gap-4 md:grid-cols-2" :class="columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'"><BsPlanCard v-for="plan in plans" :key="plan.id" :plan="plan" :copy="copy" :test-id="testId" @update:variant="$emit('update:variant', plan.id, $event)" @action="$emit('action', plan.id)" @secondary-action="$emit('secondary-action', plan.id)" /></div></template>
