<script setup lang="ts">
withDefaults(defineProps<{ id?: string; eyebrow: string; title: string; body?: string; tone?: 'default' | 'muted'; layout?: 'standard' | 'workflow' }>(), { id: undefined, body: undefined, tone: 'default', layout: 'standard' })
</script>
<template>
  <section :id="id" class="ls-landing-section scroll-mt-24" :class="{ 'border-y border-line bg-surface-muted': tone === 'muted' }">
    <div class="mx-auto max-w-[90rem] px-5 py-20 sm:px-8 lg:px-12 lg:py-28" :class="{ 'lg:grid lg:grid-cols-[.7fr_1.3fr] lg:gap-14': layout === 'workflow' }">
      <div :class="layout === 'workflow' ? 'lg:sticky lg:top-32 lg:self-start' : 'grid gap-8 border-b border-line pb-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end'">
        <div><p class="ls-landing-kicker">{{ eyebrow }}</p><h2 class="mt-4 max-w-[16ch] text-3xl font-extrabold tracking-[-.04em] sm:text-5xl">{{ title }}</h2></div>
        <p v-if="body" class="max-w-2xl text-base leading-8 text-fg-muted lg:justify-self-end">{{ body }}</p>
      </div>
      <div :class="layout === 'workflow' ? '' : 'mt-12'" data-landing-reveal><slot /></div>
    </div>
  </section>
</template>
