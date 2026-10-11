<script setup lang="ts">
defineProps<{ wide?: boolean; product: { name: string; assetPrefix?: string; homeLabel: string; title: string; description: string } }>()
</script>
<template>
  <BsAuthLayout :wide="wide" :product-name="product.name" :home-label="product.homeLabel" :title="product.title" :description="product.description"><template #logo="{ tone }"><BsProductLogo :name="product.name" :asset-prefix="product.assetPrefix" :tone="tone" size="auth" /></template><slot /></BsAuthLayout>
</template>
