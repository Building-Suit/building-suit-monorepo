<script setup lang="ts">
import type { MarketingPricingCopy, MarketingPricingPlan } from '@building-suit/contracts'
withDefaults(defineProps<{ variant?: 'default' | 'shop'; featured?: boolean; plan: MarketingPricingPlan; copy: MarketingPricingCopy; testId?: string }>(), { variant: 'default', featured: false, testId: undefined })
defineEmits<{ 'update:variant': [value: string]; action: []; 'secondary-action': [] }>()
</script>
<template>
  <BsCard as="article" class="bs-plan-card relative flex min-w-0 flex-col text-start" :class="{ 'border-primary shadow-card': plan.promoted, 'ring-2 ring-primary/20': plan.selected, 'opacity-75': plan.unavailable }" :data-plan="plan.id" :data-featured="variant === 'shop' && featured || undefined" :data-shop-pricing="variant === 'shop' || undefined">
    <div class="flex h-full flex-col">
      <span v-if="plan.badge" class="absolute end-4 top-4 rounded-full px-2.5 py-1 text-xs font-bold" :class="plan.badgeTone === 'featured' ? 'bg-brand-gold text-brand-navy-deep' : plan.badgeTone === 'current' ? 'bg-[var(--bs-status-info-bg)] text-[var(--bs-status-info)]' : 'bg-surface-muted text-fg'">{{ plan.badge }}</span>
      <h3 class="text-xl font-black" :class="plan.badge ? 'pe-24' : ''">{{ plan.name }}</h3><p v-if="plan.description" class="mt-2 min-h-12 text-sm text-fg-muted">{{ plan.description }}</p>
      <BsBillingCycleToggle v-if="plan.variant" :compact="variant === 'shop'" :model-value="plan.variant.value" :label="plan.variant.legend" :options="plan.variant.options" :name="`${testId || 'plan'}-${plan.id}-variant`" @update:model-value="$emit('update:variant', $event)" /><div v-else-if="variant === 'shop'" class="bs-plan-card__variant-spacer" aria-hidden="true" />
      <div v-if="plan.price" class="mt-5 min-h-24"><div v-if="plan.originalPrice || plan.discount" class="flex flex-wrap items-center gap-2 text-sm text-fg-muted" dir="ltr"><s v-if="plan.originalPrice">{{ plan.originalPrice }}</s><span v-if="plan.discount" class="rounded-full bg-[var(--bs-status-success-bg)] px-2 py-0.5 text-xs font-bold text-[var(--bs-status-success)]">{{ plan.discount }}</span></div><p class="mt-1 text-3xl font-black" dir="ltr">{{ plan.price }}</p><p v-if="plan.priceNote" class="text-xs text-fg-muted">{{ plan.priceNote }}</p><p v-if="plan.priceDetail" class="mt-2 text-xs font-bold text-link">{{ plan.priceDetail }}</p></div>
      <p v-else-if="plan.pricingUnavailable" class="mt-5 text-lg font-bold">{{ plan.pricingUnavailable }}</p>
      <template v-if="variant === 'shop'">
      <NuxtLink v-if="plan.action?.to && !plan.action.disabled" :to="plan.action.to" class="ls-btn mt-6 w-full text-center" :class="plan.action.variant === 'primary' ? 'ls-btn-primary' : ''">{{ plan.action.label }}</NuxtLink>
      <BsButton v-else-if="plan.action" type="button" class="mt-6 w-full" :variant="plan.action.variant ?? 'default'" :disabled="plan.action.disabled" :pending="plan.action.pending" :aria-pressed="plan.action.pressed" @click="$emit('action')">{{ plan.action.label }}</BsButton>
      <BsButton v-if="plan.secondaryAction" type="button" class="mt-2 w-full" :variant="plan.secondaryAction.variant ?? 'default'" :disabled="plan.secondaryAction.disabled" :pending="plan.secondaryAction.pending" @click="$emit('secondary-action')">{{ plan.secondaryAction.label }}</BsButton>
      </template>
      <BsPlanFeatureList :features="plan.features" :fallback="plan.featureFallback" :included-label="copy.included" :not-included-label="copy.notIncluded" />
      <BsPlanStatus v-if="plan.notice" :notice="plan.notice" />
      <template v-if="variant !== 'shop'">
      <NuxtLink v-if="plan.action?.to && !plan.action.disabled" :to="plan.action.to" class="ls-btn mt-6 w-full text-center" :class="plan.action.variant === 'primary' ? 'ls-btn-primary' : ''">{{ plan.action.label }}</NuxtLink>
      <BsButton v-else-if="plan.action" type="button" class="mt-6 w-full" :variant="plan.action.variant ?? 'default'" :disabled="plan.action.disabled" :pending="plan.action.pending" :aria-pressed="plan.action.pressed" @click="$emit('action')">{{ plan.action.label }}</BsButton>
      <BsButton v-if="plan.secondaryAction" type="button" class="mt-2 w-full" :variant="plan.secondaryAction.variant ?? 'default'" :disabled="plan.secondaryAction.disabled" :pending="plan.secondaryAction.pending" @click="$emit('secondary-action')">{{ plan.secondaryAction.label }}</BsButton>
      </template>
    </div>
  </BsCard>
</template>

<style scoped>
.bs-plan-card[data-shop-pricing] { padding: 1.75rem; border-radius: var(--bs-radius-modal); box-shadow: none; }
.bs-plan-card[data-featured] {
  --bs-surface: var(--bs-color-brand-building-navy); --bs-surface-muted: var(--bs-color-brand-navy-surface-raised);
  --bs-text: var(--bs-color-brand-white); --bs-text-muted: var(--bs-color-brand-cloud-gray); --bs-border: var(--bs-color-brand-steel-border);
  --bs-primary: var(--bs-color-brand-premium-gold); --bs-primary-hover: var(--bs-color-brand-highlight-gold); --bs-text-on-primary: var(--bs-color-brand-deep-structure-navy);
  --bs-primary-pressed: var(--bs-color-gold-600);
  --color-fg: var(--bs-color-brand-white); --color-fg-muted: var(--bs-color-brand-cloud-gray); --color-surface: var(--bs-color-brand-building-navy); --color-surface-muted: var(--bs-color-brand-navy-surface-raised); --color-line: var(--bs-color-brand-steel-border); --color-link: var(--bs-color-brand-highlight-gold); --color-primary: var(--bs-color-brand-premium-gold); --color-primary-foreground: var(--bs-color-brand-deep-structure-navy);
  --bs-link: var(--bs-color-brand-highlight-gold); --bs-focus-ring: var(--bs-color-brand-highlight-gold);
  border-color: var(--bs-color-brand-premium-gold); background: var(--bs-surface); color: var(--bs-text);
}
.bs-plan-card[data-shop-pricing] :deep(.bs-plan-features) { padding-block-start: 1rem; border-block-start: 1px solid var(--bs-border); }
.bs-plan-card__variant-spacer { min-block-size: 5.25rem; }
</style>
