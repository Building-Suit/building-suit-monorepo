<script setup lang="ts">
import type {BsShopPublicEntryView} from '@building-suit/ui/types/shopWebsitePresentation'
definePageMeta({layout:'landing'})
const websiteMode=isTenantWebsiteRequest()
const website=websiteMode?usePublicWebsite():null
const marketing=websiteMode?null:useShopLandingEntry()
if(website)await website.initializeLocale()
const view=computed<BsShopPublicEntryView>(()=>website?{kind:'website',website:website.view.value}:marketing!.view.value)
const inquiry=website?.form??ref({name:'',contact:'',message:'',company:''})
</script>
<template><BsShopPublicEntryPage v-model:inquiry="inquiry" :view="view" @submit-inquiry="website?.submit()" @interval="marketing?.chooseInterval($event)" @variant="(id,value)=>marketing?.chooseVariant(id,value)" @action="marketing?.choose($event)" @link-action="marketing?.track()" @retry="marketing?.refresh()" @changelog-retry="marketing?.refreshReleases()" /></template>
