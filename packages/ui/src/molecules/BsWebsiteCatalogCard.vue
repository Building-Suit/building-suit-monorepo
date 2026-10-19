<script setup lang="ts">
import type { BsWebsiteStoreItem, BsShopWebsiteView } from '../types/shopWebsitePresentation'
defineProps<{ item:BsWebsiteStoreItem; copy:Pick<BsShopWebsiteView['copy'],'details'|'add'|'added'|'imagePlaceholder'>; pending?:boolean }>()
defineEmits<{ details:[id:string];add:[id:string] }>()
</script>
<template>
 <article class="bs-website-card">
  <BsButton variant="tile" class="bs-website-card__image" :aria-label="`${copy.details}: ${item.name}`" @click="$emit('details',item.id)"><BsCatalogImage inline-raster :src="item.image" :name="item.name" :placeholder="copy.imagePlaceholder" /><span v-if="item.quantity" class="bs-website-card__selected"><BsIcon name="check" :size="14" />{{copy.added}}</span></BsButton>
  <div class="bs-website-card__body">
   <span class="bs-website-card__kind">{{item.kindLabel}}</span>
   <h3><BsButton variant="text" @click="$emit('details',item.id)">{{item.name}}</BsButton></h3>
   <p class="bs-website-card__description">{{item.description}}</p>
   <strong class="bs-website-card__price">{{item.price}}</strong>
   <div class="bs-website-card__actions"><BsButton variant="text" @click="$emit('details',item.id)">{{copy.details}}</BsButton><a v-if="item.bookingHref" :href="item.bookingHref" class="bs-website-card__booking"><BsIcon name="calendar" :size="16" />{{item.bookingLabel}}</a><BsButton v-else variant="secondary" :disabled="pending" @click="$emit('add',item.id)"><BsIcon name="add" :size="16" />{{copy.add}}</BsButton></div>
  </div>
 </article>
</template>
<style scoped>
.bs-website-card { display:flex;flex-direction:column;min-inline-size:0;border:1px solid var(--bs-border);border-radius:var(--bs-radius-card);overflow:hidden;background:var(--bs-surface); }
.bs-website-card__image { position:relative;display:block;inline-size:100%;padding:0;border:0;border-radius:0;overflow:hidden;aspect-ratio:4/3;background:var(--bs-surface-muted); }
.bs-website-card__image :deep(.bs-catalog-image) { block-size:100%;aspect-ratio:4/3; }
.bs-website-card__image :deep(img) { object-fit:contain; }
.bs-website-card__selected { position:absolute;inset-block-start:var(--bs-space-3);inset-inline-start:var(--bs-space-3);display:flex;gap:var(--bs-space-1);align-items:center;padding:var(--bs-space-1) var(--bs-space-2);background:var(--bs-surface);border-radius:var(--bs-radius-chip);font-size:var(--bs-type-caption-size); }
.bs-website-card__body { display:flex;flex:1;flex-direction:column;gap:var(--bs-space-3);padding:var(--bs-space-5); }
.bs-website-card__kind { color:var(--bs-text-muted);font-size:var(--bs-type-caption-size); }
.bs-website-card h3 { min-block-size:3rem;margin:0;font-size:var(--bs-type-h3-size);line-height:1.4; }
.bs-website-card h3 :deep(button) { padding:0;text-align:start;justify-content:start;font:inherit;font-weight:var(--bs-weight-semibold);overflow-wrap:anywhere; }
.bs-website-card__description { display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-block-size:2.8rem;margin:0;color:var(--bs-text-muted);font-size:var(--bs-type-body-m-size);line-height:1.6; }
.bs-website-card__price { margin-block-start:auto;font-size:var(--bs-type-h3-size);font-variant-numeric:tabular-nums; }
.bs-website-card__actions { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--bs-space-2);border-block-start:1px solid var(--bs-border);padding-block-start:var(--bs-space-3); }
.bs-website-card__actions :deep(button) { font-size:var(--bs-type-caption-size); }
.bs-website-card__booking { display:inline-flex;gap:var(--bs-space-2);align-items:center;min-block-size:var(--bs-tap-target-min);padding-inline:var(--bs-space-3);background:var(--bs-primary);color:var(--bs-text-on-primary);border-radius:var(--bs-radius-button);text-decoration:none;font-size:var(--bs-type-caption-size);font-weight:var(--bs-weight-semibold); }
.bs-website-card a:focus-visible { outline:var(--bs-focus-ring-style);outline-offset:var(--bs-focus-ring-offset); }
</style>
