<script setup lang="ts">
import { useOptionalImage } from '@building-suit/ux'
const props = defineProps<{ localPreview?: boolean; src?: string | null; name: string; placeholder: string }>()
const element = ref<HTMLImageElement | null>(null)
const { image, broken, failed } = useOptionalImage(() => props.src, () => element.value, () => props.localPreview === true)
</script>
<template>
  <div class="bs-catalog-image">
    <img v-if="image && !broken" ref="element" :src="image" :alt="name" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="failed">
    <div v-else role="img" :aria-label="placeholder" class="bs-catalog-image__placeholder"><BsIcon name="ledger" :size="28" /><span>{{ placeholder }}</span></div>
  </div>
</template>
<style scoped>
.bs-catalog-image { aspect-ratio: 4 / 3; inline-size: 100%; min-inline-size: 0; overflow: hidden; background: var(--bs-surface-muted); }
.bs-catalog-image img { inline-size: 100%; block-size: 100%; object-fit: cover; }
.bs-catalog-image__placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; block-size: 100%; color: var(--bs-text-muted); font-size: .625rem; }
</style>
