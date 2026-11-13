<script setup lang="ts">
definePageMeta({layout:'default',middleware:['auth','business-mode']})
const {mode,search,page,historyPage,editorOpen,historyOpen,form,copy,view,rows,products,productPicker,refresh,refreshHistory,create,edit,history,submit,product}=useWeighingSetup()
</script>
<template>
 <BsWeighingSetupPage v-model:mode="mode" v-model:search="search" v-model:page="page" v-model:history-page="historyPage" v-model:editor-open="editorOpen" v-model:history-open="historyOpen" v-model:form="form" :copy="copy" :view="view" :rows="rows" :products="products" @retry="refresh()" @retry-history="refreshHistory()" @add="create" @edit="edit" @history="history" @submit="submit" @product="product" @product-search="productPicker.query" @product-more="productPicker.more" @product-retry="productPicker.retry" />
</template>
