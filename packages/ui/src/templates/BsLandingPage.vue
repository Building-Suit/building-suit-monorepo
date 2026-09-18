<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'
withDefaults(defineProps<{ content: LandingContent; signupPath?: string }>(), { signupPath: '/signup' })
</script>
<template>
  <main>
      <section class="ls-landing-hero relative overflow-hidden border-b border-brand-gold">
        <div class="ls-hero-grid absolute inset-0 opacity-40" aria-hidden="true" />
        <div class="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div class="max-w-3xl">
            <p class="mb-6 text-xs font-bold uppercase tracking-[.22em] text-brand-gold-highlight">{{ content.eyebrow }}</p>
            <h1 class="text-4xl font-black leading-[1.08] tracking-[-.055em] sm:text-6xl">{{ content.heroTitle }}</h1>
            <p class="ls-brand-hero-muted mt-6 max-w-2xl text-lg leading-8">{{ content.heroBody }}</p>
            <div class="mt-8 flex flex-wrap gap-3">
              <NuxtLink :to="signupPath" class="ls-btn ls-btn-accent">{{ content.createWorkspace }} <AppIcon name="arrowRight" directional /></NuxtLink>
              <a href="#features" class="ls-btn ls-btn-on-brand">{{ content.explore }}</a>
            </div>
            <p class="ls-brand-hero-muted mt-4 text-xs">{{ content.trialNote }}</p>
          </div>

          <div class="relative">
            <slot name="preview" />
          </div>
        </div>
      </section>

      <section id="features" class="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div class="max-w-2xl"><p class="text-xs font-bold uppercase tracking-[.2em] text-fg-muted">{{ content.featuresEyebrow }}</p><h2 class="mt-3 text-3xl font-black tracking-[-.04em]">{{ content.featuresTitle }}</h2><p class="mt-4 text-base text-fg-muted">{{ content.featuresBody }}</p></div>
        <div class="mt-12 grid gap-px overflow-hidden rounded-modal border border-[var(--bs-border)] bg-[var(--bs-border)] md:grid-cols-2 lg:grid-cols-3">
          <article v-for="feature in content.features" :key="feature.title" class="bg-surface p-8">
            <span class="grid h-10 w-10 place-items-center rounded-control bg-brand-navy text-brand-gold"><AppIcon :name="feature.icon" :size="24" /></span>
            <h3 class="mt-6 text-lg font-bold">{{ feature.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-fg-muted">{{ feature.body }}</p>
          </article>
        </div>
      </section>

      <section id="workflow" class="border-y border-[var(--bs-border)] bg-surface-muted">
        <div class="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div class="grid gap-12 lg:grid-cols-3">
            <div><p class="text-xs font-bold uppercase tracking-[.2em] text-fg-muted">{{ content.workflowEyebrow }}</p><h2 class="mt-3 text-3xl font-black tracking-[-.04em]">{{ content.workflowTitle }}</h2></div>
            <ol class="grid gap-6 lg:col-span-2 sm:grid-cols-3">
              <li v-for="(step, index) in content.workflow" :key="step.title" class="ls-card p-6"><span class="text-xs font-black text-fg-muted">0{{ index + 1 }}</span><h3 class="mt-4 font-bold">{{ step.title }}</h3><p class="mt-2 text-sm text-fg-muted">{{ step.body }}</p></li>
            </ol>
          </div>
        </div>
      </section>

      <section id="pricing" class="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8">
        <p class="text-xs font-bold uppercase tracking-[.2em] text-fg-muted">{{ content.pricingEyebrow }}</p>
        <h2 class="mt-3 text-3xl font-black tracking-[-.04em]">{{ content.pricingTitle }}</h2>
        <p class="mx-auto mt-4 max-w-2xl text-fg-muted">{{ content.pricingBody }}</p>
        <div class="mt-8"><slot name="pricing" /></div>
      </section>
  </main>
</template>
