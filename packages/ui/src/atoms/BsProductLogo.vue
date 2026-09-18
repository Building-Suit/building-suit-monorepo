<script setup lang="ts">
withDefaults(defineProps<{
  name: string
  assetPrefix?: string
  monogram?: string
  kind?: 'wordmark' | 'mark'
  tone?: 'auto' | 'light' | 'dark'
}>(), {
  assetPrefix: undefined,
  monogram: undefined,
  kind: 'wordmark',
  tone: 'auto',
})
</script>

<template>
  <span
    class="ls-logo inline-grid shrink-0 place-items-center"
    :class="[`ls-logo-${kind}`, `ls-logo-${tone}`]"
    role="img"
    :aria-label="`${name} by Building Suit`"
    dir="ltr"
  >
    <img
      v-if="assetPrefix"
      class="ls-logo-image ls-logo-image-light"
      :src="`${assetPrefix}-${kind}-light.svg`"
      alt=""
      :width="kind === 'mark' ? 1024 : 1600"
      :height="kind === 'mark' ? 1024 : 420"
    >
    <img
      v-if="assetPrefix"
      class="ls-logo-image ls-logo-image-dark"
      :src="`${assetPrefix}-${kind}-dark.svg`"
      alt=""
      loading="lazy"
      :width="kind === 'mark' ? 1024 : 1600"
      :height="kind === 'mark' ? 1024 : 420"
    >
    <span v-if="!assetPrefix" class="inline-flex items-center gap-3 leading-normal">
      <span class="grid size-11 place-items-center rounded-control border border-brand-gold bg-brand-navy text-xl font-black text-brand-gold">{{ monogram || name.charAt(0) }}</span>
      <span class="text-start"><strong class="block text-xl tracking-tight">{{ name }}</strong><span class="block text-xs opacity-60">by Building Suit</span></span>
    </span>
  </span>
</template>
