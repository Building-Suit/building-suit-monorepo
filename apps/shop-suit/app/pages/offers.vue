<script setup lang="ts">
definePageMeta({layout:'default',middleware:['auth']})
const {form,editor,view,copy,create,edit,save,retry,page,search,more,retrySources,add}=useCatalogOffers()
</script>
<template><BsCatalogOffersPage v-model:form="form" v-model:editor="editor" :view="view" :copy="copy" @create="create" @edit="edit" @save="save" @retry="retry()" @page="page" @search="search" @more="more" @retry-sources="retrySources()" @add="add" /></template>
