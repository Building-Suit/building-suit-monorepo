<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,patient,copy,view,reload,select,changePage}=useDoctorMessagesPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]})
await context.refresh()
</script>
<template><BsMessageOutboxPage v-model:patient="patient" :copy="copy" :view="view" @reload="reload" @select="select" @page="changePage"/></template>
