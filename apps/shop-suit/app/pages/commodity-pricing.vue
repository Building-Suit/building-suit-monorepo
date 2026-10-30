<script setup lang="ts">
definePageMeta({layout:'default',middleware:['auth','business-mode']})
const {mode,search,page,historyPage,editorOpen,historyOpen,form,copy,view,rows,products,quotes,productPicker,quotePicker,refresh,refreshHistory,create,edit,history,submit,product,quote,retryQuotes}=useCommodityPricing()
</script>
<template>
 <BsCommodityPricingPage v-model:mode="mode" v-model:search="search" v-model:page="page" v-model:history-page="historyPage" v-model:editor-open="editorOpen" v-model:history-open="historyOpen" v-model:form="form" :copy="copy" :view="view" :rows="rows" :products="products" :quotes="quotes" @retry="refresh()" @retry-history="refreshHistory()" @add="create" @edit="edit" @history="history" @submit="submit" @product="product" @quote="quote" @product-search="productPicker.query" @product-more="productPicker.more" @product-retry="productPicker.retry" @quote-search="quotePicker.query" @quote-more="quotePicker.more" @quote-retry="retryQuotes" />
</template>
