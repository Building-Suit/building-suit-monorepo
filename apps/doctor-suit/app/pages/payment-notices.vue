<script setup lang="ts">
import { doctorPolicyNavigation } from '../utils/policyPresentation'
const {locale}=useI18n()
definePageMeta({layout:'auth',middleware:'doctor-auth'})
const {controller,view,values,update,refresh,download}=await useDoctorManualPayment(false)
</script>
<template>
 <BsManualPaymentPage :policy-navigation="doctorPolicyNavigation(locale==='ar')" :reconciliation-action="{to:'/payment-reconciliation',label:locale==='ar'?'مطابقة التحويلات':'Reconcile payments'}" :view="view" :values="values" @update:values="update" @choose="controller.choose()" @prepare="controller.prepare()" @submit="controller.submit()" @upload="controller.upload()" @skip-receipt="controller.skipReceipt()" @retry="refresh()" @retry-operation="controller.retry()" @select="controller.select" @review="controller.review" @activate="controller.activate()" @download="download" @page="refresh" />
</template>
