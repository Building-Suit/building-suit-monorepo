<script setup lang="ts">
withDefaults(defineProps<{ name: string; price: string; detail: string; stock?: string; imageUrl?: string | null; imageLabel: string; disabled?: boolean }>(), { stock: '', imageUrl: null, disabled: false })
defineEmits<{ select: [] }>()
</script>
<template>
  <BsButton variant="tile" class="bs-catalog-tile" :disabled="disabled" @click="$emit('select')">
    <BsCatalogImage :src="imageUrl" :name="name" :placeholder="imageLabel" />
    <span class="bs-catalog-tile__content"><strong>{{ name }}</strong><span class="bs-catalog-tile__price">{{ price }}</span><span class="bs-catalog-tile__metadata"><span class="bs-catalog-tile__detail">{{ detail }}</span><span v-if="stock" class="bs-catalog-tile__detail">{{ stock }}</span></span></span>
  </BsButton>
</template>
<style scoped>
.bs-catalog-tile { display: flex; flex-direction: column; align-items: stretch; inline-size: 100%; min-block-size: var(--bs-component-point-of-sale-catalog-tile-minimum-height); block-size: 100%; padding: var(--bs-space-3); overflow: hidden; text-align: start; }
.bs-catalog-tile__content { display: grid; flex: 1; align-content: space-between; gap: var(--bs-space-2); padding: 0; min-inline-size: 0; }
.bs-catalog-tile__content strong { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; min-block-size: 2.5rem; font-size: .875rem; line-height: 1.25rem; overflow-wrap: anywhere; }
.bs-catalog-tile__detail { font-size: .75rem; color: var(--bs-text-muted); overflow-wrap: anywhere; }
.bs-catalog-tile__price { font-size: .875rem; font-weight: var(--bs-weight-bold); font-variant-numeric: tabular-nums; }
.bs-catalog-tile > :deep(.bs-catalog-image) { aspect-ratio: auto; block-size: var(--bs-space-8); border-radius: var(--bs-radius-chip); margin-block-end: var(--bs-space-3); }
.bs-catalog-tile__metadata { display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-1); }
</style>
