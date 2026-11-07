<script setup lang="ts">
definePageMeta({layout:'practice',middleware:'doctor-auth',pageTransition:false})
const {context,copy,choices,view,fields,reason,recipient,expires,file,editorOpen,confirmationOpen,uploadOpen,reload,select,create,edit,save,action,confirmAction,add,remove,print,exportRecord,changeHistory,openUpload,saveUpload,download,readVersion,documentsPage,search,page}=useDoctorClinicalWorkspace()
useHead({meta:[{name:'robots',content:'noindex,nofollow'}]})
await context.refresh()
</script>
<template>
 <BsClinicalWorkspacePage v-model:fields="fields" v-model:reason="reason" v-model:recipient="recipient" v-model:expires="expires" v-model:file="file" v-model:editor-open="editorOpen" v-model:confirmation-open="confirmationOpen" v-model:upload-open="uploadOpen" :view="view" :copy="copy" :choices="choices" @retry="reload" @select="select" @create="create" @edit="edit" @save="save" @action="action" @confirm="confirmAction" @add="add" @remove="remove" @print="print" @export="exportRecord" @history-page="changeHistory" @upload="openUpload" @save-upload="saveUpload" @download="download" @read-version="readVersion" @documents-page="documentsPage" @search="search" @page="page" />
</template>
