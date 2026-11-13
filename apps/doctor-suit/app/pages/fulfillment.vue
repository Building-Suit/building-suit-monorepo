<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,patient,fields,editorOpen,copy,view,reload,select,create,action,save,changePage}=useDoctorFulfillmentPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]});await context.refresh()
</script>
<template><BsFulfillmentTrackingPage v-model:patient="patient" v-model:fields="fields" v-model:editor-open="editorOpen" :copy="copy" :view="view" @reload="reload" @select="select" @create="create" @action="action" @save="save" @page="changePage"/></template>
