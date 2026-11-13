<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,copy,view,fields,actionFields,filter,mine,overdue,editorOpen,confirmationOpen,historyOpen,reload,create,save,action,confirmAction,options,patients,changeFilter,changePage,historyPage}=useDoctorWorklistsPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]})
await context.refresh()
</script>
<template>
 <BsFollowUpWorklistPage v-model:fields="fields" v-model:action-fields="actionFields" v-model:filter="filter" v-model:mine="mine" v-model:overdue="overdue" v-model:editor-open="editorOpen" v-model:confirmation-open="confirmationOpen" v-model:history-open="historyOpen" :copy="copy" :view="view" @retry="reload" @create="create" @save="save" @action="action" @confirm="confirmAction" @options="options" @patients="patients" @filter="changeFilter" @page="changePage" @history-page="historyPage"/>
</template>
