<script setup lang="ts">
import {computed}from'vue'
import type{BsConsultationFields,BsConsultationCopy,BsConsultationView}from'../utils/consultationPresentation'
const props=defineProps<{copy:BsConsultationCopy;view:BsConsultationView}>()
const fields=defineModel<BsConsultationFields>('fields',{required:true}),editorOpen=defineModel<boolean>('editorOpen',{required:true})
const emit=defineEmits<{retry:[];create:[];edit:[id:string];save:[]}>()
const columns=computed(()=>[{key:'name',field:'name',header:props.copy.name},{key:'duration',field:'duration',header:props.copy.duration},{key:'buffers',field:'buffers',header:props.copy.buffers},{key:'locations',field:'locations',header:props.copy.locations},{key:'status',field:'status',header:props.copy.status},{key:'version',field:'version',header:props.copy.version}])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.pending" @click="emit('retry')">{{copy.retry}}</BsButton></template></BsPageHeader>
  <BsAlert tone="info" :description="copy.notice"/>
  <BsText as="p" size="sm">{{copy.capacity}}</BsText>
  <BsStateSurface v-if="view.denied" state="permission" :title="view.denied"/>
  <BsSectionSkeleton v-else-if="view.loading" :rows="4"/>
  <BsStateSurface v-else-if="view.error" state="error" :title="view.error"><BsButton @click="emit('retry')">{{copy.retry}}</BsButton></BsStateSurface>
  <BsDataTable v-else :value="view.rows" :columns="columns" row-key="id" :label="copy.title" :capabilities="{insert:view.canManage,edit:view.canManage}" :action-labels="{insert:copy.create,edit:copy.edit}" :row-action-pending="view.pending" paginator :page-size="20" @create="emit('create')" @edit="emit('edit',$event.id)"><template #cell-buffers="{row}"><BsText as="bdi" dir="ltr">{{row.buffers}}</BsText></template><template #empty><BsStateSurface state="empty" :title="copy.empty"/></template></BsDataTable>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
   <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" v-model="fields.name" :aria-describedby="field.describedby" :maxlength="100" required/></BsField>
   <BsField v-slot="field" :label="copy.duration" required><BsInput :id="field.id" v-model="fields.duration" :aria-describedby="field.describedby" type="number" min="5" max="120" step="1" required/></BsField>
   <BsField v-slot="field" :label="copy.before" required><BsInput :id="field.id" v-model="fields.before" :aria-describedby="field.describedby" type="number" min="0" max="120" step="1" required/></BsField>
   <BsField v-slot="field" :label="copy.after" required><BsInput :id="field.id" v-model="fields.after" :aria-describedby="field.describedby" type="number" min="0" max="120" step="1" required/></BsField>
   <BsFieldGroup :legend="copy.locations"><BsCheckbox v-for="location in view.locations" :key="location.value" v-model="fields.locations" :value="location.value" :label="location.label"/></BsFieldGroup>
   <BsCheckbox v-model="fields.active" :label="copy.active"/>
  </BsRecordActionDialog>
 </BsStack>
</template>
