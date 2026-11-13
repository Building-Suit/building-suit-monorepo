<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const{context,batch,fields,editorOpen,copy,view,reload,select,create,demo,file,save,command,changePage}=useDoctorImportPreviewPage()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]});await context.refresh()
</script>
<template><BsSyntheticImportPreviewPage v-model:batch="batch" v-model:fields="fields" v-model:editor-open="editorOpen" :copy="copy" :view="view" @reload="reload" @select="select" @create="create" @demo="demo" @file="file" @save="save" @command="command" @page="changePage"/></template>
