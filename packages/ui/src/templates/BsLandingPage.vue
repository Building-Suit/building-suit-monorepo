<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'

withDefaults(defineProps<{ content: LandingContent; signupPath?: string }>(), { signupPath: '/signup' })

const landingRoot = ref<HTMLElement | null>(null)
useLandingMotion(landingRoot)
</script>

<template>
  <main ref="landingRoot" class="bs-landing">
    <section class="ls-landing-hero relative isolate overflow-hidden border-b border-brand-gold/40">
      <div class="ls-hero-grid absolute inset-0 opacity-50" aria-hidden="true" />
      <div class="ls-landing-orbit" aria-hidden="true" />

      <div class="relative mx-auto grid min-h-[42rem] max-w-[90rem] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,.86fr)_minmax(32rem,1.14fr)] lg:gap-16 lg:px-12 lg:py-24 xl:gap-24">
        <div class="relative z-10 max-w-[42rem]">
          <div data-landing-intro class="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-brand-gold-highlight">
            <span class="h-px w-10 bg-brand-gold" aria-hidden="true" />
            <p>{{ content.eyebrow }}</p>
          </div>
          <h1 data-landing-intro class="ls-landing-hero-title max-w-[12ch] text-[clamp(2.85rem,6vw,5.9rem)] font-extrabold leading-[.98] tracking-[-.065em]">
            {{ content.heroTitle }}
          </h1>
          <p data-landing-intro class="ls-brand-hero-muted mt-7 max-w-xl text-base leading-8 sm:text-lg">
            {{ content.heroBody }}
          </p>
          <div data-landing-intro class="mt-9 flex flex-wrap items-center gap-3">
            <NuxtLink :to="signupPath" class="ls-btn ls-btn-accent">
              {{ content.createWorkspace }}
              <AppIcon name="arrowRight" directional />
            </NuxtLink>
            <a href="#features" class="ls-btn ls-btn-on-brand">{{ content.explore }}</a>
          </div>
          <p data-landing-intro class="ls-brand-hero-muted mt-5 text-xs leading-5">{{ content.trialNote }}</p>
        </div>

        <div class="ls-landing-preview-stage relative min-w-0" data-landing-preview>
          <div class="ls-landing-preview-rule" aria-hidden="true"><span>Building Suit</span></div>
          <div class="ls-landing-preview-shell">
            <slot name="preview" />
          </div>
          <div class="ls-landing-preview-index" aria-hidden="true">01 / PRODUCT</div>
        </div>
      </div>
    </section>

    <section id="features" class="ls-landing-section scroll-mt-24">
      <div class="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div class="grid gap-8 border-b border-line pb-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div>
            <p class="ls-landing-kicker">{{ content.featuresEyebrow }}</p>
            <h2 class="mt-4 max-w-[16ch] text-3xl font-extrabold tracking-[-.04em] sm:text-5xl">{{ content.featuresTitle }}</h2>
          </div>
          <p class="max-w-2xl text-base leading-8 text-fg-muted lg:justify-self-end">{{ content.featuresBody }}</p>
        </div>

        <div class="ls-feature-grid mt-12" data-landing-reveal>
          <article v-for="(feature, index) in content.features" :key="feature.title" class="ls-feature-item">
            <div class="flex items-start justify-between gap-6">
              <span class="ls-feature-icon"><AppIcon :name="feature.icon" :size="24" /></span>
              <span class="ls-feature-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            </div>
            <h3 class="mt-8 text-xl font-bold tracking-[-.02em]">{{ feature.title }}</h3>
            <p class="mt-3 max-w-md text-sm leading-7 text-fg-muted">{{ feature.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <section id="workflow" class="ls-landing-section border-y border-line bg-surface-muted scroll-mt-24" data-landing-workflow>
      <div class="mx-auto grid max-w-[90rem] gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-12 lg:py-28">
        <div class="lg:sticky lg:top-32 lg:self-start">
          <p class="ls-landing-kicker">{{ content.workflowEyebrow }}</p>
          <h2 class="mt-4 max-w-[15ch] text-3xl font-extrabold tracking-[-.04em] sm:text-5xl">{{ content.workflowTitle }}</h2>
        </div>

        <ol class="ls-workflow-list relative" data-landing-reveal>
          <span class="ls-workflow-track" aria-hidden="true"><span data-landing-progress /></span>
          <li v-for="(step, index) in content.workflow" :key="step.title" class="ls-workflow-step">
            <span class="ls-workflow-marker" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h3 class="text-xl font-bold tracking-[-.02em]">{{ step.title }}</h3>
              <p class="mt-3 max-w-xl text-sm leading-7 text-fg-muted">{{ step.body }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <section id="pricing" class="ls-landing-section scroll-mt-24">
      <div class="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div class="grid gap-8 border-b border-line pb-10 text-start lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div>
            <p class="ls-landing-kicker">{{ content.pricingEyebrow }}</p>
            <h2 class="mt-4 max-w-[16ch] text-3xl font-extrabold tracking-[-.04em] sm:text-5xl">{{ content.pricingTitle }}</h2>
          </div>
          <p class="max-w-2xl text-base leading-8 text-fg-muted lg:justify-self-end">{{ content.pricingBody }}</p>
        </div>
        <div class="mt-12" data-landing-reveal><slot name="pricing" /></div>
      </div>
    </section>
  </main>
</template>
