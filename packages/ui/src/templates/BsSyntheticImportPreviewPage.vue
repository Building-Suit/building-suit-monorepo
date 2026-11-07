<script setup lang="ts">
import type{BsSyntheticImportFields,BsSyntheticImportView,BsSyntheticImportCopy}from'../utils/syntheticImportPresentation'
defineProps<{view:BsSyntheticImportView;copy:BsSyntheticImportCopy}>()
const batch=defineModel<string>('batch',{required:true}),fields=defineModel<BsSyntheticImportFields>('fields',{required:true}),editorOpen=defineModel<boolean>('editorOpen',{required:true})
const emit=defineEmits<{reload:[];select:[];create:[];save:[];demo:[];file:[file:File|null];command:[action:string];page:[page:number]}>()
function field(key:keyof BsSyntheticImportFields,value:unknown){fields.value={...fields.value,[key]:String(value??'')}}
function file(value:File|File[]|null){emit('file',Array.isArray(value)?value[0]??null:value)}
</script>
<template><BsStack gap="lg">
 <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.loading||view.pending" @click="emit('reload')">{{copy.reload}}</BsButton><BsButton v-if="view.canCreate" :disabled="view.pending" @click="emit('create')">{{copy.create}}</BsButton></template></BsPageHeader>
 <BsAlert tone="warning">{{copy.notice}}</BsAlert>
 <BsField :label="copy.batch"><BsSelect v-model="batch" :label="copy.batch" :options="view.batches" option-label="label" option-value="value" :disabled="view.pending||view.loading" @update:model-value="emit('select')"/></BsField>
 <BsText v-if="view.error" role="alert" tone="danger">{{view.error}}</BsText><BsSectionSkeleton v-else-if="view.loading" variant="table" :rows="4"/>
 <BsDescriptionList><BsDescriptionItem v-for="item in view.summary" :key="item.label" :term="item.label">{{item.value}}</BsDescriptionItem></BsDescriptionList>
 <BsInline><BsButton v-if="view.canNext" :disabled="view.pending" @click="emit('command','next')">{{copy.nextChunk}}</BsButton><BsButton v-if="view.canReconcile" :disabled="view.pending" @click="emit('command','reconcile')">{{copy.reconcile}}</BsButton><BsButton v-if="view.canDiscard" :disabled="view.pending" @click="emit('command','discard')">{{copy.discard}}</BsButton></BsInline>
 <BsEmptyState v-if="!view.loading&&!view.rows.length" :title="copy.empty"/>
 <BsCard v-else-if="view.rows.length" padding="none"><BsDataTable :value="view.rows" data-key="id" :label="copy.title" :columns="[{key:'source',field:'source',header:copy.source},{key:'kind',field:'kind',header:copy.kind},{key:'state',field:'state',header:copy.state},{key:'errors',field:'errors',header:copy.errors}]"/></BsCard>
 <BsInline v-if="view.total" justify="between"><BsButton :disabled="view.loading||view.pending||view.page===0" @click="emit('page',view.page-1)">{{copy.previous}}</BsButton><BsText>{{view.total}}</BsText><BsButton :disabled="view.loading||view.pending||(view.page+1)*20>=view.total" @click="emit('page',view.page+1)">{{copy.next}}</BsButton></BsInline>
 <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.close" @submit="emit('save')">
  <template v-if="view.editor.mode==='create'"><BsField :label="copy.sourceRef"><BsInput :model-value="fields.sourceRef" :label="copy.sourceRef" :maxlength="200" @update:model-value="field('sourceRef',$event)"/></BsField><BsField :label="copy.file"><BsFileInput :label="copy.file" accept=".json,application/json" @update:model-value="file"/></BsField><BsButton @click="emit('demo')">{{copy.demo}}</BsButton><BsField :label="copy.sourceText"><BsTextarea :model-value="fields.sourceText" :label="copy.sourceText" :rows="10" @update:model-value="field('sourceText',$event)"/></BsField></template>
  <BsText v-else>{{copy.discardHint}}</BsText>
 </BsRecordActionDialog>
</BsStack></template>
