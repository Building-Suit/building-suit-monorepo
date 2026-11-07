<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
const { search,status,page,historyPage,receiptPage,editorOpen,detailOpen,operationOpen,form,operation,copy,view,rows,supplierChoices,lineViews,refresh,refreshDetail,create,open,edit,operate,submit,submitOperation,print,addLine,source,pickers,removeLine } = useSupplierOrders()
</script>
<template>
 <BsSupplierOrdersPage v-model:search="search" v-model:status="status" v-model:page="page" v-model:history-page="historyPage" v-model:receipt-page="receiptPage" v-model:editor-open="editorOpen" v-model:detail-open="detailOpen" v-model:operation-open="operationOpen" v-model:form="form" v-model:operation="operation" :copy="copy" :view="view" :rows="rows" :supplier-picker="supplierChoices" :line-views="lineViews" @retry="refresh()" @retry-detail="refreshDetail()" @add="create" @open="open" @edit="edit" @operate="operate" @submit="submit" @submit-operation="submitOperation" @print="print" @add-line="addLine" @remove-line="removeLine" @source="source" @picker-search="(kind, query) => pickers[kind].query(query)" @picker-more="kind => pickers[kind].more()" @picker-retry="kind => pickers[kind].retry()" />
</template>
