<script setup lang="ts">
import{computed}from'vue'
import type{BsDataTableQueryAdapter}from'@building-suit/ux'
import type{BsContactPreferencesFields,BsContactPreferencesCopy,BsContactPreferencesView,BsContactPreferencesKind,BsContactPreferencesAction}from'../utils/contactPreferencesPresentation'
const props=defineProps<{copy:BsContactPreferencesCopy;view:BsContactPreferencesView}>()
const patient=defineModel<string>('patient',{required:true}),fields=defineModel<BsContactPreferencesFields>('fields',{required:true}),editorOpen=defineModel<boolean>('editorOpen',{required:true}),historyOpen=defineModel<boolean>('historyOpen',{required:true})
const emit=defineEmits<{retry:[];patient:[];patients:[search:string];createContact:[];createGuardian:[];save:[];action:[kind:BsContactPreferencesKind,id:string,action:BsContactPreferencesAction];guardians:[search:string];moreGuardians:[];contactPage:[page:number];guardianPage:[page:number];historyPage:[page:number]}>()
const contactColumns=computed(()=>[{key:'destination',header:props.copy.destination,width:'lg' as const},{key:'recipient',field:'recipient',header:props.copy.recipient,width:'md' as const},{key:'consents',header:props.copy.consents,width:'lg' as const},{key:'actions',header:props.copy.actions,width:'sm' as const}])
const guardianColumns=computed(()=>[{key:'label',header:props.copy.guardian,width:'md' as const},{key:'scope',header:props.copy.scope,width:'lg' as const},{key:'state',field:'state',header:props.copy.state,width:'sm' as const},{key:'actions',header:props.copy.actions,width:'sm' as const}])
const contactAdapter=computed<BsDataTableQueryAdapter>(()=>({page:v=>emit('contactPage',v.page)})),guardianAdapter=computed<BsDataTableQueryAdapter>(()=>({page:v=>emit('guardianPage',v.page)}))
const historyColumns=computed(()=>[{key:'action',field:'action',header:props.copy.actions},{key:'actor',field:'actor',header:props.copy.actor},{key:'at',field:'at',header:props.copy.at},{key:'version',field:'version',header:props.copy.version},{key:'source',field:'source',header:props.copy.source},{key:'details',field:'details',header:props.copy.scope}])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title"><template #actions><BsButton :disabled="view.pending" @click="emit('retry')">{{copy.reload}}</BsButton></template></BsPageHeader>
  <BsAlert tone="info" :description="copy.notice"/>
  <BsStateSurface v-if="view.denied" state="permission" :title="view.denied"/>
  <template v-else>
   <BsEntityPicker :model-value="patient" :label="copy.patient" :options="view.patients" option-label="label" option-value="value" :loading="view.patientLoading" :error="view.patientError" :retry-label="copy.reload" :load-more-label="copy.more" :disabled="view.pending||view.patientLoading" @update:model-value="patient=String($event??'');emit('patient')" @search="emit('patients',$event)" @retry="emit('patients','')"/>
   <BsStateSurface v-if="!patient" state="empty" :title="copy.choosePatient"/>
   <BsSectionSkeleton v-else-if="view.loading" :rows="4"/>
   <BsStateSurface v-else-if="view.error" state="error" :title="view.error"/>
   <template v-else>
    <BsSectionHeader :title="view.patientName"/><BsText v-if="view.checkedAt" as="p" size="sm" tone="muted">{{copy.checked}}: {{view.checkedAt}}</BsText>
    <BsAlert v-if="view.patientArchived" tone="warning" :description="copy.archived"/>
    <BsSectionHeader :title="copy.contacts"/>
    <BsDataTable :value="view.contacts" :columns="contactColumns" row-key="id" :label="copy.contacts" :scroll-label="copy.contacts" :capabilities="{insert:view.canWrite}" :action-labels="{insert:copy.addContact}" :row-action-pending="view.pending" lazy paginator :first="view.contactPage*20" :page-size="20" :total-records="view.contactTotal" :query-adapter="contactAdapter" @create="emit('createContact')">
     <template #cell-destination="{row}"><BsStack gap="sm"><BsText as="bdi" dir="ltr" emphasis="medium">{{row.destination}}</BsText><BsText as="span" size="sm">{{row.channel}} · {{row.state}}</BsText></BsStack></template>
     <template #cell-consents="{row}"><BsText v-if="!row.consents.length" as="p" size="sm" tone="muted">{{copy.noConsent}}</BsText><BsStack v-else gap="md"><BsStack v-for="consent in row.consents" :key="consent.id" gap="sm"><BsText as="span" emphasis="medium">{{consent.purpose}}: {{consent.state}}</BsText><BsText v-if="consent.blocked" as="span" size="sm">{{consent.blocked}}</BsText><BsText as="span" size="sm" tone="muted">{{consent.source}} · {{consent.at}}</BsText><BsInline wrap><BsButton v-if="consent.canRevoke" size="sm" text :aria-label="consent.revokeLabel+': '+row.destination" :disabled="view.pending" @click="emit('action','consent',consent.id,'revoke')">{{consent.revokeLabel}}</BsButton><BsButton size="sm" text :aria-label="consent.historyLabel+': '+row.destination" :disabled="view.pending" @click="emit('action','consent',consent.id,'history')">{{consent.historyLabel}}</BsButton></BsInline></BsStack></BsStack></template>
     <template #cell-actions="{row}"><BsStack gap="sm"><BsButton v-if="row.canGrant" size="sm" text :aria-label="row.grantLabel+': '+row.destination" :disabled="view.pending" @click="emit('action','contact',row.id,'grant')">{{row.grantLabel}}</BsButton><BsButton v-if="row.canRevoke" size="sm" text :aria-label="row.revokeLabel+': '+row.destination" :disabled="view.pending" @click="emit('action','contact',row.id,'revoke')">{{row.revokeLabel}}</BsButton><BsButton size="sm" text :aria-label="row.historyLabel+': '+row.destination" :disabled="view.pending" @click="emit('action','contact',row.id,'history')">{{row.historyLabel}}</BsButton></BsStack></template>
     <template #empty><BsStateSurface state="empty" :title="copy.emptyContacts"/></template>
    </BsDataTable>
    <BsSectionHeader :title="copy.guardians"/>
    <BsDataTable :value="view.guardians" :columns="guardianColumns" row-key="id" :label="copy.guardians" :scroll-label="copy.guardians" :capabilities="{insert:view.canWrite}" :action-labels="{insert:copy.addGuardian}" :row-action-pending="view.pending" lazy paginator :first="view.guardianPage*20" :page-size="20" :total-records="view.guardianTotal" :query-adapter="guardianAdapter" @create="emit('createGuardian')">
     <template #cell-label="{row}"><BsStack gap="sm"><BsText as="span" emphasis="medium">{{row.label}}</BsText><BsText as="span" size="sm">{{row.relationship}}</BsText></BsStack></template>
     <template #cell-scope="{row}"><BsStack gap="sm"><BsText as="span">{{row.scope}}</BsText><BsText as="bdi" dir="ltr" size="sm">{{row.expires}}</BsText></BsStack></template>
     <template #cell-actions="{row}"><BsStack gap="sm"><BsButton v-if="row.canReview" size="sm" text :aria-label="row.reviewLabel+': '+row.label" :disabled="view.pending" @click="emit('action','guardian',row.id,'review')">{{row.reviewLabel}}</BsButton><BsButton v-if="row.canRevoke" size="sm" text :aria-label="row.revokeLabel+': '+row.label" :disabled="view.pending" @click="emit('action','guardian',row.id,'revoke')">{{row.revokeLabel}}</BsButton><BsButton size="sm" text :aria-label="row.historyLabel+': '+row.label" :disabled="view.pending" @click="emit('action','guardian',row.id,'history')">{{row.historyLabel}}</BsButton></BsStack></template>
     <template #empty><BsStateSurface state="empty" :title="copy.emptyGuardians"/></template>
    </BsDataTable>
   </template>
  </template>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-disabled="view.editor.disabled" :submit-label="copy.save" :cancel-label="copy.close" @submit="emit('save')">
   <BsText v-if="view.editor.summary" as="p">{{view.editor.summary}}</BsText>
   <template v-if="view.editor.mode==='contact'">
    <BsField v-slot="field" :label="copy.channel" required><BsSelect v-model="fields.channel" :input-id="field.id" :label="copy.channel" :options="view.channels" option-label="label" option-value="value" :disabled="view.editor.pending" :aria-describedby="field.describedby"/></BsField>
    <BsField v-slot="field" :label="copy.destination" required><BsInput :id="field.id" v-model="fields.destination" :maxlength="254" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
    <BsField v-slot="field" :label="copy.recipient" required><BsSelect v-model="fields.recipientKind" :input-id="field.id" :label="copy.recipient" :options="view.recipients" option-label="label" option-value="value" :disabled="view.editor.pending" :aria-describedby="field.describedby"/></BsField>
    <BsEntityPicker v-if="fields.recipientKind==='guardian'" :model-value="fields.guardianId" :label="copy.guardian" :options="view.editor.guardians" option-label="label" option-value="value" :loading="view.editor.guardiansLoading" :error="view.editor.guardiansError" :has-more="view.editor.guardiansMore" :retry-label="copy.reload" :load-more-label="copy.more" :disabled="view.editor.pending||view.editor.guardiansLoading" @update:model-value="fields.guardianId=String($event??'')" @search="emit('guardians',$event)" @retry="emit('guardians','')" @load-more="emit('moreGuardians')"/>
   </template>
   <template v-else-if="view.editor.mode==='guardian'">
    <BsField v-slot="field" :label="copy.label" required><BsInput :id="field.id" v-model="fields.label" :maxlength="160" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
    <BsField v-slot="field" :label="copy.relationship" required><BsSelect v-model="fields.relationship" :input-id="field.id" :label="copy.relationship" :options="view.relationships" option-label="label" option-value="value" :disabled="view.editor.pending" :aria-describedby="field.describedby"/></BsField>
   </template>
   <BsAlert v-if="view.editor.mode==='review'" tone="info" :description="copy.reviewHint"/>
   <BsFieldGroup v-if="view.editor.mode==='review'" :legend="copy.purposes"><BsCheckbox v-for="purpose in view.purposes" :key="purpose.value" :model-value="fields.purposes" :value="purpose.value" :label="purpose.label" :disabled="view.editor.pending" @update:model-value="fields.purposes=Array.isArray($event)?$event.map(String):[]"/></BsFieldGroup>
   <template v-if="view.editor.mode==='consent'">
    <BsField v-slot="field" :label="copy.purpose" required><BsSelect v-model="fields.purpose" :input-id="field.id" :label="copy.purpose" :options="view.editor.purposes" option-label="label" option-value="value" :disabled="view.editor.pending" :aria-describedby="field.describedby"/></BsField>
    <BsCheckbox :model-value="fields.allowed" :label="copy.permission" :description="copy.permissionHint" :disabled="view.editor.pending" @update:model-value="fields.allowed=$event===true"/>
   </template>
   <BsField v-if="view.editor.mode!=='contact'" v-slot="field" :label="copy.source" required><BsInput :id="field.id" v-model="fields.sourceRef" :maxlength="200" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
   <template v-if="view.editor.mode==='review'||view.editor.mode==='consent'">
    <BsField v-slot="field" :label="view.editor.mode==='review'?copy.expiryDay:copy.sourceDay" required><BsInput :id="field.id" v-model="fields.day" type="date" :min="view.editor.minDate" :max="view.editor.maxDate" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
    <BsField v-slot="field" :label="copy.time" required><BsInput :id="field.id" v-model="fields.time" placeholder="HH:mm" :maxlength="5" :disabled="view.editor.pending" :aria-describedby="field.describedby" required/></BsField>
    <BsText as="p" size="sm">{{copy.timezone}}: {{view.editor.timezone}}</BsText>
   </template>
  </BsRecordActionDialog>
  <BsDialog v-model:visible="historyOpen" :title="view.history.title" size="lg"><template #default="{close}"><BsStack gap="md"><BsSectionSkeleton v-if="view.history.loading" :rows="3"/><BsAlert v-else-if="view.history.error" tone="error" :description="view.history.error"/><BsDataTable v-else :value="view.history.rows" :columns="historyColumns" row-key="id" :label="copy.history" :scroll-label="copy.history"/><BsPagination :page="view.history.page+1" :total="view.history.total" :label="copy.pages" :previous-label="copy.previous" :next-label="copy.next" @update:page="emit('historyPage',$event-1)"/><BsButton @click="close">{{copy.close}}</BsButton></BsStack></template></BsDialog>
 </BsStack>
</template>
