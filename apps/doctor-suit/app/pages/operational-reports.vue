<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,filters,copy,choices,view,reload,changePage}=useDoctorOperationalReportsPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]});await context.refresh()
</script>
<template><BsReportsPage v-model:filters="filters" :copy="copy" :choices="choices" :view="view" @retry="reload" @page="changePage"/></template>
