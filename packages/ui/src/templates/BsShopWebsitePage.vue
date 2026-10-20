<script setup lang="ts">
import { useOverlayState } from '@building-suit/ux'
import type { BsShopWebsiteView, BsWebsiteInquiryForm } from '../types/shopWebsitePresentation'
const props=defineProps<{view:BsShopWebsiteView}>()
const inquiry=defineModel<BsWebsiteInquiryForm>('inquiry',{required:true})
const basketContact=defineModel<BsWebsiteInquiryForm>('basketContact',{default:()=>({name:'',contact:'',message:'',company:''})})
const emit=defineEmits<{submitInquiry:[];submitBasket:[];add:[id:string];quantity:[id:string,value:number];search:[value:string];kind:[value:string];sort:[value:string];page:[value:number];clearFilters:[];retryCatalog:[]}>()
const basket=useOverlayState(),details=useOverlayState(),selectedId=ref('')
const selected=computed(()=>[...props.view.items,...props.view.featured,...props.view.basket.lines].find(item=>item.id===selectedId.value))
const heroItem=computed(()=>props.view.featured.find(item=>item.image))
function showDetails(id:string){selectedId.value=id;details.show()}
function add(id:string){emit('add',id)}
function addSelected(){if(selected.value)add(selected.value.id)}
function update(key:keyof BsWebsiteInquiryForm,value:string|number){inquiry.value={...inquiry.value,[key]:String(value)}}
function updateBasket(key:keyof BsWebsiteInquiryForm,value:string|number){basketContact.value={...basketContact.value,[key]:String(value)}}
watch(()=>props.view.name,()=>{details.close();basket.close()})
watch(selected,value=>{if(!value)details.close()})
</script>
<template>
 <div class="bs-shop-website" :lang="view.locale" :dir="view.locale==='ar'?'rtl':'ltr'">
  <a class="bs-shop-website__skip" href="#website-main">{{view.copy.browse}}</a>
  <header class="bs-shop-website__header">
   <div class="bs-shop-website__header-main">
    <a href="#website-main" class="bs-shop-website__identity"><img :src="view.logo" :alt="view.name" width="44" height="44"><span>{{view.name}}</span></a>
    <div class="bs-shop-website__header-actions"><nav class="bs-shop-website__languages" :aria-label="view.copy.language"><a v-for="link in view.languageLinks" :key="link.locale" :href="link.href" :lang="link.locale" :hreflang="link.locale" :aria-current="link.locale===view.locale?'page':undefined">{{link.label}}</a></nav><BsButton variant="secondary" class="bs-shop-website__basket-button" :aria-label="`${view.copy.basket}: ${view.basket.count}`" @click="basket.show"><BsIcon name="basket" :size="19" /><span>{{view.copy.basket}}</span><b>{{view.basket.count}}</b></BsButton></div>
   </div>
   <nav class="bs-shop-website__navigation" :aria-label="view.copy.navigation">
    <a href="#catalog" @click="emit('kind','all')">{{view.copy.browse}}</a><a href="#catalog" @click="emit('kind','product')">{{view.copy.products}}</a><a href="#catalog" @click="emit('kind','service')">{{view.copy.services}}</a><a v-if="view.bookingLink" :href="view.bookingLink.href">{{view.bookingLink.label}}</a><a href="#visit">{{view.copy.visit}}</a><a :href="view.portalLink.href" class="bs-shop-website__account"><BsIcon name="user" :size="17" />{{view.portalLink.label}}</a>
   </nav>
  </header>
  <main id="website-main">
   <section class="bs-shop-website__hero" aria-labelledby="website-title">
    <div class="bs-shop-website__hero-copy"><h1 id="website-title">{{view.name}}</h1><p>{{view.description}}</p><div class="bs-shop-website__hero-actions"><a v-if="view.bookingLink" :href="view.bookingLink.href" class="bs-shop-website__primary">{{view.bookingLink.label}}<BsIcon name="arrowRight" directional :size="18" /></a><a href="#catalog" :class="view.bookingLink?'bs-shop-website__secondary':'bs-shop-website__primary'">{{view.copy.browse}}<BsIcon v-if="!view.bookingLink" name="arrowRight" directional :size="18" /></a></div><a href="#visit" class="bs-shop-website__hero-location"><BsIcon name="store" :size="17" />{{view.locations[0]?.name}}<span v-if="view.locations.length>1">+{{view.locations.length-1}}</span></a></div>
    <div v-if="heroItem" class="bs-shop-website__hero-visual"><BsButton variant="tile" :aria-label="`${view.copy.details}: ${heroItem.name}`" @click="showDetails(heroItem.id)"><BsCatalogImage inline-raster loading="eager" :src="heroItem.image" :name="heroItem.name" :placeholder="view.copy.imagePlaceholder" /><span class="bs-shop-website__hero-caption"><span><small>{{heroItem.kindLabel}}</small><strong>{{heroItem.name}}</strong></span><b>{{heroItem.price}}</b><BsIcon name="arrowRight" directional /></span></BsButton></div>
    <aside v-else class="bs-shop-website__hero-selection" :aria-label="view.copy.catalog"><div class="bs-shop-website__selection-heading"><BsIcon name="store" :size="22" /><span>{{view.copy.catalog}}</span></div><BsButton v-for="item in view.featured" :key="item.id" variant="tile" @click="showDetails(item.id)"><span><small>{{item.kindLabel}}</small><strong>{{item.name}}</strong></span><b>{{item.price}}</b><BsIcon name="arrowRight" directional :size="18" /></BsButton><a href="#catalog">{{view.copy.browse}}</a></aside>
   </section>
   <section id="catalog" class="bs-shop-website__section" aria-labelledby="website-catalog-heading">
    <div class="bs-shop-website__section-heading"><h2 id="website-catalog-heading">{{view.copy.catalog}}</h2><span v-if="!view.discovery.loading" class="bs-shop-website__result-count">{{view.discovery.range}}</span></div>
    <div class="bs-shop-website__discovery"><BsInput :model-value="view.discovery.search" type="search" :maxlength="120" :placeholder="view.copy.search" :aria-label="view.copy.search" @update:model-value="emit('search',String($event))" /><BsSelect :model-value="view.discovery.sort" :label="view.copy.sort" :options="view.discovery.sorts" option-label="label" option-value="value" @update:model-value="emit('sort',String($event))" /></div>
    <div class="bs-shop-website__filters"><BsTabs :model-value="view.discovery.kind" :tabs="view.discovery.filters" :label="view.copy.catalog" id-prefix="website-kind" @update:model-value="emit('kind',$event)" /><BsButton v-if="view.discovery.filtered" variant="text" @click="emit('clearFilters')">{{view.copy.clear}}<BsIcon name="close" :size="15" /></BsButton></div>
    <div v-if="view.basket.feedback" class="bs-shop-website__feedback" role="status" aria-live="polite"><span>{{view.basket.feedback}}</span><BsButton variant="text" @click="basket.show">{{view.copy.basket}}<BsIcon name="basket" :size="16" /></BsButton></div>
    <div id="website-kind-panel" role="tabpanel" :aria-labelledby="`website-kind-${view.discovery.kind}`" :aria-busy="view.discovery.refreshing">
     <BsStateSurface v-if="view.discovery.loading" state="loading" :title="view.copy.loading" />
     <BsStateSurface v-else-if="view.discovery.failed" state="error" :title="view.copy.catalogError" :action-label="view.copy.retry" @action="emit('retryCatalog')" />
     <BsStateSurface v-else-if="!view.items.length" state="empty" :title="view.copy.empty" :action-label="view.discovery.filtered?view.copy.clear:undefined" @action="emit('clearFilters')" />
     <div v-else class="bs-shop-website__catalog"><BsWebsiteCatalogCard v-for="item in view.items" :key="item.id" :item="item" :copy="view.copy" :pending="view.basket.pending" @details="showDetails" @add="add" /></div>
    </div>
    <nav v-if="!view.discovery.failed&&!view.discovery.loading&&(view.previous||view.next)" class="bs-shop-website__pagination" :aria-label="view.copy.catalog"><a v-if="view.previous" :href="view.previous" @click.prevent="emit('page',view.page-1)">{{view.copy.previous}}</a><span v-else /><span>{{view.page}}</span><a v-if="view.next" :href="view.next" @click.prevent="emit('page',view.page+1)">{{view.copy.next}}</a><span v-else /></nav>
    <p class="bs-shop-website__price-help">{{view.copy.priceHelp}}</p>
   </section>
   <section v-if="view.bookingLink" class="bs-shop-website__booking-band" aria-labelledby="website-booking-heading"><div><h2 id="website-booking-heading">{{view.copy.bookingTitle}}</h2><p>{{view.copy.bookingBody}}</p></div><a class="bs-shop-website__primary" :href="view.bookingLink.href">{{view.bookingLink.label}}<BsIcon name="arrowRight" directional :size="18" /></a></section>
   <section id="visit" class="bs-shop-website__section bs-shop-website__visit" aria-labelledby="website-visit-heading">
    <div><h2 id="website-visit-heading">{{view.copy.locations}}</h2><div class="bs-shop-website__locations"><address v-for="location in view.locations" :key="location.name+location.address"><BsIcon name="store" :size="20" /><div><h3>{{location.name}}</h3><p>{{location.address}}</p><a :href="location.mapHref" target="_blank" rel="noopener noreferrer">{{view.copy.directions}}<BsIcon name="arrowRight" directional :size="15" /></a></div></address></div></div>
    <div class="bs-shop-website__visit-aside"><section v-if="view.openingHours"><h3>{{view.copy.hours}}</h3><p class="bs-shop-website__hours">{{view.openingHours}}</p></section><section><h3>{{view.copy.contact}}</h3><ul class="bs-shop-website__contacts"><li v-for="contact in view.contacts" :key="contact.kind"><a :href="contact.href" :dir="contact.kind==='whatsapp'?undefined:'ltr'" :rel="contact.kind==='whatsapp'?'noopener noreferrer':undefined"><BsIcon :name="contact.kind==='email'?'mail':'phone'" :size="17" /><span>{{contact.label}}</span></a></li></ul></section></div>
   </section>
   <section class="bs-shop-website__section bs-shop-website__inquiry" aria-labelledby="website-inquiry-heading">
    <div><h2 id="website-inquiry-heading">{{view.copy.inquiry}}</h2><p>{{view.copy.inquiryHelp}}</p><div class="bs-shop-website__portal"><BsIcon name="user" :size="23" /><h3>{{view.copy.portalTitle}}</h3><p>{{view.copy.portalBody}}</p><a :href="view.portalLink.href">{{view.portalLink.label}}<BsIcon name="arrowRight" directional :size="16" /></a></div></div>
    <div><BsAlert v-if="view.success" tone="success">{{view.success}}</BsAlert><BsForm :pending="view.pending" :error="view.error" @submit="emit('submitInquiry')"><BsField v-slot="field" :label="view.copy.name" required><BsInput :id="field.id" :model-value="inquiry.name" autocomplete="name" :maxlength="120" required @update:model-value="update('name',$event)" /></BsField><BsField v-slot="field" :label="view.copy.replyContact" required><BsInput :id="field.id" :model-value="inquiry.contact" autocomplete="email" dir="ltr" :maxlength="254" required @update:model-value="update('contact',$event)" /></BsField><BsField v-slot="field" :label="view.copy.message" required><BsTextarea :id="field.id" :model-value="inquiry.message" :maxlength="2000" :rows="4" required @update:model-value="update('message',$event)" /></BsField><div class="bs-shop-website__trap" aria-hidden="true"><label for="website-company">{{view.copy.company}}</label><input id="website-company" :value="inquiry.company" tabindex="-1" autocomplete="off" @input="update('company',($event.target as HTMLInputElement).value)"></div><BsButton type="submit" variant="primary" :pending="view.pending">{{view.copy.send}}</BsButton></BsForm></div>
   </section>
  </main>
  <footer class="bs-shop-website__footer"><a href="#website-main" class="bs-shop-website__identity"><img :src="view.logo" :alt="view.name" width="32" height="32"><span>{{view.name}}</span></a><span>{{view.copy.poweredBy}}</span><a :href="view.portalLink.href">{{view.portalLink.label}}</a></footer>
  <BsDialog v-model:visible="details.open.value" :title="selected?.name||view.copy.details" size="lg">
   <div v-if="selected" class="bs-shop-website__product-detail"><BsCatalogImage inline-raster :src="selected.image" :name="selected.name" :placeholder="view.copy.imagePlaceholder" /><div><span>{{selected.kindLabel}}</span><h2>{{selected.name}}</h2><strong>{{selected.price}}</strong><p class="bs-shop-website__item-description">{{selected.description}}</p><BsText size="xs" tone="muted">{{view.copy.priceHelp}}</BsText><div class="bs-shop-website__detail-actions"><a v-if="selected.bookingHref" class="bs-shop-website__primary" :href="selected.bookingHref">{{view.bookingLink?.label}}</a><BsButton :variant="selected.bookingHref?'secondary':'primary'" :disabled="view.basket.pending" @click="addSelected"><BsIcon name="add" :size="18" />{{view.copy.add}}</BsButton><BsButton v-if="selected.quantity" variant="text" @click="details.close();basket.show()">{{view.copy.basket}} ({{selected.quantity}})</BsButton></div><p v-if="view.basket.feedback" role="status" class="bs-shop-website__price-help">{{view.basket.feedback}}</p></div></div>
   <template #footer="{close}"><BsButton @click="close">{{view.copy.close}}</BsButton></template>
  </BsDialog>
  <BsDialog v-model:visible="basket.open.value" :title="view.copy.basket" :pending="view.basket.pending" size="lg">
   <BsAlert v-if="view.basket.success" tone="success">{{view.basket.success}}</BsAlert>
   <BsStateSurface v-if="!view.basket.lines.length&&!view.basket.success" state="empty" :title="view.copy.basketEmpty" />
   <div v-if="view.basket.lines.length" class="bs-shop-website__basket-layout">
    <div><ul class="bs-shop-website__basket-lines"><li v-for="line in view.basket.lines" :key="line.id"><BsCatalogImage inline-raster :src="line.image" :name="line.name" :placeholder="view.copy.imagePlaceholder" /><div><strong>{{line.name}}</strong><span>{{line.price}}</span><BsQuantityStepper :model-value="line.quantity" :label="`${view.copy.quantity}: ${line.name}`" :decrease-label="view.copy.decrease" :increase-label="view.copy.increase" :max="999" :disabled="view.basket.pending" @update:model-value="emit('quantity',line.id,$event)" /></div><div class="bs-shop-website__basket-line-end"><b>{{line.lineTotal}}</b><BsButton variant="icon" :disabled="view.basket.pending" :aria-label="`${view.copy.remove}: ${line.name}`" @click="emit('quantity',line.id,0)"><BsIcon name="delete" :size="18" /></BsButton></div></li></ul><p class="bs-shop-website__price-help">{{view.copy.requestLimit}}</p><div v-if="view.basket.totals.length" class="bs-shop-website__basket-totals"><span>{{view.copy.total}}</span><strong v-for="total in view.basket.totals" :key="total.currency">{{total.label}}</strong></div><p class="bs-shop-website__price-help">{{view.copy.priceHelp}}</p></div>
    <div class="bs-shop-website__basket-form"><p>{{view.copy.basketHelp}}</p><BsForm :pending="view.basket.pending" :error="view.basket.error" @submit="emit('submitBasket')"><BsField v-slot="field" :label="view.copy.name" required><BsInput :id="field.id" :model-value="basketContact.name" autocomplete="name" :maxlength="120" required @update:model-value="updateBasket('name',$event)" /></BsField><BsField v-slot="field" :label="view.copy.replyContact" required><BsInput :id="field.id" :model-value="basketContact.contact" autocomplete="email" dir="ltr" :maxlength="254" required @update:model-value="updateBasket('contact',$event)" /></BsField><BsField v-slot="field" :label="view.copy.basketNotes"><BsTextarea :id="field.id" :model-value="basketContact.message" :maxlength="400" :rows="3" @update:model-value="updateBasket('message',$event)" /></BsField><div class="bs-shop-website__trap" aria-hidden="true"><label for="basket-company">{{view.copy.company}}</label><input id="basket-company" :value="basketContact.company" tabindex="-1" autocomplete="off" @input="updateBasket('company',($event.target as HTMLInputElement).value)"></div><BsButton type="submit" block variant="primary" :pending="view.basket.pending">{{view.copy.basketSend}}</BsButton></BsForm></div>
   </div>
   <template #footer="{close}"><BsButton :disabled="view.basket.pending" @click="close">{{view.copy.close}}</BsButton></template>
  </BsDialog>
 </div>
</template>
<style scoped>
.bs-shop-website { color:var(--bs-text);background:var(--bs-bg);min-block-size:100dvh; }
:where(.bs-shop-website) a { color:inherit;text-underline-offset:.3em;overflow-wrap:anywhere; }
.bs-shop-website a:focus-visible { outline:var(--bs-focus-ring-style);outline-offset:4px; }
.bs-shop-website__skip { position:fixed;inset-block-start:var(--bs-space-3);inset-inline-start:var(--bs-space-3);z-index:101;transform:translateY(-180%);padding:var(--bs-space-3);background:var(--bs-surface); }
.bs-shop-website__skip:focus { transform:none; }
.bs-shop-website__header { position:sticky;inset-block-start:0;z-index:25;border-block-end:1px solid var(--bs-border);background:var(--bs-surface); }
.bs-shop-website__header-main,.bs-shop-website__navigation,.bs-shop-website__hero,.bs-shop-website__section,.bs-shop-website__footer { max-inline-size:88rem;margin-inline:auto;padding-inline:clamp(1rem,4vw,3rem); }
.bs-shop-website__header-main { display:flex;align-items:center;justify-content:space-between;gap:var(--bs-space-4);padding-block:var(--bs-space-4); }
.bs-shop-website__identity { display:inline-flex;gap:var(--bs-space-3);align-items:center;min-inline-size:0;font-weight:var(--bs-weight-bold);text-decoration:none; }
.bs-shop-website__identity img { object-fit:contain;flex-shrink:0;border-radius:var(--bs-radius-button); }
.bs-shop-website__identity span { overflow-wrap:anywhere; }
.bs-shop-website__header-actions { display:flex;align-items:center;gap:var(--bs-space-5);flex-shrink:0; }
.bs-shop-website__languages { display:flex;gap:var(--bs-space-3);font-size:var(--bs-type-caption-size); }
.bs-shop-website__languages a { display:inline-flex;align-items:center;min-block-size:var(--bs-tap-target-min);text-decoration:none;color:var(--bs-text-muted); }
.bs-shop-website__languages [aria-current] { color:var(--bs-text);text-decoration:underline; }
.bs-shop-website__basket-button b { display:grid;place-items:center;min-inline-size:1.5rem;block-size:1.5rem;border-radius:50%;background:var(--bs-surface-muted);font-size:var(--bs-type-caption-size); }
.bs-shop-website__navigation { display:flex;gap:clamp(1rem,3vw,2.5rem);align-items:center;overflow-x:auto;padding-block:var(--bs-space-3);font-size:var(--bs-type-body-m-size); }
.bs-shop-website__navigation>a { flex-shrink:0;display:inline-flex;gap:var(--bs-space-2);align-items:center;min-block-size:var(--bs-tap-target-min);text-decoration:none; }
.bs-shop-website__navigation>a:hover { text-decoration:underline; }
.bs-shop-website__account { margin-inline-start:auto; }
.bs-shop-website__hero { display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(2rem,6vw,6rem);align-items:center;padding-block:clamp(3rem,7vw,6rem);background:radial-gradient(ellipse at 85% 30%,color-mix(in srgb,var(--bs-primary) 9%,transparent),transparent 65%); }
.bs-shop-website__hero h1 { margin:0;font-size:clamp(2.5rem,5.5vw,5rem);font-weight:var(--bs-weight-bold);line-height:1.12;letter-spacing:-.035em;overflow-wrap:anywhere; }
.bs-shop-website[dir='rtl'] .bs-shop-website__hero h1 { letter-spacing:normal;line-height:1.35; }
.bs-shop-website__hero-copy>p { max-inline-size:53ch;margin-block:var(--bs-space-5) var(--bs-space-6);color:var(--bs-text-muted);font-size:var(--bs-type-body-l-size);line-height:1.85; }
.bs-shop-website__hero-actions { display:flex;flex-wrap:wrap;gap:var(--bs-space-3); }
.bs-shop-website__primary,.bs-shop-website__secondary { display:inline-flex;gap:var(--bs-space-3);align-items:center;justify-content:center;min-block-size:3rem;padding:var(--bs-space-3) var(--bs-space-5);border:1px solid var(--bs-primary);border-radius:var(--bs-radius-button);text-decoration:none;font-size:var(--bs-type-body-m-size);font-weight:var(--bs-weight-semibold); }
.bs-shop-website__primary { background:var(--bs-primary);color:var(--bs-text-on-primary); }
.bs-shop-website__secondary { background:var(--bs-surface);border-color:var(--bs-border); }
.bs-shop-website__hero-location { display:inline-flex;gap:var(--bs-space-2);align-items:center;margin-block-start:var(--bs-space-6);font-size:var(--bs-type-caption-size);color:var(--bs-text-muted);text-decoration:none; }
.bs-shop-website__hero-visual { border:1px solid var(--bs-border);border-radius:var(--bs-radius-card);overflow:hidden;background:var(--bs-surface); }
.bs-shop-website__hero-visual>:deep(button) { display:block;padding:0;inline-size:100%;text-align:start; }
.bs-shop-website__hero-visual :deep(.bs-catalog-image) { aspect-ratio:4/3; }
.bs-shop-website__hero-visual :deep(img) { object-fit:contain; }
.bs-shop-website__hero-caption { display:flex;align-items:center;gap:var(--bs-space-3);padding:var(--bs-space-5); }
.bs-shop-website__hero-caption>span { display:grid;flex:1;gap:var(--bs-space-2); }
.bs-shop-website__hero-caption small { color:var(--bs-text-muted); }
.bs-shop-website__hero-selection { background:var(--bs-surface);border:1px solid var(--bs-border);border-radius:var(--bs-radius-card);padding:var(--bs-space-5); }
.bs-shop-website__selection-heading { display:flex;gap:var(--bs-space-3);align-items:center;padding-block-end:var(--bs-space-5);color:var(--bs-primary);font-weight:var(--bs-weight-semibold); }
.bs-shop-website__hero-selection>:deep(button) { display:flex;align-items:center;gap:var(--bs-space-3);inline-size:100%;padding:var(--bs-space-5) 0;border-block-start:1px solid var(--bs-border);border-radius:0;text-align:start; }
.bs-shop-website__hero-selection :deep(button)>span { display:grid;gap:var(--bs-space-2);flex:1;min-inline-size:0; }
.bs-shop-website__hero-selection strong,.bs-shop-website__hero-caption strong,.bs-shop-website__basket-lines strong,.bs-shop-website__product-detail h2 { overflow-wrap:anywhere; }
.bs-shop-website__hero-selection b,.bs-shop-website__hero-caption>b { max-inline-size:45%;overflow-wrap:anywhere;text-align:end; }
.bs-shop-website__hero-selection small { color:var(--bs-text-muted);font-size:var(--bs-type-caption-size); }
.bs-shop-website__hero-selection>a { display:inline-block;margin-block-start:var(--bs-space-3);font-size:var(--bs-type-body-m-size); }
.bs-shop-website__section { padding-block:clamp(2.5rem,6vw,4rem);scroll-margin-block-start:10rem; }
.bs-shop-website h2 { margin:0;font-size:clamp(1.5rem,2.7vw,2.125rem);font-weight:var(--bs-weight-semibold);line-height:1.4; }
.bs-shop-website h3 { margin:0;font-size:var(--bs-type-h3-size);font-weight:var(--bs-weight-semibold); }
.bs-shop-website__section-heading { display:flex;justify-content:space-between;align-items:baseline;gap:var(--bs-space-4);margin-block-end:var(--bs-space-6); }
.bs-shop-website__result-count,.bs-shop-website__price-help { color:var(--bs-text-muted);font-size:var(--bs-type-caption-size);line-height:1.7; }
.bs-shop-website__discovery { display:grid;grid-template-columns:minmax(0,1fr) 15rem;gap:var(--bs-space-4); }
.bs-shop-website__filters { display:flex;align-items:center;justify-content:space-between;gap:var(--bs-space-4);margin-block:var(--bs-space-5); }
.bs-shop-website__feedback { display:flex;justify-content:space-between;align-items:center;gap:var(--bs-space-3);padding:var(--bs-space-2) var(--bs-space-3);margin-block-end:var(--bs-space-4);border-radius:var(--bs-radius-button);background:var(--bs-surface-muted);font-size:var(--bs-type-body-m-size);overflow-wrap:anywhere; }
.bs-shop-website__feedback :deep(button) { flex-shrink:0; }
.bs-shop-website__catalog { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--bs-space-5); }
.bs-shop-website__pagination { display:flex;justify-content:space-between;align-items:center;gap:var(--bs-space-5);margin-block-start:var(--bs-space-6); }
.bs-shop-website__pagination>a { display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--bs-border);border-radius:var(--bs-radius-button);padding:var(--bs-space-3) var(--bs-space-5);text-decoration:none;min-block-size:var(--bs-tap-target-min); }
.bs-shop-website__booking-band { display:flex;align-items:center;justify-content:space-between;gap:var(--bs-space-6);max-inline-size:82rem;margin-inline:auto;padding:clamp(1.5rem,4vw,3rem);background:var(--bs-surface-muted);border-block:1px solid var(--bs-border); }
.bs-shop-website__booking-band p { max-inline-size:55ch;margin-block:var(--bs-space-3) 0;line-height:1.8;color:var(--bs-text-muted); }
.bs-shop-website__booking-band>a { flex-shrink:0; }
.bs-shop-website__visit,.bs-shop-website__inquiry { display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(2rem,6vw,6rem); }
.bs-shop-website__locations { display:grid;gap:var(--bs-space-5);margin-block-start:var(--bs-space-6); }
.bs-shop-website address { display:flex;align-items:start;gap:var(--bs-space-4);font-style:normal;border-block-end:1px solid var(--bs-border);padding-block-end:var(--bs-space-5); }
.bs-shop-website address>svg { flex-shrink:0;margin-block-start:var(--bs-space-1); }
.bs-shop-website address p { color:var(--bs-text-muted);line-height:1.8;margin-block:var(--bs-space-2);overflow-wrap:anywhere; }
.bs-shop-website address a,.bs-shop-website__portal>a { display:inline-flex;align-items:center;gap:var(--bs-space-2);font-size:var(--bs-type-body-m-size); }
.bs-shop-website__visit-aside { display:grid;gap:var(--bs-space-6);align-content:start;padding:var(--bs-space-6);background:var(--bs-surface-muted);border-radius:var(--bs-radius-card); }
.bs-shop-website__hours { white-space:pre-line;unicode-bidi:plaintext;line-height:1.9;margin-block:var(--bs-space-3) 0; }
.bs-shop-website__contacts { display:grid;gap:var(--bs-space-3);padding:0;margin:var(--bs-space-4) 0 0;list-style:none; }
.bs-shop-website__contacts a { display:flex;align-items:center;gap:var(--bs-space-3);text-decoration:none;min-block-size:2rem;font-size:var(--bs-type-body-m-size); }
.bs-shop-website__contacts a:hover { text-decoration:underline; }
.bs-shop-website__contacts span { overflow-wrap:anywhere;min-inline-size:0; }
.bs-shop-website__inquiry { border-block-start:1px solid var(--bs-border); }
.bs-shop-website__inquiry>div>p,.bs-shop-website__portal>p { color:var(--bs-text-muted);line-height:1.9;max-inline-size:52ch; }
.bs-shop-website__portal { margin-block-start:var(--bs-space-6);padding-block-start:var(--bs-space-6);border-block-start:1px solid var(--bs-border);display:grid;gap:var(--bs-space-3); }
.bs-shop-website__portal>svg { color:var(--bs-primary); }
.bs-shop-website__portal>p { margin:0; }
.bs-shop-website__footer { display:flex;align-items:center;justify-content:space-between;gap:var(--bs-space-5);flex-wrap:wrap;padding-block:var(--bs-space-6);border-block-start:1px solid var(--bs-border);font-size:var(--bs-type-caption-size); }
.bs-shop-website__footer>span { color:var(--bs-text-muted); }
.bs-shop-website__trap { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%); }
.bs-shop-website__product-detail { display:grid;grid-template-columns:1fr 1fr;gap:var(--bs-space-6); }
.bs-shop-website__primary:focus-visible,.bs-shop-website__secondary:focus-visible { outline:var(--bs-focus-ring-style);outline-offset:4px; }
.bs-shop-website__product-detail h2 { font-size:var(--bs-type-h2-size);line-height:1.4;margin:0; }
.bs-shop-website__product-detail>div { min-inline-size:0;display:grid;align-content:start;gap:var(--bs-space-4); }
.bs-shop-website__product-detail>div>strong { font-size:var(--bs-type-h2-size); }
.bs-shop-website__item-description { white-space:pre-line;line-height:1.85;overflow-wrap:anywhere; }
.bs-shop-website__detail-actions { display:flex;flex-wrap:wrap;gap:var(--bs-space-3); }
.bs-shop-website__basket-layout { display:grid;grid-template-columns:minmax(0,1fr) minmax(18rem,.85fr);gap:var(--bs-space-6); }
.bs-shop-website__basket-lines { list-style:none;padding:0;margin:0; }
.bs-shop-website__basket-lines>li { display:grid;grid-template-columns:3.5rem minmax(0,1fr) auto;gap:var(--bs-space-3);padding-block:var(--bs-space-4);border-block-end:1px solid var(--bs-border); }
.bs-shop-website__basket-lines>li>div { display:grid;gap:var(--bs-space-2);min-inline-size:0; }
.bs-shop-website__basket-lines>li>div>span { color:var(--bs-text-muted);font-size:var(--bs-type-caption-size); }
.bs-shop-website__basket-lines :deep(.bs-catalog-image) { border-radius:var(--bs-radius-button); }
.bs-shop-website__basket-line-end { text-align:end;justify-items:end;align-content:start; }
.bs-shop-website__basket-line-end>b { font-size:var(--bs-type-caption-size); }
.bs-shop-website__basket-form { padding:var(--bs-space-5);background:var(--bs-surface-muted);border-radius:var(--bs-radius-card); }
.bs-shop-website__basket-form>p { margin-block:0 var(--bs-space-5);font-size:var(--bs-type-body-m-size);line-height:1.8; }
.bs-shop-website__basket-totals { display:grid;gap:var(--bs-space-3);padding-block:var(--bs-space-4); }
.bs-shop-website__basket-totals>span { font-size:var(--bs-type-body-m-size); }
.bs-shop-website__basket-totals>strong { font-size:var(--bs-type-h3-size); }
@media(min-width:85rem){.bs-shop-website__catalog{grid-template-columns:repeat(4,minmax(0,1fr));}}
@media(max-width:55rem){.bs-shop-website__hero{grid-template-columns:1fr 1fr;gap:var(--bs-space-6);}.bs-shop-website__hero h1{font-size:clamp(2.5rem,6vw,3.5rem);}.bs-shop-website__catalog{grid-template-columns:repeat(2,minmax(0,1fr));}.bs-shop-website__basket-layout{grid-template-columns:1fr;}.bs-shop-website__visit,.bs-shop-website__inquiry{gap:var(--bs-space-6);}}
@media(max-width:40rem){.bs-shop-website__header-main{gap:var(--bs-space-2);}.bs-shop-website__header-actions{gap:var(--bs-space-3);}.bs-shop-website__basket-button>span{display:none;}.bs-shop-website__languages{gap:var(--bs-space-2);}.bs-shop-website__identity{font-size:var(--bs-type-body-m-size);}.bs-shop-website__identity img{inline-size:2.25rem;block-size:2.25rem;}.bs-shop-website__hero,.bs-shop-website__visit,.bs-shop-website__inquiry,.bs-shop-website__product-detail{grid-template-columns:1fr;}.bs-shop-website__hero{padding-block:var(--bs-space-6);gap:var(--bs-space-6);}.bs-shop-website__hero-visual{max-inline-size:28rem;}.bs-shop-website__hero-selection{padding:var(--bs-space-4);}.bs-shop-website__hero-selection>:deep(button){padding-block:var(--bs-space-4);}.bs-shop-website__discovery{grid-template-columns:1fr;}.bs-shop-website__filters{align-items:start;flex-direction:column;gap:var(--bs-space-2);}.bs-shop-website__catalog{gap:var(--bs-space-3);}.bs-shop-website__booking-band{flex-direction:column;align-items:start;}.bs-shop-website__visit-aside{padding:var(--bs-space-5);}.bs-shop-website__basket-lines>li{grid-template-columns:2.5rem minmax(0,1fr);}.bs-shop-website__basket-line-end{grid-column:2;grid-template-columns:1fr auto;text-align:start;justify-items:start;align-items:center;}.bs-shop-website__basket-line-end :deep(button){justify-self:end;}.bs-shop-website__section-heading{align-items:start;flex-direction:column;gap:var(--bs-space-2);}}
@media(max-width:28rem){.bs-shop-website__catalog{grid-template-columns:1fr;}}
</style>
