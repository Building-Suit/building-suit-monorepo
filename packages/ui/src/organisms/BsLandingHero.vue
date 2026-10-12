<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; body: string; primaryLabel: string; secondaryLabel: string; note?: string; signupPath?: string; featuresTarget?: string }>()
</script>
<template>
  <section class="ls-landing-hero relative isolate overflow-hidden border-b border-brand-gold/40">
    <div class="ls-hero-grid absolute inset-0 opacity-50" aria-hidden="true" /><div class="ls-landing-orbit" aria-hidden="true" />
    <div class="relative mx-auto grid min-h-[42rem] max-w-[90rem] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,.86fr)_minmax(32rem,1.14fr)] lg:gap-16 lg:px-12 lg:py-24 xl:gap-24">
      <div class="relative z-10 max-w-[42rem]">
        <div data-landing-intro class="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-brand-gold-highlight"><span class="h-px w-10 bg-brand-gold" aria-hidden="true" /><p>{{ eyebrow }}</p></div>
        <h1 data-landing-intro class="ls-landing-hero-title max-w-[12ch] text-[clamp(2.85rem,6vw,5.9rem)] font-extrabold leading-[.98] tracking-[-.065em]">{{ title }}</h1>
        <p data-landing-intro class="ls-brand-hero-muted mt-7 max-w-xl text-base leading-8 sm:text-lg">{{ body }}</p>
        <div data-landing-intro class="mt-9 flex flex-wrap items-center gap-3"><NuxtLink :to="signupPath || '/signup'" class="ls-btn ls-btn-accent">{{ primaryLabel }}<BsIcon name="arrowRight" directional /></NuxtLink><a :href="featuresTarget || '#features'" class="ls-btn ls-btn-on-brand">{{ secondaryLabel }}</a></div>
        <p v-if="note" data-landing-intro class="ls-brand-hero-muted mt-5 text-xs leading-5">{{ note }}</p>
      </div>
      <slot />
    </div>
  </section>
</template>
