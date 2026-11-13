<script setup lang="ts">
definePageMeta({layout:'default',middleware:['auth']})
const {form,editor,view,copy,edit,save,publish,image,retry}=useStorefrontBuilder()
</script>
<template><BsStorefrontBuilderPage v-model:form="form" v-model:editor="editor" :view="view" :copy="copy" @edit="edit" @save="save" @publish="publish" @image="image" @retry="retry()" /></template>
