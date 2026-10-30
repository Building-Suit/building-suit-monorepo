<script setup lang="ts">
import type { BsStorefrontLayoutForm, BsStorefrontBuilderView, BsStorefrontBuilderCopy } from '../types/storefrontBuilderPresentation'
defineProps<{ view: BsStorefrontBuilderView; copy: BsStorefrontBuilderCopy }>()
const form = defineModel<BsStorefrontLayoutForm>('form',{required:true})
const editor = defineModel<boolean>('editor',{default:false})
const emit = defineEmits<{ edit: []; save: []; publish: []; retry: []; image: [target:'banner'|'gallery'|'staff',index:number,file:File|File[]|null] }>()
function banner(key:'alt'|'title'|'subtitle',value:string|number){if(form.value.banner)form.value={...form.value,banner:{...form.value.banner,[key]:String(value)}}}
function gallery(index:number,key:'caption',value:string|number){form.value={...form.value,gallery:form.value.gallery.map((item,i)=>i===index?{...item,[key]:String(value)}:item)}}
function staff(index:number,key:'name'|'role'|'bio',value:string|number){form.value={...form.value,staff:form.value.staff.map((item,i)=>i===index?{...item,[key]:String(value)}:item)}}
function move(kind:'gallery'|'staff',index:number,direction:number){const items=[...form.value[kind]];const next=index+direction;if(next<0||next>=items.length)return;[items[index],items[next]]=[items[next]!,items[index]!];form.value={...form.value,[kind]:items}}
function remove(kind:'gallery'|'staff',index:number){form.value={...form.value,[kind]:form.value[kind].filter((_,i)=>i!==index)}}
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.help"><template #actions><BsButton v-if="view.eligible&&!view.loading&&!view.failed" variant="primary" :disabled="view.pending" @click="emit('edit')">{{copy.edit}}</BsButton></template></BsPageHeader>
  <BsStateSurface v-if="!view.available" state="empty" :title="copy.noShop" />
  <BsStateSurface v-else-if="view.loading" state="loading" :title="copy.loading" />
  <BsStateSurface v-else-if="view.failed" state="error" :title="copy.failed" :action-label="copy.retry" @action="emit('retry')" />
  <BsStack v-else-if="!view.eligible" gap="md"><BsHeading :level="2">{{copy.teamMulti}}</BsHeading><BsText>{{copy.upgradeHelp}}</BsText><BsLink to="/billing">{{copy.billing}}</BsLink></BsStack>
  <template v-else>
   <BsAlert v-if="view.success" tone="success">{{view.success}}</BsAlert><BsAlert v-if="view.error&&!editor" tone="error">{{view.error}}</BsAlert>
   <BsInline><BsStatusBadge :status="view.published?'published':'draft'" :label="view.published?copy.published:copy.draft" /><BsLink to="/settings/website-profile">{{copy.profile}}</BsLink><BsLink to="/settings/website-catalog">{{copy.catalog}}</BsLink><BsLink to="/offers">{{copy.offers}}</BsLink></BsInline>
   <BsText v-if="!view.websitePublished" tone="muted">{{copy.publishProfile}}</BsText>
   <BsText as="p" tone="muted">{{copy.previewHelp}}</BsText>
   <section class="bs-builder-preview" :aria-label="copy.preview">
    <div v-if="form.banner" class="bs-builder-preview__banner"><img :src="form.banner.image" :alt="form.banner.alt"><div><h2>{{form.banner.title}}</h2><p>{{form.banner.subtitle}}</p></div></div>
    <div v-else class="bs-builder-preview__no-banner"><BsIcon name="search" /><span>{{copy.noBanner}}</span></div>
    <div class="bs-builder-preview__search"><BsIcon name="search" /><span>{{copy.search}}</span><BsIcon name="arrowRight" directional /></div>
    <div class="bs-builder-preview__sections"><BsText v-if="form.showOffers">{{copy.offers}}</BsText><BsText>{{copy.catalog}}</BsText></div>
    <div v-if="form.showGallery&&form.gallery.length" class="bs-builder-preview__gallery"><figure v-for="(item,i) in form.gallery" :key="i"><img :src="item.image" :alt="item.caption"><figcaption>{{item.caption}}</figcaption></figure></div>
    <div v-if="form.showStaff&&form.staff.length" class="bs-builder-preview__staff"><article v-for="(item,i) in form.staff" :key="i"><img v-if="item.image" :src="item.image" :alt="item.name"><BsIcon v-else name="user" :size="32" /><h3>{{item.name}}</h3><p>{{item.role}}</p><p>{{item.bio}}</p></article></div>
   </section>
   <BsInline><BsButton v-if="view.owner" variant="primary" :disabled="view.pending||!view.websitePublished" @click="emit('publish')">{{copy.publish}}</BsButton><BsText tone="muted" size="sm">{{copy.publishHelp}}</BsText></BsInline>
  </template>
  <BsRecordActionDialog v-model:visible="editor" :title="copy.edit" size="lg" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-label="copy.save" :cancel-label="copy.cancel" pinned-actions @submit="emit('save')">
   <BsHeading :level="2">{{copy.banner}}</BsHeading><BsText tone="muted" size="sm">{{copy.imageHelp}}</BsText>
   <BsFileInput accept="image/png,image/jpeg,image/webp" :label="copy.uploadBanner" reset-after-select @select="emit('image','banner',0,$event)" />
   <template v-if="form.banner"><BsImage :src="form.banner.image" :alt="form.banner.alt" :height="160" fit="cover" /><BsButton @click="form={...form,banner:null}">{{copy.remove}}</BsButton>
    <BsField v-slot="field" :label="copy.bannerTitle"><BsInput :id="field.id" :model-value="form.banner.title" :maxlength="320" @update:model-value="banner('title',$event)" /></BsField>
    <BsField v-slot="field" :label="copy.bannerSubtitle"><BsTextarea :id="field.id" :model-value="form.banner.subtitle" :maxlength="320" @update:model-value="banner('subtitle',$event)" /></BsField>
    <BsField v-slot="field" :label="copy.alt"><BsInput :id="field.id" :model-value="form.banner.alt" :maxlength="320" @update:model-value="banner('alt',$event)" /></BsField>
   </template>
   <BsDivider /><BsHeading :level="2">{{copy.sections}}</BsHeading><BsCheckbox v-model="form.showOffers" :label="copy.showOffers" /><BsCheckbox v-model="form.showGallery" :label="copy.showGallery" /><BsCheckbox v-model="form.showStaff" :label="copy.showStaff" />
   <BsDivider /><BsHeading :level="2">{{copy.gallery}}</BsHeading>
   <BsStack v-for="(item,i) in form.gallery" :key="i" gap="sm"><BsImage :src="item.image" :alt="item.caption" :height="120" fit="contain" /><BsField v-slot="field" :label="copy.caption"><BsInput :id="field.id" :model-value="item.caption" :maxlength="160" @update:model-value="gallery(i,'caption',$event)" /></BsField><BsInline><BsButton :disabled="i===0" @click="move('gallery',i,-1)">{{copy.up}}</BsButton><BsButton :disabled="i===form.gallery.length-1" @click="move('gallery',i,1)">{{copy.down}}</BsButton><BsButton variant="danger" @click="remove('gallery',i)">{{copy.remove}}</BsButton></BsInline></BsStack>
   <BsFileInput v-if="form.gallery.length<8" accept="image/png,image/jpeg,image/webp" :label="copy.addImage" reset-after-select @select="emit('image','gallery',form.gallery.length,$event)" />
   <BsDivider /><BsHeading :level="2">{{copy.staff}}</BsHeading><BsText tone="muted" size="sm">{{copy.staffHelp}}</BsText>
   <BsStack v-for="(item,i) in form.staff" :key="i" gap="sm"><BsImage v-if="item.image" :src="item.image" :alt="item.name" :height="96" :width="96" fit="cover" /><BsFileInput accept="image/png,image/jpeg,image/webp" :label="copy.portrait" reset-after-select @select="emit('image','staff',i,$event)" /><BsButton v-if="item.image" @click="form={...form,staff:form.staff.map((s,n)=>n===i?{...s,image:null}:s)}">{{copy.removeImage}}</BsButton>
    <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" :model-value="item.name" :maxlength="120" required @update:model-value="staff(i,'name',$event)" /></BsField><BsField v-slot="field" :label="copy.role"><BsInput :id="field.id" :model-value="item.role" :maxlength="120" @update:model-value="staff(i,'role',$event)" /></BsField><BsField v-slot="field" :label="copy.bio"><BsTextarea :id="field.id" :model-value="item.bio" :maxlength="320" @update:model-value="staff(i,'bio',$event)" /></BsField>
    <BsInline><BsButton :disabled="i===0" @click="move('staff',i,-1)">{{copy.up}}</BsButton><BsButton :disabled="i===form.staff.length-1" @click="move('staff',i,1)">{{copy.down}}</BsButton><BsButton variant="danger" @click="remove('staff',i)">{{copy.remove}}</BsButton></BsInline>
   </BsStack>
   <BsButton v-if="form.staff.length<20" @click="form={...form,staff:[...form.staff,{name:'',role:'',bio:'',image:null}]}">{{copy.addStaff}}</BsButton>
  </BsRecordActionDialog>
 </BsStack>
</template>
<style scoped>
.bs-builder-preview{background:var(--bs-surface-muted);border:1px solid var(--bs-border);border-radius:var(--bs-radius-card);overflow:hidden;padding-block-end:var(--bs-space-5)}.bs-builder-preview__banner{position:relative;min-block-size:16rem;display:grid;align-items:end;background:var(--bs-color-brand-building-navy);color:var(--bs-color-brand-white)}.bs-builder-preview__banner>img{position:absolute;inline-size:100%;block-size:100%;object-fit:cover}.bs-builder-preview__banner>div{position:relative;padding:var(--bs-space-6);background:linear-gradient(transparent,var(--bs-color-brand-deep-structure-navy))}.bs-builder-preview__banner h2{font-size:var(--bs-type-h1-size);margin:0}.bs-builder-preview__no-banner{padding:var(--bs-space-6);display:flex;gap:var(--bs-space-3)}.bs-builder-preview__search{position:relative;display:flex;align-items:center;gap:var(--bs-space-4);margin:calc(-1 * var(--bs-space-3)) var(--bs-space-5) var(--bs-space-5);padding:var(--bs-space-5);border-radius:var(--bs-radius-card);background:var(--bs-surface);border:1px solid var(--bs-border)}.bs-builder-preview__search>span{flex:1}.bs-builder-preview__sections{display:flex;gap:var(--bs-space-5);padding:var(--bs-space-5)}.bs-builder-preview__gallery,.bs-builder-preview__staff{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(12rem,100%),1fr));gap:var(--bs-space-4);padding:var(--bs-space-5)}.bs-builder-preview figure{margin:0}.bs-builder-preview__gallery img{inline-size:100%;aspect-ratio:4/3;object-fit:cover}.bs-builder-preview__staff article{background:var(--bs-surface);padding:var(--bs-space-4);border-radius:var(--bs-radius-card);text-align:center}.bs-builder-preview__staff img{inline-size:5rem;block-size:5rem;object-fit:cover;border-radius:50%}.bs-builder-preview__staff h3{margin:var(--bs-space-2) 0}.bs-builder-preview__staff p{font-size:var(--bs-type-caption-size);overflow-wrap:anywhere}
</style>
