<script setup lang="ts">
import type { BsDataTableQueryAdapter } from '@building-suit/ux'
import type { BsClinicalFields,BsClinicalCopy,BsClinicalChoices,BsClinicalWorkspaceView } from '../utils/clinicalPresentation'
const props=defineProps<{view:BsClinicalWorkspaceView;copy:BsClinicalCopy;choices:BsClinicalChoices}>()
const fields=defineModel<BsClinicalFields>('fields',{required:true})
const editorOpen=defineModel<boolean>('editorOpen',{required:true})
const confirmationOpen=defineModel<boolean>('confirmationOpen',{required:true})
const uploadOpen=defineModel<boolean>('uploadOpen',{required:true})
const file=defineModel<File|null>('file',{required:true})
const reason=defineModel<string>('reason',{required:true})
const recipient=defineModel<string>('recipient',{required:true})
const expires=defineModel<string>('expires',{required:true})
const tab=ref('note')
const emit=defineEmits<{
 retry:[];search:[scope:string|null,value:string];page:[scope:string|null,page:number];select:[id:string];create:[];edit:[];save:[];close:[]
 action:[action:'start'|'finalize'|'amend'|'withdraw'|'release'|'revoke_release',releaseId?:string];confirm:[];print:[id:string];export:[];historyPage:[page:number];readVersion:[id:string]
 add:[kind:'intake'|'prescription'|'order'|'result'|'segment',index?:number];remove:[kind:'intake'|'prescription'|'order'|'result'|'segment',index:number,segment?:number]
 upload:[];saveUpload:[];download:[documentId:string,versionId:string];documentsPage:[page:number]
}>()
const queryAdapter=computed<BsDataTableQueryAdapter>(()=>{const scope=props.view.scopeKey;return{search:value=>emit('search',scope,value),page:value=>emit('page',scope,value.page)}})
const columns=computed(()=>[{key:'patient',field:'patient',header:props.copy.patient},{key:'status',field:'status',header:props.copy.status},{key:'date',field:'date',header:props.copy.date},{key:'open',header:props.copy.open}])
const historyColumns=computed(()=>[{key:'revision',field:'revision',header:props.copy.revision},{key:'status',field:'status',header:props.copy.status},{key:'actor',field:'actor',header:props.copy.actor},{key:'date',field:'date',header:props.copy.date},{key:'reason',field:'reason',header:props.copy.reason},{key:'open',header:props.copy.open},{key:'print',header:props.copy.print}])
const intakeColumns=computed(()=>['kind','knowledge','source','text','value','unit'].map(key=>({key,field:key,header:props.copy[key as keyof BsClinicalCopy]})))
const prescriptionColumns=computed(()=>['name','identity','strength','form','amount','route','schedule','instructions'].map(key=>({key,field:key,header:key==='schedule'?props.copy.segments:props.copy[key as keyof BsClinicalCopy]})))
const orderColumns=computed(()=>['kind','request','due','state','reason'].map(key=>({key,field:key,header:key==='state'?props.copy.status:props.copy[key as keyof BsClinicalCopy]})))
const resultColumns=computed(()=>['order','document','stage','annotation'].map(key=>({key,field:key,header:key==='stage'?props.copy.status:props.copy[key as keyof BsClinicalCopy]})))
const releaseColumns=computed(()=>[{key:'open',header:props.copy.open},{key:'version',field:'version',header:props.copy.revision},{key:'recipient',field:'recipient',header:props.copy.recipient},{key:'expires',field:'expires',header:props.copy.expires},{key:'status',field:'status',header:props.copy.status},{key:'revoke',header:props.copy.revoke}])
const tabs=computed(()=>['note','intake','prescriptions','orders','results'].map(value=>({value,label:props.copy[value as keyof BsClinicalCopy]})))
const orderOptions=computed(()=>fields.value.orders.map((item,index)=>({value:item.id,label:`${index+1}: ${item.request || props.copy.order}`})))
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="view.title" :subtitle="view.scopeLabel || view.description"><template #actions><BsButton v-if="view.canCreate" variant="primary" :disabled="view.pending" @click="emit('create')">{{ copy.create }}</BsButton></template></BsPageHeader>
  <BsAlert tone="warning" :description="view.notice" />
  <BsAlert v-if="view.error" tone="error" :description="view.error"><BsButton :disabled="view.pending" @click="emit('retry')">{{ copy.retry }}</BsButton></BsAlert>
  <BsSectionSkeleton v-if="view.loading && !view.available" :rows="4" />
  <BsStateSurface v-else-if="!view.available" state="permission" :title="copy.unavailable" />
  <template v-else>
   <BsDataTable :value="view.rows" :columns="columns" row-key="id" :label="copy.title" :lazy="true" :loading="view.loading" :paginator="true" :page-size="20" :first="view.page*20" :total-records="view.total" :searchable="true" :search-label="copy.search" :query-adapter="queryAdapter">
    <template #empty><BsStateSurface state="empty" :title="copy.empty" /></template>
    <template #cell-open="{data}"><BsButton variant="text" :disabled="view.pending" @click="emit('select',data.id)">{{ copy.open }}: {{ data.patient }}</BsButton></template>
   </BsDataTable>
   <BsStack v-if="view.detail" gap="md">
    <BsSectionHeader :title="view.detail.patient" :description="`${view.detail.status} · ${copy.revision} ${view.detail.version} · ${view.detail.location}`" />
    <BsDescriptionList :columns="2"><BsDescriptionItem :term="copy.actor">{{ view.detail.doctor }}</BsDescriptionItem><BsDescriptionItem :term="copy.date">{{ view.detail.date }}</BsDescriptionItem></BsDescriptionList>
    <BsInline>
     <BsButton v-if="view.detail.canEdit" :disabled="view.pending" @click="emit('edit')">{{ copy.edit }}</BsButton>
     <BsButton v-if="view.detail.canStart" :disabled="view.pending" @click="emit('action','start')">{{ copy.start }}</BsButton>
     <BsButton v-if="view.detail.canFinalize" :disabled="view.pending" @click="emit('action','finalize')">{{ copy.finalize }}</BsButton>
     <BsButton v-if="view.detail.canAmend" :disabled="view.pending" @click="emit('action','amend')">{{ copy.amend }}</BsButton>
     <BsButton v-if="view.detail.canWithdraw" :disabled="view.pending" @click="emit('action','withdraw')">{{ copy.withdraw }}</BsButton>
     <BsButton v-if="view.detail.canRelease" :disabled="view.pending" @click="emit('action','release')">{{ copy.release }}</BsButton>
     <BsButton v-if="view.detail.canExport" :disabled="view.pending" @click="emit('export')">{{ copy.export }}</BsButton>
    </BsInline>
    <BsAlert tone="info" :description="copy.privateNotes" />
    <BsStack v-if="view.reading" gap="md">
     <BsHeading :level="2">{{ copy.revision }} {{ view.reading.version }} · {{ view.reading.status }}</BsHeading>
     <BsDisclosure v-for="note in view.reading.notes" :key="note.label" :summary="note.label" :open="true"><BsText wrap="preserve">{{ note.value }}</BsText></BsDisclosure>
     <BsDisclosure :summary="copy.intake"><BsDataTable :value="view.reading.intake" :columns="intakeColumns" row-key="id" :label="copy.intake" /></BsDisclosure>
     <BsDisclosure :summary="copy.prescriptions"><BsDataTable :value="view.reading.prescriptions" :columns="prescriptionColumns" row-key="id" :label="copy.prescriptions" /></BsDisclosure>
     <BsDisclosure :summary="copy.orders"><BsDataTable :value="view.reading.orders" :columns="orderColumns" row-key="id" :label="copy.orders" /></BsDisclosure>
     <BsDisclosure :summary="copy.results"><BsDataTable :value="view.reading.results" :columns="resultColumns" row-key="id" :label="copy.results" /></BsDisclosure>
    </BsStack>
    <BsHeading :level="2">{{ copy.history }}</BsHeading>
    <BsDataTable :value="view.versions" :columns="historyColumns" row-key="id" :label="copy.history"><template #cell-open="{data}"><BsButton variant="text" :disabled="view.pending" @click="emit('readVersion',data.id)">{{ copy.open }} {{ data.revision }}</BsButton></template><template #cell-print="{data}"><BsButton v-if="data.canPrint" variant="text" :disabled="view.pending" @click="emit('print',data.id)">{{ copy.print }} {{ data.revision }}</BsButton></template></BsDataTable>
    <BsInline justify="between"><BsText>{{ view.historyPage*20+1 }}–{{ Math.min((view.historyPage+1)*20,view.historyTotal) }} / {{ view.historyTotal }}</BsText><BsInline><BsButton :disabled="view.pending || view.historyPage===0" @click="emit('historyPage',view.historyPage-1)">{{ copy.previous }}</BsButton><BsButton :disabled="view.pending || (view.historyPage+1)*20>=view.historyTotal" @click="emit('historyPage',view.historyPage+1)">{{ copy.next }}</BsButton></BsInline></BsInline>
    <BsHeading :level="2">{{ copy.releases }}</BsHeading><BsAlert v-if="view.recipientNotice" tone="warning" :description="view.recipientNotice" /><BsAlert tone="info" :description="copy.releaseNotice" />
    <BsDataTable :value="view.releases" :columns="releaseColumns" row-key="id" :label="copy.releases"><template #cell-open="{data}"><BsLink :to="data.href">{{ copy.open }}</BsLink></template><template #cell-revoke="{data}"><BsButton v-if="data.canRevoke" variant="text" :disabled="view.pending" @click="emit('action','revoke_release',data.id)">{{ copy.revoke }}</BsButton></template></BsDataTable>
    <BsHeading :level="2">{{ copy.document }}</BsHeading>
    <BsInline><BsLink :to="view.documentsHref">{{ copy.document }}</BsLink><BsButton v-if="view.canUpload" :disabled="view.pending" @click="emit('upload')">{{ copy.upload }}</BsButton></BsInline>
    <BsInline v-for="document in view.documents" :key="document.value" justify="between"><BsText>{{ document.label }}</BsText><BsButton variant="text" :disabled="view.pending" @click="emit('download',document.documentId,document.versionId)">{{ copy.download }}</BsButton></BsInline>
    <BsInline><BsButton :disabled="view.documentsLoading || view.documentsPage===0" @click="emit('documentsPage',view.documentsPage-1)">{{ copy.previous }}</BsButton><BsButton :disabled="view.documentsLoading || (view.documentsPage+1)*20>=view.documentsTotal" @click="emit('documentsPage',view.documentsPage+1)">{{ copy.next }}</BsButton></BsInline>
   </BsStack>
  </template>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="view.editor.disabled" size="lg" :pinned-actions="true" @submit="emit('save')">
   <BsAlert tone="warning" :description="copy.syntheticIdentity" />
   <BsField v-if="view.editor.creating" v-slot="field" :label="copy.patient" :required="true"><BsSelect :id="field.id" v-model="fields.patientId" :options="view.patients" option-label="label" option-value="value" :aria-describedby="field.describedby" :disabled="view.editor.pending" /></BsField>
   <BsTabs v-model="tab" :tabs="tabs" :label="copy.edit" />
   <BsStack v-if="tab==='note'" gap="md">
    <BsText>{{ copy.template }}</BsText>
    <BsField v-slot="field" :label="copy.note"><BsTextarea :id="field.id" v-model="fields.note" :aria-describedby="field.describedby" :maxlength="10000" :disabled="view.editor.pending" :rows="8" /></BsField>
    <BsField v-slot="field" :label="copy.reviewNote"><BsTextarea :id="field.id" v-model="fields.reviewNote" :aria-describedby="field.describedby" :maxlength="10000" :disabled="view.editor.pending" /></BsField>
   </BsStack>
   <BsStack v-else-if="tab==='intake'" gap="md">
    <BsButton :disabled="view.editor.pending" @click="emit('add','intake')">{{ copy.add }}: {{ copy.intake }}</BsButton>
    <BsFormSection v-for="(item,index) in fields.intake" :key="item.id" :title="`${copy.intake} ${index+1}`" :columns="2" :disabled="view.editor.pending">
     <BsField v-slot="field" :label="copy.kind"><BsSelect :id="field.id" v-model="item.kind" :options="choices.intakeKinds" option-label="label" option-value="value" /></BsField>
     <BsField v-slot="field" :label="copy.knowledge"><BsSelect :id="field.id" v-model="item.knowledge" :options="choices.knowledge" option-label="label" option-value="value" /></BsField>
     <BsField v-slot="field" :label="copy.source"><BsSelect :id="field.id" v-model="item.source" :options="choices.sources" option-label="label" option-value="value" /></BsField>
     <BsField v-slot="field" :label="copy.text"><BsTextarea :id="field.id" v-model="item.text" :maxlength="4000" /></BsField>
     <BsField v-slot="field" :label="copy.value"><BsInput :id="field.id" v-model="item.value" :maxlength="120" /></BsField><BsField v-slot="field" :label="copy.unit"><BsInput :id="field.id" v-model="item.unit" :maxlength="80" /></BsField>
     <BsButton variant="text" @click="emit('remove','intake',index)">{{ copy.remove }}</BsButton>
    </BsFormSection>
   </BsStack>
   <BsStack v-else-if="tab==='prescriptions'" gap="md">
    <BsButton :disabled="view.editor.pending" @click="emit('add','prescription')">{{ copy.add }}: {{ copy.prescriptions }}</BsButton>
    <BsFormSection v-for="(item,index) in fields.prescriptions" :key="item.id" :title="`${copy.prescriptions} ${index+1}`" :columns="2" :disabled="view.editor.pending">
     <BsField v-slot="field" :label="copy.identity"><BsInput :id="field.id" v-model="item.identity" :maxlength="200" /></BsField><BsField v-slot="field" :label="copy.name"><BsInput :id="field.id" v-model="item.name" :maxlength="200" /></BsField>
     <BsField v-slot="field" :label="copy.strength"><BsInput :id="field.id" v-model="item.strength" :maxlength="200" /></BsField><BsField v-slot="field" :label="copy.form"><BsInput :id="field.id" v-model="item.form" :maxlength="200" /></BsField>
     <BsField v-slot="field" :label="copy.amount"><BsInput :id="field.id" v-model="item.amount" inputmode="decimal" :maxlength="30" /></BsField><BsField v-slot="field" :label="copy.unit"><BsInput :id="field.id" v-model="item.unit" :maxlength="80" /></BsField>
     <BsField v-slot="field" :label="copy.route"><BsInput :id="field.id" v-model="item.route" :maxlength="120" /></BsField>
     <BsField v-slot="field" :label="copy.startDate"><BsInput :id="field.id" v-model="item.start" type="date" /></BsField><BsField v-slot="field" :label="copy.endDate"><BsInput :id="field.id" v-model="item.end" type="date" /></BsField>
     <BsField v-slot="field" :label="copy.instructions"><BsTextarea :id="field.id" v-model="item.instructions" :maxlength="4000" /></BsField>
     <BsButton variant="text" @click="emit('add','segment',index)">{{ copy.add }}: {{ copy.segments }}</BsButton>
     <BsFormSection v-for="(segment,segmentIndex) in item.segments" :key="segmentIndex" :title="`${copy.segments} ${segmentIndex+1}`" :columns="2">
      <BsField v-slot="field" :label="copy.kind"><BsSelect :id="field.id" v-model="segment.kind" :options="choices.segmentKinds" option-label="label" option-value="value" /></BsField>
      <BsField v-slot="field" :label="copy.startDate"><BsInput :id="field.id" v-model="segment.start" type="date" /></BsField><BsField v-slot="field" :label="copy.endDate"><BsInput :id="field.id" v-model="segment.end" type="date" /></BsField>
      <BsField v-slot="field" :label="copy.timezone"><BsInput :id="field.id" v-model="segment.timezone" :maxlength="120" /></BsField>
      <BsField v-slot="field" :label="copy.interval"><BsInput :id="field.id" v-model="segment.interval" inputmode="numeric" /></BsField><BsField v-slot="field" :label="copy.weekdays"><BsInput :id="field.id" v-model="segment.weekdays" /></BsField><BsField v-slot="field" :label="copy.times"><BsInput :id="field.id" v-model="segment.times" /></BsField>
      <BsField v-slot="field" :label="copy.instructions"><BsTextarea :id="field.id" v-model="segment.instructions" :maxlength="1000" /></BsField><BsButton variant="text" @click="emit('remove','segment',index,segmentIndex)">{{ copy.remove }}</BsButton>
     </BsFormSection>
     <BsButton variant="text" @click="emit('remove','prescription',index)">{{ copy.remove }}</BsButton>
    </BsFormSection>
   </BsStack>
   <BsStack v-else-if="tab==='orders'" gap="md">
    <BsButton :disabled="view.editor.pending" @click="emit('add','order')">{{ copy.add }}: {{ copy.orders }}</BsButton>
    <BsFormSection v-for="(item,index) in fields.orders" :key="item.id" :title="`${copy.orders} ${index+1}`" :columns="2" :disabled="view.editor.pending">
     <BsField v-slot="field" :label="copy.kind"><BsSelect :id="field.id" v-model="item.kind" :options="choices.orderKinds" option-label="label" option-value="value" /></BsField><BsField v-slot="field" :label="copy.status"><BsSelect :id="field.id" v-model="item.state" :options="choices.orderStates" option-label="label" option-value="value" /></BsField>
     <BsField v-slot="field" :label="copy.request"><BsTextarea :id="field.id" v-model="item.request" :maxlength="4000" /></BsField><BsField v-slot="field" :label="copy.due"><BsInput :id="field.id" v-model="item.due" placeholder="YYYY-MM-DDTHH:mm:ssZ" /></BsField><BsField v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" v-model="item.reason" :maxlength="500" /></BsField><BsButton variant="text" @click="emit('remove','order',index)">{{ copy.remove }}</BsButton>
    </BsFormSection>
   </BsStack>
   <BsStack v-else-if="tab==='results'" gap="md">
    <BsButton :disabled="view.editor.pending" @click="emit('add','result')">{{ copy.add }}: {{ copy.results }}</BsButton>
    <BsFormSection v-for="(item,index) in fields.results" :key="item.id" :title="`${copy.results} ${index+1}`" :columns="2" :disabled="view.editor.pending">
     <BsField v-slot="field" :label="copy.order"><BsSelect :id="field.id" v-model="item.orderId" :options="orderOptions" option-label="label" option-value="value" /></BsField>
     <BsField v-slot="field" :label="copy.document"><BsSelect :id="field.id" v-model="item.documentVersionId" :options="view.documents" option-label="label" option-value="value" /></BsField>
     <BsField v-slot="field" :label="copy.status"><BsSelect :id="field.id" v-model="item.stage" :options="choices.resultStages" option-label="label" option-value="value" /></BsField><BsField v-slot="field" :label="copy.annotation"><BsTextarea :id="field.id" v-model="item.annotation" :maxlength="4000" /></BsField><BsButton variant="text" @click="emit('remove','result',index)">{{ copy.remove }}</BsButton>
    </BsFormSection>
   </BsStack>
  </BsRecordActionDialog>
  <BsRecordActionDialog v-model:visible="confirmationOpen" :title="view.confirmation.title" :pending="view.confirmation.pending" :error="view.confirmation.error" :submit-label="copy.confirm" :cancel-label="copy.cancel" @submit="emit('confirm')">
   <BsText>{{ view.confirmation.description }}</BsText>
   <BsField v-if="view.confirmation.needsReason" v-slot="field" :label="copy.reason" :required="true"><BsTextarea :id="field.id" v-model="reason" :maxlength="500" /></BsField>
   <template v-if="view.confirmation.needsRecipient"><BsField v-slot="field" :label="copy.recipient" :required="true"><BsSelect :id="field.id" v-model="recipient" :options="view.recipients" option-label="label" option-value="value" /></BsField><BsField v-slot="field" :label="copy.expires" :required="true"><BsSelect :id="field.id" v-model="expires" :options="view.durations" option-label="label" option-value="value" /></BsField></template>
  </BsRecordActionDialog>
  <BsRecordActionDialog v-model:visible="uploadOpen" :title="copy.upload" :pending="view.upload.pending" :error="view.upload.error" :submit-label="copy.upload" :cancel-label="copy.cancel" :submit-disabled="!file" @submit="emit('saveUpload')"><BsField v-slot="field" :label="copy.document"><BsFileInput :id="field.id" v-model="file" accept="application/pdf,image/png,image/jpeg" :disabled="view.upload.pending" /></BsField></BsRecordActionDialog>
 </BsStack>
</template>
