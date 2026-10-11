<script setup lang="ts">
withDefaults(defineProps<{
  src: string
  alt: string
  width?: number | string
  height?: number | string
  fit?: 'contain' | 'cover' | 'fill' | 'scale-down'
  radius?: 'none' | 'control' | 'card' | 'round'
  loading?: 'eager' | 'lazy'
  decoding?: 'sync' | 'async' | 'auto'
}>(), { width: undefined, height: undefined, fit: 'cover', radius: 'none', loading: 'lazy', decoding: 'async' })
</script>

<template>
  <img :src="src" :alt="alt" :width="width" :height="height" :loading="loading" :decoding="decoding" class="bs-image" :class="[`bs-image--fit-${fit}`, `bs-image--radius-${radius}`]">
</template>
