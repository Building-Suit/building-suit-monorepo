<script setup lang="ts">
defineProps<{ wide?: boolean; product: { name: string; presentation?: 'default' | 'flat' | 'glass'; assetPrefix?: string; homeLabel: string; title: string; description: string } }>()
</script>
<template>
  <BsAuthLayout :presentation="product.presentation ?? 'glass'" :wide="wide" :product-name="product.name" :home-label="product.homeLabel" :title="product.title" :description="product.description">
    <template #logo="{ tone }">
      <BsProductLogo :name="product.name" :asset-prefix="product.assetPrefix" :kind="(product.presentation ?? 'glass') === 'glass' ? 'mark' : 'wordmark'" :tone="tone" size="auth" />
    </template>
    <slot />
  </BsAuthLayout>
</template>
