<script setup lang="ts">
definePageMeta({layout:'default',middleware:['auth','business-mode']})
const {mode,search,page,historyPage,priceProduct,priceVendor,editorOpen,historyOpen,form,copy,view,rows,priceRows,productChoices,supplierChoices,binChoices,reelChoices,pickers,refresh,refreshHistory,create,edit,history,submit,selectProduct,selectReel}=useSupplyPlanning()
const pickerViews=computed(()=>({product:productChoices.value,supplier:supplierChoices.value,bin:binChoices.value,reel:reelChoices.value}))
</script>
<template>
 <BsSupplyPlanningPage v-model:mode="mode" v-model:search="search" v-model:page="page" v-model:history-page="historyPage" v-model:price-product="priceProduct" v-model:price-vendor="priceVendor" v-model:editor-open="editorOpen" v-model:history-open="historyOpen" v-model:form="form" :copy="copy" :view="view" :rows="rows" :price-rows="priceRows" :pickers="pickerViews" @retry="refresh()" @retry-history="refreshHistory()" @add="create" @edit="edit" @history="history" @submit="submit" @product="selectProduct" @reel="selectReel" @picker-search="(kind,query)=>pickers[kind].query(query)" @picker-more="kind=>pickers[kind].more()" @picker-retry="kind=>pickers[kind].retry()" />
</template>
