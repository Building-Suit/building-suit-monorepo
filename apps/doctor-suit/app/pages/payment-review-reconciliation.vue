<script setup lang="ts">
definePageMeta({layout:'auth',middleware:'doctor-auth'})
const {filters,view,apply,refresh,page}=await useDoctorManualReport(true)
</script>
<template><BsPaymentReconciliationPage v-model:filters="filters" :view="view" @apply="apply" @retry="refresh" @page="page"/></template>
