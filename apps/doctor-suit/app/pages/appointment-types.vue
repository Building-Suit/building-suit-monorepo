<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,copy,view,fields,editorOpen,open,save,reload}=useDoctorConsultationsPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]})
await context.refresh()
</script>
<template>
 <BsConsultationTypesPage v-model:fields="fields" v-model:editor-open="editorOpen" :copy="copy" :view="view" @retry="reload" @create="open()" @edit="open" @save="save"/>
</template>
