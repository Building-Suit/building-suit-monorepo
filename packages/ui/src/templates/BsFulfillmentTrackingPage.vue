<script setup lang="ts">
import type{BsFulfillmentView,BsFulfillmentCopy,BsFulfillmentFields}from'../utils/fulfillmentPresentation'
defineProps<{view:BsFulfillmentView;copy:BsFulfillmentCopy}>()
const patient=defineModel<string>('patient',{required:true}),fields=defineModel<BsFulfillmentFields>('fields',{required:true}),editorOpen=defineModel<boolean>('editorOpen',{required:true})
const emit=defineEmits<{reload:[];select:[];create:[];save:[];action:[id:string,action:string];page:[value:number]}>()
function field(key:keyof BsFulfillmentFields,value:unknown){fields.value={...fields.value,[key]:String(value??'')}}
</script>
<template><BsStack gap="lg">
 <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.loading||view.pending" @click="emit('reload')">{{copy.reload}}</BsButton><BsButton v-if="view.canCreate" :disabled="view.pending" @click="emit('create')">{{copy.create}}</BsButton></template></BsPageHeader>
 <BsAlert tone="warning">{{copy.notice}}</BsAlert>
 <BsField :label="copy.patient"><BsSelect v-model="patient" :label="copy.patient" :options="view.patients" option-label="label" option-value="value" :disabled="view.loading||view.pending" @update:model-value="emit('select')"/></BsField>
 <BsText v-if="view.error" role="alert" tone="danger">{{view.error}}</BsText><BsSectionSkeleton v-else-if="view.loading" variant="table" :rows="4"/><BsEmptyState v-else-if="!view.rows.length" :title="copy.empty"/>
 <BsCard v-else padding="none"><BsDataTable :value="view.rows" data-key="id" :label="copy.title" :columns="[{key:'kind',field:'kind',header:copy.kind},{key:'state',field:'state',header:copy.state},{key:'created',field:'created',header:copy.created},{key:'review',field:'review',header:copy.review},{key:'actions',header:copy.actions}]"><template #cell-actions="{row}"><BsInline><BsButton v-for="a in row.actions" :key="a.value" size="sm" :disabled="view.pending" @click="emit('action',row.id,a.value)">{{a.label}}</BsButton></BsInline></template></BsDataTable></BsCard>
 <BsInline v-if="view.total" justify="between"><BsButton :disabled="view.loading||view.pending||!view.page" @click="emit('page',view.page-1)">{{copy.previous}}</BsButton><BsText>{{view.total}}</BsText><BsButton :disabled="view.loading||view.pending||(view.page+1)*20>=view.total" @click="emit('page',view.page+1)">{{copy.next}}</BsButton></BsInline>
 <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.close" @submit="emit('save')">
  <BsField v-if="view.editor.mode==='create'" :label="copy.request"><BsSelect :model-value="fields.request" :label="copy.request" :options="view.requests" option-label="label" option-value="value" @update:model-value="field('request',$event)"/></BsField>
  <BsField :label="copy.source"><BsInput :model-value="fields.source" :label="copy.source" :maxlength="200" @update:model-value="field('source',$event)"/></BsField>
  <template v-if="view.editor.mode==='receive'"><BsField :label="copy.document"><BsSelect :model-value="fields.document" :label="copy.document" :options="view.documents" option-label="label" option-value="value" @update:model-value="field('document',$event)"/></BsField><BsField :label="copy.sourceAt"><BsInput :model-value="fields.sourceAt" :label="copy.sourceAt" @update:model-value="field('sourceAt',$event)"/></BsField><BsField :label="copy.receivedAt"><BsInput :model-value="fields.receivedAt" :label="copy.receivedAt" @update:model-value="field('receivedAt',$event)"/></BsField></template>
 </BsRecordActionDialog>
</BsStack></template>
