<script setup lang="ts">
definePageMeta({layout:'auth',middleware:'doctor-auth'})
const {controller,view,values,update,refresh,download}=await useDoctorManualPayment(true)
</script>
<template>
 <BsManualPaymentPage :view="view" :values="values" @update:values="update" @choose="controller.choose()" @prepare="controller.prepare()" @submit="controller.submit()" @upload="controller.upload()" @skip-receipt="controller.skipReceipt()" @retry="refresh()" @retry-operation="controller.retry()" @select="controller.select" @review="controller.review" @activate="controller.activate()" @download="download" @page="refresh" />
</template>
