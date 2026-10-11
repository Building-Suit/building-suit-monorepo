<script setup lang="ts">
import type { MarketingPricingOption } from '@building-suit/contracts'
const model = defineModel<string>({ required: true })
defineProps<{ label: string; options: MarketingPricingOption[]; saving?: string | null; name?: string }>()
</script>
<template>
  <fieldset class="bs-billing-cycle mx-auto max-w-sm">
    <legend class="ls-label text-center">{{ label }}</legend>
    <div class="mx-auto mt-2 grid max-w-xs rounded-full border border-line bg-surface-muted p-1 shadow-inner" :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }" dir="ltr">
      <label v-for="option in options" :key="option.value" class="relative cursor-pointer"><input :checked="model === option.value" class="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="radio" :name="name || 'billing-cycle'" :value="option.value" :aria-label="option.label" @change="model = option.value"><span class="block rounded-full px-6 py-2 text-center text-sm font-semibold transition" :class="model === option.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'">{{ option.label }}</span></label>
    </div>
    <p v-if="saving" class="mt-2 text-center text-xs font-semibold text-fg-muted">{{ saving }}</p>
  </fieldset>
</template>
