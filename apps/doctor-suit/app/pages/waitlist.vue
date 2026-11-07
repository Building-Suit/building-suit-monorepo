<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,copy,view,fields,offerFields,reason,filter,editorOpen,offerOpen,confirmationOpen,historyOpen,reload,create,save,action,offerDate,submitOffer,confirmAction,patients,types,changeFilter,search,changePage,historyPage}=useDoctorWaitlistPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]})
await context.refresh()
</script>
<template>
 <BsWaitlistPage v-model:fields="fields" v-model:offer-fields="offerFields" v-model:reason="reason" v-model:filter="filter" v-model:editor-open="editorOpen" v-model:offer-open="offerOpen" v-model:confirmation-open="confirmationOpen" v-model:history-open="historyOpen" :copy="copy" :view="view" @retry="reload" @create="create" @save="save" @action="action" @offer-date="offerDate" @submit-offer="submitOffer" @confirm="confirmAction" @patients="patients" @types="types" @filter="changeFilter" @search="search" @page="changePage" @history-page="historyPage"/>
</template>
