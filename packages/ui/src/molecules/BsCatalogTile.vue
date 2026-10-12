<script setup lang="ts">
withDefaults(defineProps<{ name: string; price: string; detail: string; stock?: string; imageUrl?: string | null; imageLabel: string; disabled?: boolean }>(), { stock: '', imageUrl: null, disabled: false })
defineEmits<{ select: [] }>()
</script>
<template>
  <BsButton variant="tile" class="bs-catalog-tile" :disabled="disabled" @click="$emit('select')">
    <BsCatalogImage :src="imageUrl" :name="name" :placeholder="imageLabel" />
    <span class="bs-catalog-tile__content"><strong>{{ name }}</strong><span class="bs-catalog-tile__detail">{{ detail }}</span><span class="bs-catalog-tile__price">{{ price }}</span><span v-if="stock" class="bs-catalog-tile__detail">{{ stock }}</span></span>
  </BsButton>
</template>
<style scoped>
.bs-catalog-tile { display: flex; flex-direction: column; align-items: stretch; inline-size: 100%; min-block-size: 11rem; block-size: 100%; padding: 0; overflow: hidden; text-align: start; }
.bs-catalog-tile__content { display: grid; gap: .35rem; padding: .75rem; min-inline-size: 0; }
.bs-catalog-tile__content strong { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; min-block-size: 2.5rem; font-size: .875rem; line-height: 1.25rem; overflow-wrap: anywhere; }
.bs-catalog-tile__detail { font-size: .75rem; color: var(--bs-text-muted); overflow-wrap: anywhere; }
.bs-catalog-tile__price { font-size: .875rem; font-weight: 800; font-variant-numeric: tabular-nums; }
</style>
