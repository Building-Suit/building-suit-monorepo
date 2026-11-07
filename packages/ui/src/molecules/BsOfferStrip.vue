<script setup lang="ts">
import type { BsOfferCardView } from '../types/storefrontBuilderPresentation'
defineProps<{ title: string; items: BsOfferCardView[]; selectLabel: string; disabled?: boolean }>()
defineEmits<{ select: [id: string] }>()
</script>
<template>
 <section v-if="items.length" class="bs-offer-strip" :aria-label="title">
  <h2>{{ title }}</h2>
  <div class="bs-offer-strip__list">
   <article v-for="offer in items" :key="offer.id" class="bs-offer-strip__card">
    <div class="bs-offer-strip__copy"><span class="bs-offer-strip__saving">{{ offer.saving }}</span><h3>{{ offer.name }}</h3><p v-if="offer.description">{{ offer.description }}</p><p class="bs-offer-strip__items">{{ offer.items }}</p><div class="bs-offer-strip__prices"><strong>{{ offer.price }}</strong><del>{{ offer.oldPrice }}</del></div><BsButton variant="primary" :disabled="disabled || offer.disabled" @click="$emit('select',offer.id)">{{ selectLabel }}<BsIcon name="add" :size="16" /></BsButton></div>
    <div v-if="offer.images.length" class="bs-offer-strip__images" aria-hidden="true"><img v-for="(src,i) in offer.images.slice(0,3)" :key="i" :src="src" alt="" loading="lazy"></div>
   </article>
  </div>
 </section>
</template>
<style scoped>
.bs-offer-strip{min-inline-size:0}.bs-offer-strip h2{margin:0 0 var(--bs-space-5);font-size:var(--bs-type-h2-size);font-weight:var(--bs-weight-bold)}
.bs-offer-strip__list{display:flex;gap:var(--bs-space-4);overflow-x:auto;scroll-snap-type:x proximity;padding-block-end:var(--bs-space-3)}
.bs-offer-strip__card{display:flex;isolation:isolate;position:relative;gap:var(--bs-space-4);flex:1 0 min(23rem,85%);max-inline-size:36rem;scroll-snap-align:start;min-inline-size:0;padding:var(--bs-space-5);border:1px solid var(--bs-border);border-radius:var(--bs-radius-card);background:linear-gradient(120deg,color-mix(in srgb,var(--bs-accent) 18%,var(--bs-surface)),var(--bs-surface));overflow:hidden}
.bs-offer-strip__copy{flex:1;min-inline-size:0}.bs-offer-strip h3{font-size:var(--bs-type-h3-size);margin-block:var(--bs-space-2);overflow-wrap:anywhere}.bs-offer-strip p{font-size:var(--bs-type-caption-size);line-height:1.7;overflow-wrap:anywhere}.bs-offer-strip__items{color:var(--bs-text-muted)}
.bs-offer-strip__saving{font-size:var(--bs-type-caption-size);font-weight:var(--bs-weight-bold);color:var(--bs-text)}.bs-offer-strip__prices{display:flex;align-items:baseline;flex-wrap:wrap;gap:var(--bs-space-3);margin-block:var(--bs-space-4)}.bs-offer-strip__prices strong{font-size:var(--bs-type-h3-size)}.bs-offer-strip del{color:var(--bs-text-muted);font-size:var(--bs-type-caption-size)}
.bs-offer-strip__images{display:flex;flex-direction:column;justify-content:center;flex:0 0 5rem}.bs-offer-strip__images img{inline-size:5rem;block-size:5rem;object-fit:contain;background:var(--bs-surface);border-radius:var(--bs-radius-card);border:1px solid var(--bs-border)}.bs-offer-strip__images img+img{margin-block-start:-1rem;transform:rotate(8deg)}
@media(max-width:500px){.bs-offer-strip__card{padding:var(--bs-space-4)}.bs-offer-strip__images{flex-basis:3rem}.bs-offer-strip__images img{inline-size:3rem;block-size:3rem}}
</style>
