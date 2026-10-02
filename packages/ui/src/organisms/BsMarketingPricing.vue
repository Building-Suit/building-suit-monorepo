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

    <fieldset class="mx-auto max-w-sm">
      <legend class="ls-label text-center">{{ copy.cycleLabel }}</legend>
      <div class="mx-auto mt-2 grid max-w-xs rounded-full border border-line bg-surface-muted p-1 shadow-inner" :style="{ gridTemplateColumns: `repeat(${intervalOptions.length}, minmax(0, 1fr))` }" dir="ltr">
        <label v-for="option in intervalOptions" :key="option.value" class="relative cursor-pointer">
          <input
            :checked="interval === option.value"
            class="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            type="radio"
            :name="`${testId}-billing-cycle`"
            :value="option.value"
            :aria-label="option.label"
            @change="$emit('update:interval', option.value)"
          >
          <span class="block rounded-full px-6 py-2 text-center text-sm font-semibold transition" :class="interval === option.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'">{{ option.label }}</span>
        </label>
      </div>
      <p v-if="annualSaving" class="mt-2 text-center text-xs font-semibold text-fg-muted">{{ annualSaving }}</p>
    </fieldset>

    <BsStateSurface v-if="loading && !plans.length" class="mt-6" state="loading" :title="copy.loading" />
    <BsStateSurface v-else-if="error" class="mt-6" state="error" :title="error" :action-label="copy.retry" @action="$emit('retry')" />
    <BsStateSurface v-else-if="!plans.length" class="mt-6" state="empty" :title="copy.empty" />

    <div v-else class="mt-6 grid items-stretch gap-4 md:grid-cols-2" :class="columns === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'">
      <BsCard
        v-for="plan in plans"
        :key="plan.id"
        as="article"
        class="relative flex min-w-0 flex-col text-start"
        :class="{ 'border-primary shadow-card': plan.promoted, 'ring-2 ring-primary/20': plan.selected, 'opacity-75': plan.unavailable }"
        :data-plan="plan.id"
      >
        <div class="flex h-full flex-col">
          <span v-if="plan.badge" class="absolute end-4 top-4 rounded-full px-2.5 py-1 text-xs font-bold" :class="plan.badgeTone === 'featured' ? 'bg-brand-gold text-brand-navy-deep' : plan.badgeTone === 'current' ? 'bg-[var(--bs-status-info-bg)] text-[var(--bs-status-info)]' : 'bg-surface-muted text-fg'">{{ plan.badge }}</span>
          <h3 class="pe-24 text-xl font-black">{{ plan.name }}</h3>
          <p v-if="plan.description" class="mt-2 min-h-12 text-sm text-fg-muted">{{ plan.description }}</p>

          <fieldset v-if="plan.variant" class="mt-4">
            <legend class="text-xs font-bold text-fg-muted">{{ plan.variant.legend }}</legend>
            <div class="mt-2 grid rounded-control border border-line bg-surface-muted p-1" :style="{ gridTemplateColumns: `repeat(${plan.variant.options.length}, minmax(0, 1fr))` }" dir="ltr">
              <label v-for="option in plan.variant.options" :key="option.value" class="relative cursor-pointer">
                <input
                  :checked="plan.variant.value === option.value"
                  class="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  type="radio"
                  :name="`${testId}-${plan.id}-variant`"
                  :value="option.value"
                  :aria-label="option.label"
                  @change="$emit('update:variant', plan.id, option.value)"
                >
                <span class="block rounded-control px-2 py-2 text-center text-sm font-bold transition" :class="plan.variant.value === option.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'">{{ option.label }}</span>
              </label>
            </div>
          </fieldset>

          <div v-if="plan.price" class="mt-5 min-h-24">
            <div v-if="plan.originalPrice || plan.discount" class="flex flex-wrap items-center gap-2 text-sm text-fg-muted" dir="ltr">
              <s v-if="plan.originalPrice">{{ plan.originalPrice }}</s>
              <span v-if="plan.discount" class="rounded-full bg-[var(--bs-status-success-bg)] px-2 py-0.5 text-xs font-bold text-[var(--bs-status-success)]">{{ plan.discount }}</span>
            </div>
            <p class="mt-1 text-3xl font-black" dir="ltr">{{ plan.price }}</p>
            <p v-if="plan.priceNote" class="text-xs text-fg-muted">{{ plan.priceNote }}</p>
            <p v-if="plan.priceDetail" class="mt-2 text-xs font-bold text-link">{{ plan.priceDetail }}</p>
          </div>
          <p v-else-if="plan.pricingUnavailable" class="mt-5 text-lg font-bold">{{ plan.pricingUnavailable }}</p>

          <ul v-if="plan.features?.length" class="mt-5 flex-1 space-y-2 text-sm">
            <li v-for="feature in plan.features" :key="feature.key" class="flex items-start gap-2">
              <BsIcon :name="feature.included ? 'check' : 'close'" :size="17" :class="feature.included ? 'text-[var(--bs-status-success)]' : 'text-fg-muted'" />
              <span :class="{ 'text-fg-muted': !feature.included }">{{ feature.text }} <span class="sr-only">({{ feature.included ? copy.included : copy.notIncluded }})</span></span>
            </li>
          </ul>
          <p v-else-if="plan.featureFallback" class="mt-5 flex-1 text-sm text-fg-muted">{{ plan.featureFallback }}</p>

          <div v-if="plan.notice" role="alert" class="mt-5 rounded-control border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-3 text-sm">
            <strong>{{ plan.notice.title }}</strong>
            <p v-if="plan.notice.body" class="mt-1 leading-5">{{ plan.notice.body }}</p>
            <ul v-if="plan.notice.items?.length" class="mt-2 list-disc space-y-1 ps-5"><li v-for="item in plan.notice.items" :key="item">{{ item }}</li></ul>
            <p v-if="plan.notice.footer" class="mt-3 font-semibold leading-5">{{ plan.notice.footer }}</p>
          </div>

          <NuxtLink v-if="plan.action?.to && !plan.action.disabled" :to="plan.action.to" class="ls-btn mt-6 w-full text-center" :class="plan.action.variant === 'primary' ? 'ls-btn-primary' : ''">{{ plan.action.label }}</NuxtLink>
          <BsButton v-else-if="plan.action" type="button" class="mt-6 w-full" :variant="plan.action.variant ?? 'default'" :disabled="plan.action.disabled" :pending="plan.action.pending" :aria-pressed="plan.action.pressed" @click="$emit('action', plan.id)">{{ plan.action.label }}</BsButton>
          <BsButton v-if="plan.secondaryAction" type="button" class="mt-2 w-full" :variant="plan.secondaryAction.variant ?? 'default'" :disabled="plan.secondaryAction.disabled" :pending="plan.secondaryAction.pending" @click="$emit('secondary-action', plan.id)">{{ plan.secondaryAction.label }}</BsButton>
        </div>
      </BsCard>
    </div>
  </div>
</template>
