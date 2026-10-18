<script setup lang="ts">
import{doctorSubscriptionView}from'../utils/subscriptionPresentation'
definePageMeta({layout:'practice',middleware:'doctor-auth'})
const subscription=useNuxtApp().$doctorSubscription
const{locale}=useI18n()
const view=computed(()=>doctorSubscriptionView(subscription.state,locale.value==='ar'))
await subscription.load()
</script>
<template>
 <BsSubscriptionStatusPage v-model:accepted="subscription.state.accepted" :copy="view.copy" :document="view.document" :ready="Boolean(subscription.state.status)" :loading="subscription.state.loading" :pending="subscription.state.pending" :error="view.error" :status="view.status" :additional-status="view.additionalStatus" :status-fields="view.statusFields" :terms-fields="view.termsFields" :can-start="subscription.canStart()" :can-continue="view.canContinue" @retry="subscription.load()" @start="subscription.start()" />
</template>
