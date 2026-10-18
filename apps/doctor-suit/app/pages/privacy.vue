<script setup lang="ts">
import{doctorPrivacyView}from'../utils/privacyPresentation'
definePageMeta({layout:'practice',middleware:'doctor-auth'})
const privacy=useNuxtApp().$doctorPrivacy
const{locale}=useI18n()
const view=computed(()=>doctorPrivacyView(privacy.state,locale.value==='ar'))
const kind=computed({get:()=>privacy.state.kind,set:(value:string)=>{if(view.value.options.some(row=>row.value===value))privacy.state.kind=value as typeof privacy.state.kind}})
await privacy.load()
</script>
<template><BsPrivacyRequestsPage v-model:kind="kind" :copy="view.copy" :options="view.options" :rows="view.rows" :loading="privacy.state.loading" :pending="privacy.state.pending" :can-submit="privacy.canSubmit()" :submitted="privacy.state.submitted" :error="view.error" @submit="privacy.submit()" @retry="privacy.load()" /></template>
