<script setup lang="ts">
import type { BsLandingJourney } from '../types/landingPresentation'
import type {BsShopPublicEntryView,BsWebsiteInquiryForm} from '../types/shopWebsitePresentation'
defineProps<{view:BsShopPublicEntryView;journey?:BsLandingJourney}>()
const inquiry=defineModel<BsWebsiteInquiryForm>('inquiry',{default:()=>({name:'',contact:'',message:'',company:''})})
const emit=defineEmits<{submitInquiry:[];currency:[value:string];interval:[value:string];variant:[id:string,value:string];action:[id:string];linkAction:[id:string];retry:[];changelogRetry:[]}>()
</script>
<template>
 <BsShopWebsitePage v-if="view.kind==='website'" v-model:inquiry="inquiry" :view="view.website" @submit-inquiry="emit('submitInquiry')"/>
 <BsLandingPage v-else :journey="journey" :content="view.content" :preview="view.preview" :pricing="view.pricing" :changelog="view.changelog" signup-path="/auth/signup" @currency="emit('currency',$event)" @interval="emit('interval',$event)" @variant="(id,value)=>emit('variant',id,value)" @action="emit('action',$event)" @link-action="emit('linkAction',$event)" @retry="emit('retry')" @changelog-retry="emit('changelogRetry')"/>
</template>
