<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
await useDoctorContext().refresh()
const {copy,view,filters,apply,refresh,page,closeSource,clinicPage}=await useDoctorFinancialReports()
</script>
<template>
 <BsReportsPage v-model:practice-filters="filters" :practice-ledger="{copy,view}" @practice-apply="apply" @practice-refresh="refresh" @practice-page="page" @practice-clinic-page="clinicPage" @practice-close-source="closeSource"/>
</template>
