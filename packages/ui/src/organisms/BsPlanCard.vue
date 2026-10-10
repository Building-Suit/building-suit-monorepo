<script setup lang="ts">
import type { MarketingPricingCopy, MarketingPricingPlan } from '@building-suit/contracts'
defineProps<{ plan: MarketingPricingPlan; copy: MarketingPricingCopy; testId?: string }>()
defineEmits<{ 'update:variant': [value: string]; action: []; 'secondary-action': [] }>()
</script>
<template>
  <BsCard as="article" class="bs-plan-card relative flex min-w-0 flex-col text-start" :class="{ 'border-primary shadow-card': plan.promoted, 'ring-2 ring-primary/20': plan.selected, 'opacity-75': plan.unavailable }" :data-plan="plan.id">
    <div class="flex h-full flex-col">
      <span v-if="plan.badge" class="absolute end-4 top-4 rounded-full px-2.5 py-1 text-xs font-bold" :class="plan.badgeTone === 'featured' ? 'bg-brand-gold text-brand-navy-deep' : plan.badgeTone === 'current' ? 'bg-[var(--bs-status-info-bg)] text-[var(--bs-status-info)]' : 'bg-surface-muted text-fg'">{{ plan.badge }}</span>
      <h3 class="pe-24 text-xl font-black">{{ plan.name }}</h3><p v-if="plan.description" class="mt-2 min-h-12 text-sm text-fg-muted">{{ plan.description }}</p>
      <BsBillingCycleToggle v-if="plan.variant" :model-value="plan.variant.value" :label="plan.variant.legend" :options="plan.variant.options" :name="`${testId || 'plan'}-${plan.id}-variant`" @update:model-value="$emit('update:variant', $event)" />
      <div v-if="plan.price" class="mt-5 min-h-24"><div v-if="plan.originalPrice || plan.discount" class="flex flex-wrap items-center gap-2 text-sm text-fg-muted" dir="ltr"><s v-if="plan.originalPrice">{{ plan.originalPrice }}</s><span v-if="plan.discount" class="rounded-full bg-[var(--bs-status-success-bg)] px-2 py-0.5 text-xs font-bold text-[var(--bs-status-success)]">{{ plan.discount }}</span></div><p class="mt-1 text-3xl font-black" dir="ltr">{{ plan.price }}</p><p v-if="plan.priceNote" class="text-xs text-fg-muted">{{ plan.priceNote }}</p><p v-if="plan.priceDetail" class="mt-2 text-xs font-bold text-link">{{ plan.priceDetail }}</p></div>
      <p v-else-if="plan.pricingUnavailable" class="mt-5 text-lg font-bold">{{ plan.pricingUnavailable }}</p>
      <BsPlanFeatureList :features="plan.features" :fallback="plan.featureFallback" :included-label="copy.included" :not-included-label="copy.notIncluded" />
      <BsPlanStatus v-if="plan.notice" :notice="plan.notice" />
      <NuxtLink v-if="plan.action?.to && !plan.action.disabled" :to="plan.action.to" class="ls-btn mt-6 w-full text-center" :class="plan.action.variant === 'primary' ? 'ls-btn-primary' : ''">{{ plan.action.label }}</NuxtLink>
      <BsButton v-else-if="plan.action" type="button" class="mt-6 w-full" :variant="plan.action.variant ?? 'default'" :disabled="plan.action.disabled" :pending="plan.action.pending" :aria-pressed="plan.action.pressed" @click="$emit('action')">{{ plan.action.label }}</BsButton>
      <BsButton v-if="plan.secondaryAction" type="button" class="mt-2 w-full" :variant="plan.secondaryAction.variant ?? 'default'" :disabled="plan.secondaryAction.disabled" :pending="plan.secondaryAction.pending" @click="$emit('secondary-action')">{{ plan.secondaryAction.label }}</BsButton>
    </div>
  </BsCard>
</template>
