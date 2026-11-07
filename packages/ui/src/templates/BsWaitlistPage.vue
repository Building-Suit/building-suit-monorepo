<script setup lang="ts">
import{computed}from'vue'
import type{BsDataTableQueryAdapter}from'@building-suit/ux'
import type{BsWaitlistFields,BsWaitlistOfferFields,BsWaitlistCopy,BsWaitlistView,BsWaitlistAction}from'../utils/waitlistPresentation'
const props=defineProps<{copy:BsWaitlistCopy;view:BsWaitlistView}>()
const fields=defineModel<BsWaitlistFields>('fields',{required:true}),offerFields=defineModel<BsWaitlistOfferFields>('offerFields',{required:true}),filter=defineModel<string>('filter',{required:true}),reason=defineModel<string>('reason',{required:true})
const editorOpen=defineModel<boolean>('editorOpen',{required:true}),offerOpen=defineModel<boolean>('offerOpen',{required:true}),confirmationOpen=defineModel<boolean>('confirmationOpen',{required:true}),historyOpen=defineModel<boolean>('historyOpen',{required:true})
const emit=defineEmits<{retry:[];create:[];save:[];action:[id:string,action:BsWaitlistAction];confirm:[];offerDate:[];submitOffer:[];patients:[search:string];types:[];filter:[];search:[value:string];page:[value:number];historyPage:[value:number]}>()
const columns=computed(()=>[{key:'patient',header:props.copy.patient,width:'content' as const},{key:'window',header:props.copy.window,width:'content' as const},{key:'state',field:'state',header:props.copy.state,width:'content' as const},{key:'offer',header:props.copy.offer,width:'content' as const},{key:'actions',header:props.copy.action,width:'content' as const}])
const adapter=computed<BsDataTableQueryAdapter>(()=>({page:value=>emit('page',value.page),search:value=>emit('search',value)}))
const historyColumns=computed(()=>[{key:'action',field:'action',header:props.copy.action},{key:'actor',field:'actor',header:props.copy.actor},{key:'at',field:'at',header:props.copy.date},{key:'version',field:'version',header:props.copy.version},{key:'reason',field:'reason',header:props.copy.reason}])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.pending" @click="emit('retry')">{{copy.retry}}</BsButton></template></BsPageHeader>
  <BsAlert tone="info" :description="copy.notice"/>
  <BsInline v-if="view.checkedAt" wrap><BsText as="span" size="sm" tone="muted">{{copy.checked}}</BsText><BsText as="bdi" dir="ltr" size="sm" tone="muted">{{view.checkedAt}}</BsText></BsInline>
  <BsStateSurface v-if="view.denied" state="permission" :title="view.denied"/>
  <BsSectionSkeleton v-else-if="view.loading" :rows="4"/>
  <BsStateSurface v-else-if="view.error" state="error" :title="view.error"/>
  <template v-else>
   <BsFilterBar :label="copy.state"><BsSelect v-model="filter" :label="copy.state" :options="view.states" option-label="label" option-value="value" :disabled="view.pending" @update:model-value="emit('filter')"/></BsFilterBar>
   <BsDataTable :value="view.rows" :columns="columns" row-key="id" :label="copy.title" :scroll-label="copy.title" :capabilities="{insert:view.canCreate}" :action-labels="{insert:copy.create}" :row-action-pending="view.pending" lazy paginator searchable :search-label="copy.search" :first="view.page*20" :page-size="20" :total-records="view.total" :query-adapter="adapter" @create="emit('create')">
    <template #cell-patient="{row}"><BsStack gap="sm"><BsText as="span" emphasis="medium">{{row.patient}}</BsText><BsText as="span" size="sm">{{row.type}}</BsText><BsText as="span" size="sm" tone="muted">{{copy.permission}}: {{row.permission}}</BsText><BsText v-if="row.blocked" as="span" size="sm" tone="muted">{{row.blocked}}</BsText></BsStack></template>
    <template #cell-window="{row}"><BsText as="bdi" dir="ltr">{{row.window}}</BsText></template>
    <template #cell-offer="{row}"><BsStack gap="sm"><BsText as="bdi" dir="ltr">{{row.offer}}</BsText><BsText v-if="row.expires" as="span" size="sm" tone="muted">{{copy.expires}}</BsText><BsText as="bdi" dir="ltr" size="sm">{{row.expires}}</BsText></BsStack></template>
    <template #cell-expires="{row}"><BsText as="bdi" dir="ltr">{{row.expires}}</BsText></template>
    <template #cell-actions="{row}"><BsInline wrap><BsButton v-for="action in row.actions" :key="action.value" size="sm" text :aria-label="action.label+': '+row.patient" :disabled="view.pending" @click="emit('action',row.id,action.value)">{{action.label}}</BsButton></BsInline></template>
    <template #empty><BsStateSurface state="empty" :title="copy.empty"/></template>
   </BsDataTable>
  </template>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
   <BsEntityPicker :model-value="fields.patientId" :label="copy.patient" :options="view.patients" option-label="label" option-value="value" :loading="view.editor.patientsLoading" :error="view.editor.patientsError" :retry-label="copy.retry" :load-more-label="copy.more" :disabled="view.editor.pending||view.editor.patientsLoading" @update:model-value="fields.patientId=String($event??'')" @search="emit('patients',$event)" @retry="emit('patients','')"/>
   <BsField v-slot="field" :label="copy.type" required><BsSelect v-model="fields.typeId" :input-id="field.id" :label="copy.type" :options="view.types" option-label="label" option-value="value" :loading="view.editor.typesLoading" :aria-describedby="field.describedby" :disabled="view.editor.pending||view.editor.typesLoading"/></BsField>
   <BsAlert v-if="view.editor.typesError" tone="error" :description="view.editor.typesError"/><BsButton v-if="view.editor.typesError" @click="emit('types')">{{copy.retry}}</BsButton>
   <BsField v-slot="field" :label="copy.from" required><BsInput :id="field.id" v-model="fields.from" type="date" :min="view.editor.minDate" :max="view.editor.maxDate" :aria-describedby="field.describedby" required/></BsField>
   <BsField v-slot="field" :label="copy.to" required><BsInput :id="field.id" v-model="fields.to" type="date" :min="view.editor.minDate" :max="view.editor.maxDate" :aria-describedby="field.describedby" required/></BsField>
   <BsField v-slot="field" :label="copy.start" required><BsInput :id="field.id" v-model="fields.start" placeholder="HH:mm" :maxlength="5" :aria-describedby="field.describedby" required/></BsField>
   <BsField v-slot="field" :label="copy.end" required><BsInput :id="field.id" v-model="fields.end" placeholder="HH:mm" :maxlength="5" :aria-describedby="field.describedby" required/></BsField>
   <BsCheckbox v-model="fields.permission" :label="copy.permission" :description="copy.permissionHint"/>
   <BsField v-slot="field" :label="copy.source" :required="fields.permission"><BsInput :id="field.id" v-model="fields.source" :maxlength="200" :aria-describedby="field.describedby" :required="fields.permission"/></BsField>
  </BsRecordActionDialog>
  <BsRecordActionDialog v-model:visible="offerOpen" :title="view.offerEditor.title" :dirty="view.offerEditor.dirty" :pending="view.offerEditor.pending" :error="view.offerEditor.error" :submit-disabled="view.offerEditor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('submitOffer')">
   <BsText as="p">{{view.offerEditor.summary}}</BsText>
   <BsText as="p" size="sm">{{copy.notice}}</BsText>
   <BsField v-slot="field" :label="copy.date" required><BsInput :id="field.id" v-model="offerFields.date" type="date" :min="view.offerEditor.minDate" :max="view.offerEditor.maxDate" :aria-describedby="field.describedby" required @change="emit('offerDate')"/></BsField>
   <BsText as="p">{{copy.timezone}}: {{view.offerEditor.timezone}}</BsText>
   <BsAlert v-if="view.offerEditor.queryError" tone="error" :description="view.offerEditor.queryError"/>
   <BsField v-slot="field" :label="copy.slot" required><BsSelect v-model="offerFields.minute" :input-id="field.id" :label="copy.slot" :options="view.offerEditor.slots" option-label="label" option-value="value" :loading="view.offerEditor.loading" :aria-describedby="field.describedby" :disabled="view.offerEditor.pending||view.offerEditor.loading"/></BsField>
   <BsField v-slot="field" :label="copy.holdMinutes" required><BsInput :id="field.id" v-model="offerFields.minutes" type="number" min="1" max="1440" step="1" :aria-describedby="field.describedby" required/></BsField>
  </BsRecordActionDialog>
  <BsRecordActionDialog v-model:visible="confirmationOpen" :title="view.confirmation.title" :dirty="view.confirmation.dirty" :pending="view.confirmation.pending" :error="view.confirmation.error" :submit-disabled="view.confirmation.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('confirm')">
   <BsText as="p">{{view.confirmation.description}}</BsText>
   <BsField v-if="view.confirmation.reasonRequired" v-slot="field" :label="copy.reason" required><BsInput :id="field.id" v-model="reason" :maxlength="200" :aria-describedby="field.describedby" required/></BsField>
  </BsRecordActionDialog>
  <BsDialog v-model:visible="historyOpen" :title="view.history.title" size="lg"><template #default="{close}"><BsStack gap="md">
   <BsSectionSkeleton v-if="view.history.loading" :rows="3"/>
   <BsAlert v-else-if="view.history.error" tone="error" :description="view.history.error"/>
   <BsDataTable v-else :value="view.history.rows" :columns="historyColumns" row-key="id" :label="copy.history"/>
   <BsPagination :page="view.history.page+1" :total="view.history.total" :label="copy.pages" :previous-label="copy.previous" :next-label="copy.next" @update:page="emit('historyPage',$event-1)"/>
   <BsButton @click="close">{{copy.close}}</BsButton>
  </BsStack></template></BsDialog>
 </BsStack>
</template>
