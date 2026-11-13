<script setup lang="ts">
import { productLogoImages, type ProductLogoVariant } from '@building-suit/brand'
const props = withDefaults(defineProps<{
  name: string
  assetPrefix?: string
  monogram?: string
  kind?: 'wordmark' | 'mark'
  tone?: 'auto' | 'light' | 'dark'
  size?: 'default' | 'navigation' | 'marketing' | 'auth'
}>(), {
  assetPrefix: undefined,
  monogram: undefined,
  kind: 'wordmark',
  tone: 'auto',
  size: 'default',
})
const failed = ref<ProductLogoVariant[]>([])
watch(() => `${props.assetPrefix}:${props.kind}`, () => { failed.value = [] })
const images = computed(() => productLogoImages(props.assetPrefix, props.kind, failed.value))
function failedImage(src: string, variant: ProductLogoVariant) {
  // A late error from a removed image must not mark a new product/kind as missing.
  if (src === `${props.assetPrefix}-${props.kind}-${variant}.svg` && !failed.value.includes(variant)) failed.value = [...failed.value, variant]
}
</script>

<template>
  <span
    class="ls-logo inline-grid shrink-0 place-items-center"
    :class="[`ls-logo-${kind}`, `ls-logo-${tone}`, `bs-product-logo--${size}`]"
    role="img"
    :aria-label="`${name} by Building Suit`"
    dir="ltr"
  >
    <img
      v-for="image in images"
      :key="`${image.tone}:${image.src}`"
      class="ls-logo-image"
      :class="`ls-logo-image-${image.tone}`"
      :src="image.src"
      alt=""
      :width="kind === 'mark' ? 1024 : 1600"
      :height="kind === 'mark' ? 1024 : 420"
      @error="failedImage(image.src, image.variant)"
    >
    <span v-if="!images.length" class="inline-flex items-center gap-3 leading-normal">
      <span class="grid size-11 place-items-center rounded-control border border-brand-gold bg-brand-navy text-xl font-black text-brand-gold">{{ monogram || name.charAt(0) }}</span>
      <span v-if="kind !== 'mark'" class="text-start"><strong class="block text-xl tracking-tight">{{ name }}</strong><span class="block text-xs opacity-60">by Building Suit</span></span>
    </span>
  </span>
</template>
<style>
.bs-product-logo--navigation { width: auto; max-width: 13rem; height: 3.5rem; }
.bs-product-logo--marketing { width: auto; max-width: 9rem; height: auto; margin-block: var(--bs-space-2); }
.bs-product-logo--auth { width: 14rem; max-width: 100%; height: auto; margin-block: var(--bs-space-4); }
@media (min-width: 640px) { .bs-product-logo--marketing { max-width: 13rem; } }
</style>
