<script setup lang="ts">
withDefaults(defineProps<{ kind?: 'wordmark' | 'mark'; tone?: 'auto' | 'light' | 'dark' }>(), { kind: 'wordmark', tone: 'auto' })
</script>
<template><BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" :kind="kind" :tone="tone" /></template>
