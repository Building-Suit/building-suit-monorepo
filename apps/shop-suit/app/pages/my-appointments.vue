<script setup lang="ts">
definePageMeta({layout:false})
const portal=useCustomerPortal()
await portal.initializeLocale()
</script>
<template><BsShopCustomerPortalPage v-model:form="portal.form.value" :view="portal.view.value" @verify="portal.verify" @logout="portal.logout" @refresh="portal.refresh" @bucket="portal.setBucket" @page="portal.setPage" /></template>
