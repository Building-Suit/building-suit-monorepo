<script setup lang="ts">
const {fields,editorOpen,confirmationOpen,uploadOpen,file,reason,recipient,expires,copy,choices,view,reload,select,create,edit,save,changeSearch,changePage,readVersion,history}=useDoctorNativeEncounterPage()
</script>
<template><BsClinicalWorkspacePage v-model:fields="fields" v-model:editor-open="editorOpen" v-model:confirmation-open="confirmationOpen" v-model:upload-open="uploadOpen" v-model:file="file" v-model:reason="reason" v-model:recipient="recipient" v-model:expires="expires" :view="view" :copy="copy" :choices="choices" :editor-sections="['note']" @retry="reload" @select="select" @create="create" @edit="edit" @save="save" @search="changeSearch" @page="changePage" @read-version="readVersion" @history-page="history"/></template>
