<script setup lang="ts">
import type { BsLandingJourney } from '../types/landingPresentation'
import type {BsShopPublicEntryView,BsWebsiteInquiryForm} from '../types/shopWebsitePresentation'
defineProps<{view:BsShopPublicEntryView;journey?:BsLandingJourney}>()
const inquiry=defineModel<BsWebsiteInquiryForm>('inquiry',{default:()=>({name:'',contact:'',message:'',company:''})})
const basketContact=defineModel<BsWebsiteInquiryForm>('basketContact',{default:()=>({name:'',contact:'',message:'',company:''})})
const emit=defineEmits<{submitBasket:[];add:[id:string];quantity:[id:string,value:number];search:[value:string];kind:[value:string];sort:[value:string];page:[value:number];clearFilters:[];retryCatalog:[];submitInquiry:[];currency:[value:string];interval:[value:string];variant:[id:string,value:string];action:[id:string];linkAction:[id:string];retry:[];changelogRetry:[]}>()
</script>
<template>
 <BsShopWebsitePage v-if="view.kind==='website'" v-model:inquiry="inquiry" v-model:basket-contact="basketContact" :view="view.website" @submit-basket="emit('submitBasket')" @add="emit('add',$event)" @quantity="(id,value)=>emit('quantity',id,value)" @search="emit('search',$event)" @kind="emit('kind',$event)" @sort="emit('sort',$event)" @page="emit('page',$event)" @clear-filters="emit('clearFilters')" @retry-catalog="emit('retryCatalog')" @submit-inquiry="emit('submitInquiry')"/>
 <BsLandingPage v-else :journey="journey" :content="view.content" :preview="view.preview" :pricing="view.pricing" :changelog="view.changelog" signup-path="/auth/signup" @currency="emit('currency',$event)" @interval="emit('interval',$event)" @variant="(id,value)=>emit('variant',id,value)" @action="emit('action',$event)" @link-action="emit('linkAction',$event)" @retry="emit('retry')" @changelog-retry="emit('changelogRetry')"/>
</template>
