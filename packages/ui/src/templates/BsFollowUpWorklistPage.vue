<script setup lang="ts">
import{computed}from'vue'
import type{BsDataTableQueryAdapter}from'@building-suit/ux'
import type{BsWorklistFields,BsWorklistActionFields,BsWorklistCopy,BsWorklistView,BsWorklistAction}from'../utils/worklistPresentation'
const props=defineProps<{copy:BsWorklistCopy;view:BsWorklistView}>()
const fields=defineModel<BsWorklistFields>('fields',{required:true}),actionFields=defineModel<BsWorklistActionFields>('actionFields',{required:true}),filter=defineModel<string>('filter',{required:true}),mine=defineModel<boolean>('mine',{required:true}),overdue=defineModel<boolean>('overdue',{required:true})
const editorOpen=defineModel<boolean>('editorOpen',{required:true}),confirmationOpen=defineModel<boolean>('confirmationOpen',{required:true}),historyOpen=defineModel<boolean>('historyOpen',{required:true})
const emit=defineEmits<{retry:[];create:[];save:[];action:[id:string,action:BsWorklistAction];confirm:[];patients:[search:string];options:[];filter:[];page:[value:number];historyPage:[value:number]}>()
const columns=computed(()=>[{key:'kind',header:props.copy.kind,width:'md' as const},{key:'assignee',field:'assignee',header:props.copy.assignee,width:'md' as const},{key:'due',header:props.copy.due,width:'md' as const},{key:'state',field:'state',header:props.copy.state,width:'sm' as const},{key:'actions',header:props.copy.action,width:'sm' as const}])
const adapter=computed<BsDataTableQueryAdapter>(()=>({page:value=>emit('page',value.page)}))
const historyColumns=computed(()=>[{key:'action',field:'action',header:props.copy.action},{key:'actor',field:'actor',header:props.copy.actor},{key:'at',field:'at',header:props.copy.day},{key:'version',field:'version',header:props.copy.version},{key:'previousAssignee',field:'previousAssignee',header:props.copy.previousAssignee},{key:'assignee',field:'assignee',header:props.copy.nextAssignee},{key:'reason',field:'reason',header:props.copy.reason}])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.pending" @click="emit('retry')">{{copy.reload}}</BsButton></template></BsPageHeader>
  <BsAlert tone="info" :description="copy.notice"/>
  <BsText v-if="view.checkedAt" as="p" size="sm" tone="muted">{{copy.checked}}: {{view.checkedAt}}</BsText>
  <BsStateSurface v-if="view.denied" state="permission" :title="view.denied"/>
  <BsSectionSkeleton v-else-if="view.loading" :rows="4"/>
  <BsStateSurface v-else-if="view.error" state="error" :title="view.error"/>
  <template v-else>
   <BsFilterBar :label="copy.state">
    <BsSelect v-model="filter" :label="copy.state" :options="view.states" option-label="label" option-value="value" :disabled="view.pending" @update:model-value="emit('filter')"/>
    <BsCheckbox v-model="mine" :label="copy.mine" :disabled="view.pending" @update:model-value="emit('filter')"/>
    <BsCheckbox v-model="overdue" :label="copy.overdue" :disabled="view.pending" @update:model-value="emit('filter')"/>
   </BsFilterBar>
   <BsDataTable :value="view.rows" :columns="columns" row-key="id" :label="copy.title" :scroll-label="copy.title" :capabilities="{insert:view.canCreate}" :action-labels="{insert:copy.create}" :row-action-pending="view.pending" lazy paginator :first="view.page*20" :page-size="20" :total-records="view.total" :query-adapter="adapter" @create="emit('create')">
    <template #cell-kind="{row}"><BsStack gap="sm"><BsText as="span" emphasis="medium">{{row.kind}}</BsText><BsText v-if="row.patient" as="span" size="sm">{{row.patient}}</BsText><BsText v-if="row.blocked" as="span" size="sm" tone="muted">{{copy.blocked}}</BsText></BsStack></template>
    <template #cell-assignee="{row}"><BsText as="bdi" dir="ltr" size="sm">{{row.assignee}}</BsText></template>
    <template #cell-due="{row}"><BsStack gap="sm"><BsText as="bdi" dir="ltr">{{row.due}}</BsText><BsText v-if="row.overdue" as="span" size="sm">{{copy.overdue}}</BsText></BsStack></template>
    <template #cell-actions="{row}"><BsStack gap="sm"><BsButton v-for="action in row.actions" :key="action.value" size="sm" text :aria-label="action.label+': '+row.kind" :disabled="view.pending" @click="emit('action',row.id,action.value)">{{action.label}}</BsButton></BsStack></template>
    <template #empty><BsStateSurface state="empty" :title="copy.empty"/></template>
   </BsDataTable>
  </template>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.close" @submit="emit('save')">
   <BsText as="p" size="sm">{{copy.notice}}</BsText>
   <BsField v-slot="field" :label="copy.kind" required><BsSelect v-model="fields.kind" :input-id="field.id" :label="copy.kind" :options="view.kinds" option-label="label" option-value="value" :disabled="view.editor.pending" :aria-describedby="field.describedby"/></BsField>
   <BsEntityPicker v-if="view.editor.canReadPatients" :model-value="fields.patientId" :label="copy.patient" :options="view.patients" option-label="label" option-value="value" :loading="view.editor.patientsLoading" :error="view.editor.patientsError" :retry-label="copy.reload" :load-more-label="copy.more" :disabled="view.editor.pending||view.editor.patientsLoading" @update:model-value="fields.patientId=String($event??'')" @search="emit('patients',$event)" @retry="emit('patients','')"/>
   <BsText v-if="view.editor.canReadPatients" as="p" size="sm" tone="muted">{{copy.patientHint}}</BsText>
   <BsField v-slot="field" :label="copy.assignee" required><BsSelect v-model="fields.assignee" :input-id="field.id" :label="copy.assignee" :options="view.assignees" option-label="label" option-value="value" :loading="view.editor.optionsLoading" :disabled="view.editor.pending||view.editor.optionsLoading" :aria-describedby="field.describedby"/></BsField>
   <BsAlert v-if="view.editor.optionsError" tone="error" :description="view.editor.optionsError"/><BsButton v-if="view.editor.optionsError" @click="emit('options')">{{copy.reload}}</BsButton>
   <BsField v-slot="field" :label="copy.day" required><BsInput :id="field.id" v-model="fields.day" type="date" :min="view.editor.minDate" :max="view.editor.maxDate" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
   <BsField v-slot="field" :label="copy.time" required><BsInput :id="field.id" v-model="fields.time" placeholder="HH:mm" :maxlength="5" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
   <BsText as="p" size="sm">{{copy.timezone}}: {{view.editor.timezone}}</BsText>
  </BsRecordActionDialog>
  <BsRecordActionDialog v-model:visible="confirmationOpen" :title="view.confirmation.title" :dirty="view.confirmation.dirty" :pending="view.confirmation.pending" :error="view.confirmation.error" :submit-disabled="view.confirmation.disabled" :submit-label="copy.save" :cancel-label="copy.close" @submit="emit('confirm')">
   <BsText as="p">{{view.confirmation.summary}}</BsText>
   <BsText as="p" size="sm">{{copy.notice}}</BsText>
   <template v-if="view.confirmation.reassign">
    <BsField v-slot="field" :label="copy.assignee" required><BsSelect v-model="actionFields.assignee" :input-id="field.id" :label="copy.assignee" :options="view.assignees" option-label="label" option-value="value" :loading="view.confirmation.optionsLoading" :disabled="view.confirmation.pending||view.confirmation.optionsLoading" :aria-describedby="field.describedby"/></BsField>
    <BsField v-slot="field" :label="copy.reason" required><BsSelect v-model="actionFields.reason" :input-id="field.id" :label="copy.reason" :options="view.reasons" option-label="label" option-value="value" :disabled="view.confirmation.pending" :aria-describedby="field.describedby"/></BsField>
    <BsAlert v-if="view.confirmation.optionsError" tone="error" :description="view.confirmation.optionsError"/><BsButton v-if="view.confirmation.optionsError" @click="emit('options')">{{copy.reload}}</BsButton>
   </template>
  </BsRecordActionDialog>
  <BsDialog v-model:visible="historyOpen" :title="copy.history" size="lg"><template #default="{close}"><BsStack gap="md">
   <BsSectionSkeleton v-if="view.history.loading" :rows="3"/><BsAlert v-else-if="view.history.error" tone="error" :description="view.history.error"/>
   <BsDataTable v-else :value="view.history.rows" :columns="historyColumns" row-key="id" :label="copy.history" :scroll-label="copy.history"/>
   <BsPagination :page="view.history.page+1" :total="view.history.total" :label="copy.pages" :previous-label="copy.previous" :next-label="copy.next" @update:page="emit('historyPage',$event-1)"/>
   <BsButton @click="close">{{copy.close}}</BsButton>
  </BsStack></template></BsDialog>
 </BsStack>
</template>
