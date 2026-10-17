<script setup lang="ts">
import type {BsCustomerPortalView,BsCustomerPortalForm} from '../types/customerPortalPresentation'
defineProps<{view:BsCustomerPortalView}>()
const form=defineModel<BsCustomerPortalForm>('form',{required:true})
const emit=defineEmits<{verify:[];logout:[];refresh:[];bucket:[value:'upcoming'|'past'];page:[value:number]}>()
function update(key:keyof BsCustomerPortalForm,value:string|number){form.value={...form.value,[key]:String(value)}}
</script>
<template>
 <div class="bs-customer-portal" :lang="view.locale" :dir="view.locale==='ar'?'rtl':'ltr'">
  <header class="bs-customer-portal__header"><a :href="view.homeHref" class="bs-customer-portal__brand"><img :src="view.logo" :alt="view.shopName" width="48" height="48"><span>{{view.shopName}}</span></a><nav :aria-label="view.copy.language"><a v-for="link in view.languages" :key="link.locale" :href="link.href" :lang="link.locale" :aria-current="link.locale===view.locale?'page':undefined">{{link.label}}</a></nav></header>
  <main class="bs-customer-portal__main">
   <BsHeading :level="1">{{view.copy.title}}</BsHeading>
   <BsAlert v-if="view.error" tone="error">{{view.error}}</BsAlert>
   <BsText v-if="view.mode==='loading'" role="status">{{view.copy.loading}}</BsText>
   <BsPanel v-else-if="view.mode==='verify'" padding="lg" class="bs-customer-portal__verification">
    <BsStack gap="md"><BsText as="p">{{view.copy.help}}</BsText>
     <BsForm :pending="view.pending" @submit="emit('verify')">
      <BsField v-slot="field" :label="view.copy.code" required><BsInput :id="field.id" :model-value="form.code" dir="ltr" autocomplete="off" :maxlength="32" required @update:model-value="update('code',$event)"/></BsField>
      <BsField v-slot="field" :label="view.copy.phone" required><BsInput :id="field.id" :model-value="form.phone" type="tel" dir="ltr" autocomplete="off" :maxlength="40" required @update:model-value="update('phone',$event)"/></BsField>
      <BsButton type="submit" variant="primary" :pending="view.pending">{{view.copy.verify}}</BsButton>
     </BsForm>
     <BsButton v-if="view.error" :disabled="view.pending" @click="emit('refresh')">{{view.copy.retry}}</BsButton>
    </BsStack>
   </BsPanel>
   <template v-else>
    <BsInline wrap><BsText as="p">{{view.scopeLabel}}</BsText><BsText as="p" size="sm" tone="muted">{{view.expiresLabel}}</BsText></BsInline>
    <BsInline wrap><BsButton :aria-pressed="view.bucket==='upcoming'" :variant="view.bucket==='upcoming'?'primary':'secondary'" :disabled="view.pending" @click="emit('bucket','upcoming')">{{view.copy.upcoming}}</BsButton><BsButton :aria-pressed="view.bucket==='past'" :variant="view.bucket==='past'?'primary':'secondary'" :disabled="view.pending" @click="emit('bucket','past')">{{view.copy.past}}</BsButton><BsButton :disabled="view.pending" @click="emit('refresh')">{{view.copy.refresh}}</BsButton><BsButton :disabled="view.pending" @click="emit('logout')">{{view.copy.logout}}</BsButton></BsInline>
    <BsText v-if="!view.rows.length" as="p" role="status">{{view.bucket==='upcoming'?view.copy.emptyUpcoming:view.copy.emptyPast}}</BsText>
    <ol v-else class="bs-customer-portal__appointments">
     <li v-for="row in view.rows" :key="row.key" class="bs-customer-portal__appointment">
      <div class="bs-customer-portal__when"><strong>{{row.date}}</strong><span dir="ltr">{{row.time}}</span><BsText size="sm" tone="muted">{{row.timeZone}}</BsText></div>
      <div class="bs-customer-portal__details"><BsHeading :level="2">{{row.service}}</BsHeading><BsText as="p">{{row.staff}}</BsText><address v-if="row.location"><strong>{{row.location.name}}</strong><span>{{row.location.address}}</span></address><BsText v-else as="p" tone="muted">{{view.copy.locationUnavailable}}</BsText></div>
      <BsStatusBadge :status="row.status" :label="row.statusLabel" :tone="row.tone"/>
     </li>
    </ol>
    <BsPagination :page="view.page" :page-size="20" :total="view.total" :label="view.copy.title" :previous-label="view.copy.previous" :next-label="view.copy.next" @update:page="emit('page',$event)"/>
   </template>
   <BsInline wrap><a :href="view.homeHref">{{view.copy.home}}</a><a v-if="view.bookingHref" :href="view.bookingHref">{{view.copy.booking}}</a></BsInline>
  </main>
 </div>
</template>
<style scoped>
.bs-customer-portal{min-height:100vh;background:var(--bs-bg);color:var(--bs-text);}
.bs-customer-portal a{color:var(--bs-text);text-underline-offset:.25em;overflow-wrap:anywhere;}
.bs-customer-portal a:focus-visible{outline:3px solid var(--bs-focus-ring,var(--bs-primary));outline-offset:4px;}
.bs-customer-portal__header,.bs-customer-portal__main{max-width:66rem;margin-inline:auto;padding-inline:clamp(1rem,4vw,3rem);}
.bs-customer-portal__header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-block:1.25rem;border-bottom:1px solid var(--bs-border);}
.bs-customer-portal__brand{display:flex;gap:.75rem;align-items:center;font-weight:700;text-decoration:none;min-width:0;}
.bs-customer-portal__brand img{object-fit:contain;flex-shrink:0;}
.bs-customer-portal__header nav{display:flex;gap:1rem;flex-shrink:0;}
.bs-customer-portal__main{display:grid;gap:1.5rem;padding-block:clamp(2rem,5vw,4rem);}
.bs-customer-portal__verification{max-width:36rem;}
.bs-customer-portal__appointments{list-style:none;margin:0;padding:0;}
.bs-customer-portal__appointment{display:grid;grid-template-columns:minmax(9rem,1fr) minmax(0,3fr) auto;align-items:start;gap:1.5rem;padding-block:1.5rem;border-bottom:1px solid var(--bs-border);}
.bs-customer-portal__when,.bs-customer-portal__details,.bs-customer-portal address{display:grid;gap:.5rem;overflow-wrap:anywhere;}
.bs-customer-portal__when{font-variant-numeric:tabular-nums;}.bs-customer-portal address{font-style:normal;}
@media(max-width:42rem){.bs-customer-portal__appointment{grid-template-columns:minmax(0,1fr);gap:1rem;}.bs-customer-portal__header{align-items:start;}.bs-customer-portal__brand img{width:36px;height:36px;}}
</style>
