<script setup lang="ts">
import type{BsMessageOutboxView,BsMessageOutboxCopy}from'../utils/messageOutboxPresentation'
defineProps<{view:BsMessageOutboxView;copy:BsMessageOutboxCopy}>()
const patient=defineModel<string>('patient',{required:true})
const emit=defineEmits<{reload:[];select:[];page:[value:number]}>()
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.loading" @click="emit('reload')">{{copy.reload}}</BsButton></template></BsPageHeader>
  <BsAlert tone="warning">{{copy.notice}}</BsAlert>
  <BsField :label="copy.patient"><BsSelect v-model="patient" :label="copy.patient" :options="view.patients" option-label="label" option-value="value" :disabled="view.loading" @update:model-value="emit('select')"/></BsField>
  <BsText v-if="view.error" role="alert" tone="danger">{{view.error}}</BsText>
  <BsSectionSkeleton v-else-if="view.loading" variant="table" :rows="4"/>
  <BsEmptyState v-else-if="!view.rows.length" :title="copy.empty"/>
  <BsCard v-else padding="none"><BsDataTable :value="view.rows" data-key="id" :label="copy.title" :columns="[{key:'state',field:'state',header:copy.state},{key:'purpose',field:'purpose',header:copy.purpose},{key:'recipient',field:'recipient',header:copy.recipient},{key:'attempts',field:'attempts',header:copy.attempts},{key:'blocker',field:'blocker',header:copy.blocker},{key:'created',field:'created',header:copy.created}]"/></BsCard>
  <BsInline v-if="view.total" justify="between"><BsButton :disabled="view.loading||view.page===0" @click="emit('page',view.page-1)">{{copy.previous}}</BsButton><BsText>{{view.total}}</BsText><BsButton :disabled="view.loading||(view.page+1)*20>=view.total" @click="emit('page',view.page+1)">{{copy.next}}</BsButton></BsInline>
 </BsStack>
</template>
