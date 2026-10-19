<script setup lang="ts">
withDefaults(defineProps<{ name: string; price: string; detail: string; stock?: string; imageUrl?: string | null; imageLabel: string; disabled?: boolean; quantity?: number; maximumQuantity?: number | null; addLabel?: string; quantityLabel?: string; decreaseLabel?: string; increaseLabel?: string; large?: boolean }>(), { stock: '', imageUrl: null, disabled: false })
defineEmits<{ select: []; quantity: [value: number] }>()
</script>
<template>
  <article v-if="large" class="bs-catalog-tile bs-catalog-tile--large">
    <BsButton variant="tile" class="bs-catalog-tile__image-action" :disabled="disabled" :aria-label="`${addLabel}: ${name}`" @click="$emit('select')"><BsCatalogImage :src="imageUrl" :name="name" :placeholder="imageLabel" /></BsButton>
    <div class="bs-catalog-tile__content"><strong>{{ name }}</strong><span class="bs-catalog-tile__metadata"><span class="bs-catalog-tile__detail">{{ detail }}</span><span v-if="stock" class="bs-catalog-tile__detail">{{ stock }}</span></span>
      <div class="bs-catalog-tile__actions"><span class="bs-catalog-tile__price">{{ price }}</span>
        <BsQuantityStepper v-if="quantity" :model-value="quantity" :max="maximumQuantity ?? 1000000" :label="`${quantityLabel}: ${name}`" :decrease-label="`${decreaseLabel}: ${name}`" :increase-label="`${increaseLabel}: ${name}`" :disabled="disabled" @update:model-value="$emit('quantity', $event)" />
        <BsButton v-else variant="secondary" :disabled="disabled" :aria-label="`${addLabel}: ${name}`" @click="$emit('select')"><BsIcon name="add" :size="18" />{{ addLabel }}</BsButton>
      </div>
    </div>
  </article>
  <BsButton v-else variant="tile" class="bs-catalog-tile" :disabled="disabled" @click="$emit('select')">
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
.bs-catalog-tile--large { display: grid; grid-template-rows: auto 1fr; padding: 0; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); }
.bs-catalog-tile__image-action { display: block; aspect-ratio: 4 / 3; min-block-size: 0; inline-size: 100%; padding: 0; border: 0; border-radius: 0; background: var(--bs-surface-muted); }
.bs-catalog-tile__image-action :deep(.bs-catalog-image) { aspect-ratio: 4 / 3; block-size: 100%; }
.bs-catalog-tile__image-action :deep(img) { object-fit: contain; }
.bs-catalog-tile--large .bs-catalog-tile__content { grid-template-rows: 2.5rem minmax(1.125rem, 1fr) auto; align-content: stretch; padding: var(--bs-space-4); gap: var(--bs-space-3); }
.bs-catalog-tile--large .bs-catalog-tile__content strong { font-size: var(--bs-type-body-m-size); }
.bs-catalog-tile__actions { display: grid; grid-template-rows: auto var(--bs-tap-target-min); justify-items: start; align-content: end; align-items: center; gap: var(--bs-space-2); }
.bs-catalog-tile--large .bs-catalog-tile__price { font-size: var(--bs-type-body-m-size); color: var(--bs-primary); }
.bs-catalog-tile__actions :deep(.bs-quantity-stepper) { max-inline-size: 100%; }
</style>
