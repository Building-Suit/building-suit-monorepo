<script setup lang="ts">
import type { MarketingPricingFeature } from '@building-suit/contracts'
defineProps<{ features?: MarketingPricingFeature[]; fallback?: string; includedLabel: string; notIncludedLabel: string }>()
</script>
<template>
  <ul v-if="features?.length" class="bs-plan-features mt-5 flex-1 space-y-2 text-sm"><li v-for="feature in features" :key="feature.key" class="flex items-start gap-2"><BsIcon :name="feature.included ? 'check' : 'close'" :size="17" :class="feature.included ? 'text-[var(--bs-status-success)]' : 'text-fg-muted'" /><span :class="{ 'text-fg-muted': !feature.included }">{{ feature.text }} <span class="sr-only">({{ feature.included ? includedLabel : notIncludedLabel }})</span></span></li></ul>
  <p v-else-if="fallback" class="mt-5 flex-1 text-sm text-fg-muted">{{ fallback }}</p>
</template>
