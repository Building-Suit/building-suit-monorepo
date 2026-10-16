<script setup lang="ts">
import type {BsShopWebsiteView,BsWebsiteInquiryForm} from '../types/shopWebsitePresentation'
defineProps<{view:BsShopWebsiteView}>()
const inquiry=defineModel<BsWebsiteInquiryForm>('inquiry',{required:true})
const emit=defineEmits<{submitInquiry:[]}>()
function update(key:keyof BsWebsiteInquiryForm,value:string|number){inquiry.value={...inquiry.value,[key]:String(value)}}
</script>
<template>
 <div class="bs-shop-website" :lang="view.locale" :dir="view.locale === 'ar' ? 'rtl' : 'ltr'">
  <header class="bs-shop-website__header">
   <a href="#main" class="bs-shop-website__identity"><img :src="view.logo" :alt="view.name" width="56" height="56"><span>{{view.name}}</span></a>
   <nav :aria-label="view.copy.language"><a v-for="link in view.languageLinks" :key="link.locale" :href="link.href" :lang="link.locale" :hreflang="link.locale" :aria-current="link.locale===view.locale?'page':undefined">{{link.label}}</a></nav>
  </header>
  <main id="main" class="bs-shop-website__main">
   <section class="bs-shop-website__intro">
    <div><h1>{{view.name}}</h1><p>{{view.description}}</p><BsInline wrap><a class="bs-shop-website__inquiry-link" href="#inquiry">{{view.copy.inquiry}}</a><a :href="view.portalLink.href">{{view.portalLink.label}}</a></BsInline></div>
    <img :src="view.logo" :alt="view.name" width="176" height="176">
   </section>
   <section id="catalog" aria-labelledby="website-catalog-heading">
    <BsHeading id="website-catalog-heading" :level="2">{{view.copy.catalog}}</BsHeading>
    <BsText v-if="!view.items.length" as="p">{{view.copy.empty}}</BsText>
    <div class="bs-shop-website__catalog">
     <article v-for="item in view.items" :key="item.id" class="bs-shop-website__item">
      <img v-if="item.image" :src="item.image" :alt="item.name" width="480" height="320" loading="lazy">
      <div><BsText size="sm" tone="muted">{{item.kind}}</BsText><BsHeading :level="3">{{item.name}}</BsHeading><BsText as="p">{{item.description}}</BsText><BsText as="p" emphasis="semibold">{{item.price}}</BsText></div>
     </article>
    </div>
    <nav v-if="view.previous || view.next" class="bs-shop-website__pagination" :aria-label="view.copy.catalog"><a v-if="view.previous" :href="view.previous">{{view.copy.previous}}</a><a v-if="view.next" :href="view.next">{{view.copy.next}}</a></nav>
   </section>
   <div class="bs-shop-website__details">
    <section aria-labelledby="website-location-heading"><BsHeading id="website-location-heading" :level="2">{{view.copy.locations}}</BsHeading><address v-for="location in view.locations" :key="location.name+location.address"><strong>{{location.name}}</strong><span>{{location.address}}</span></address><template v-if="view.openingHours"><BsHeading :level="3">{{view.copy.hours}}</BsHeading><p class="bs-shop-website__hours">{{view.openingHours}}</p></template></section>
    <section aria-labelledby="website-contact-heading"><BsHeading id="website-contact-heading" :level="2">{{view.copy.contact}}</BsHeading><ul><li v-for="contact in view.contacts" :key="contact.kind"><a :href="contact.href" :dir="contact.kind==='whatsapp'?undefined:'ltr'" :rel="contact.kind==='whatsapp'?'noopener noreferrer':undefined">{{contact.label}}</a></li></ul></section>
   </div>
   <section id="inquiry" class="bs-shop-website__inquiry" aria-labelledby="website-inquiry-heading">
    <BsHeading id="website-inquiry-heading" :level="2">{{view.copy.inquiry}}</BsHeading><BsText as="p" tone="muted">{{view.copy.inquiryHelp}}</BsText>
    <BsText v-if="view.success" role="status">{{view.success}}</BsText>
    <BsForm :pending="view.pending" :error="view.error" method="post" action="/api/website/inquiries" @submit="emit('submitInquiry')">
     <BsField v-slot="field" :label="view.copy.name" required><BsInput :id="field.id" name="name" :model-value="inquiry.name" autocomplete="name" :maxlength="120" required @update:model-value="update('name',$event)"/></BsField>
     <BsField v-slot="field" :label="view.copy.replyContact" required><BsInput :id="field.id" name="contact" dir="ltr" :model-value="inquiry.contact" autocomplete="email" :maxlength="254" required @update:model-value="update('contact',$event)"/></BsField>
     <BsField v-slot="field" :label="view.copy.message" required><BsTextarea :id="field.id" name="message" :model-value="inquiry.message" :maxlength="2000" :rows="5" required @update:model-value="update('message',$event)"/></BsField>
     <div class="bs-shop-website__trap" aria-hidden="true"><label for="website-company">{{view.copy.company}}</label><input id="website-company" name="company" :value="inquiry.company" tabindex="-1" autocomplete="off" @input="update('company',($event.target as HTMLInputElement).value)"></div>
     <BsButton type="submit" variant="primary" :pending="view.pending">{{view.copy.send}}</BsButton>
    </BsForm>
   </section>
  </main>
 </div>
</template>
<style scoped>
.bs-shop-website { color:var(--bs-text);background:var(--bs-bg);min-height:100vh; }
.bs-shop-website a { color:var(--bs-text);text-underline-offset:.25em;overflow-wrap:anywhere; }
.bs-shop-website a:focus-visible { outline:3px solid var(--bs-focus-ring,var(--bs-primary));outline-offset:4px;border-radius:var(--bs-radius-button); }
.bs-shop-website__header,.bs-shop-website__main { max-width:74rem;margin-inline:auto;padding-inline:clamp(1rem,4vw,3rem); }
.bs-shop-website__header { display:flex;justify-content:space-between;align-items:center;gap:1rem;padding-block:1.25rem;border-bottom:1px solid var(--bs-border); }
.bs-shop-website__identity { display:flex;align-items:center;gap:.75rem;font-weight:700;text-decoration:none; }
.bs-shop-website__identity img { object-fit:contain;flex-shrink:0; }
.bs-shop-website__header nav { display:flex;gap:1rem; }
.bs-shop-website__main { padding-block:clamp(2rem,6vw,5rem);display:grid;gap:clamp(2.5rem,6vw,5rem); }
.bs-shop-website__intro { display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2rem;align-items:center; }
.bs-shop-website__intro h1 { font-size:clamp(2rem,5vw,3.5rem);line-height:1.15;font-weight:700;margin:0;overflow-wrap:anywhere; }
.bs-shop-website__intro p { max-width:65ch;margin-block:1.5rem;line-height:1.8; }
.bs-shop-website__intro img { object-fit:contain;max-width:100%; }
.bs-shop-website__inquiry-link { display:inline-block;padding:.75rem 1rem;border:1px solid var(--bs-border-strong,var(--bs-border));border-radius:var(--bs-radius-button);font-weight:600; }
.bs-shop-website__catalog { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.25rem;margin-block-start:1.5rem; }
.bs-shop-website__item { min-width:0;border:1px solid var(--bs-border);border-radius:var(--bs-radius-card);overflow:hidden;background:var(--bs-surface); }
.bs-shop-website__item>img { width:100%;height:auto;aspect-ratio:3/2;object-fit:contain;background:var(--bs-surface-muted); }
.bs-shop-website__item>div { display:grid;gap:.65rem;padding:1.25rem;overflow-wrap:anywhere; }
.bs-shop-website__pagination { display:flex;justify-content:space-between;gap:1rem;margin-block-start:1.5rem; }
.bs-shop-website__details { display:grid;grid-template-columns:1fr 1fr;gap:2rem; }
.bs-shop-website address { display:grid;gap:.35rem;margin-block:1.25rem;font-style:normal;overflow-wrap:anywhere; }
.bs-shop-website ul { padding-inline-start:1.25rem;line-height:2; }
.bs-shop-website__hours { white-space:pre-line;line-height:1.8;unicode-bidi:plaintext; }
.bs-shop-website__inquiry { max-width:45rem;display:grid;gap:1rem; }
.bs-shop-website__trap { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%); }
@media(max-width:55rem){.bs-shop-website__catalog{grid-template-columns:repeat(2,minmax(0,1fr));}.bs-shop-website__intro>img{width:120px;height:120px;}}
@media(max-width:36rem){.bs-shop-website__catalog,.bs-shop-website__details{grid-template-columns:1fr;}.bs-shop-website__intro{grid-template-columns:1fr;}.bs-shop-website__intro>img{display:none;}.bs-shop-website__header{align-items:flex-start;}.bs-shop-website__identity{align-items:flex-start;}.bs-shop-website__identity img{width:40px;height:40px;}}
</style>
