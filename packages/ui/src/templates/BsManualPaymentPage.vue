<script setup lang="ts">
import type{BsManualPaymentValues,BsManualPaymentView}from'../types/manualPaymentPresentation'
const props=defineProps<{view:BsManualPaymentView;values:BsManualPaymentValues}>()
const emit=defineEmits<{'update:values':[values:BsManualPaymentValues];choose:[];prepare:[];submit:[];upload:[];skipReceipt:[];retry:[];retryOperation:[];select:[id:string];review:[action:'under_review'|'rejected'|'funds_verified'];activate:[];download:[id:string];page:[page:number]}>()
const copy=computed(()=>props.view.copy)
const columns=computed(()=>[{key:'id',field:'id' as const,header:copy.value.id},{key:'reference',field:'reference' as const,header:copy.value.reference},{key:'amount',field:'amount' as const,header:copy.value.amount},{key:'status',field:'status' as const,header:copy.value.status},{key:'open',header:copy.value.open}])
function update<K extends keyof BsManualPaymentValues>(field:K,value:BsManualPaymentValues[K]){emit('update:values',{...props.values,[field]:value})}
const submitVisible=ref(false)
watch(()=>props.view.instructions.length,count=>{if(!count)submitVisible.value=false})
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.description" />
  <BsAlert tone="info" :description="copy.notice" />
  <BsAlert v-if="view.error" tone="error" :description="view.error" />
  <BsAlert v-if="view.uncertain" tone="warning" :description="copy.uncertain" />
  <BsButton v-if="view.uncertain" :disabled="view.pending" @click="emit('retryOperation')">{{ copy.retryOperation }}</BsButton>
  <BsStateSurface v-if="view.loading" state="loading" :title="copy.loading" />
  <template v-else-if="view.ready">
   <template v-if="!view.review">
    <BsAlert v-if="!view.configured" tone="info" :description="copy.unconfigured" />
    <BsPanel v-if="!view.instructions.length && !view.uploadPending" padding="md"><BsStack>
     <BsField v-slot="field" :label="copy.plan"><BsSelect :id="field.id" :model-value="values.plan" :label="copy.plan" :options="view.plans" option-label="label" option-value="value" :disabled="view.pending || view.uncertain" @update:model-value="update('plan',String($event));emit('choose')" /></BsField>
     <BsField v-slot="field" :label="copy.interval"><BsSelect :id="field.id" :model-value="values.interval" :label="copy.interval" :options="[{value:'monthly',label:copy.monthly},{value:'yearly',label:copy.yearly}]" option-label="label" option-value="value" :disabled="view.pending || view.uncertain" @update:model-value="update('interval',String($event));emit('choose')" /></BsField>
     <BsDescriptionList><BsDescriptionItem v-for="f in view.terms" :key="f.label" :term="f.label">{{ f.value }}</BsDescriptionItem></BsDescriptionList>
     <BsPanel v-if="view.document" padding="md"><BsHeading :level="2">{{ copy.terms }}</BsHeading><BsText v-for="(p,i) in view.document.split(/\n\s*\n/)" :key="i" as="p">{{ p }}</BsText></BsPanel>
     <BsCheckbox :model-value="values.accepted" :label="copy.accept" :disabled="view.pending || view.uncertain || !view.document" @update:model-value="update('accepted',Boolean($event))" />
     <BsButton :disabled="!view.canPrepare" :pending="view.pending" @click="emit('prepare')">{{ copy.prepare }}</BsButton>
    </BsStack></BsPanel>
    <BsPanel v-if="view.instructions.length" padding="md"><BsStack><BsHeading :level="2">{{ copy.instructions }}</BsHeading><BsDescriptionList><BsDescriptionItem v-for="f in view.instructions" :key="f.label" :term="f.label">{{ f.value }}</BsDescriptionItem></BsDescriptionList><BsAlert tone="info" :description="copy.claimOnly"/><BsButton :disabled="view.pending || view.uncertain" @click="submitVisible=true">{{ copy.submit }}</BsButton></BsStack></BsPanel>
    <BsRecordActionDialog v-model:visible="submitVisible" :title="copy.submit" :pending="view.pending" :dirty="Boolean(values.reference || values.at)" :submit-label="copy.submit" :submit-disabled="!view.canSubmit" :cancel-label="copy.cancel" :error="view.error" @submit="emit('submit')">
     <BsField v-slot="field" :label="copy.reference" required><BsInput :id="field.id" :model-value="values.reference" required maxlength="200" :disabled="view.uncertain" @update:model-value="update('reference',String($event))" /></BsField>
     <BsField v-slot="field" :label="copy.at" required><BsInput :id="field.id" type="datetime-local" :model-value="values.at" required :disabled="view.uncertain" @update:model-value="update('at',String($event))" /></BsField>
     <BsText as="p">{{ copy.claimOnly }}</BsText>
    </BsRecordActionDialog>
    <BsPanel v-if="view.uploadPending" padding="md"><BsStack><BsAlert tone="success" :description="copy.uploadPending"/><BsFileInput :label="copy.receipt" :model-value="values.file" accept="application/pdf,image/png,image/jpeg" :disabled="view.pending || view.uncertain" @update:model-value="update('file',Array.isArray($event)?null:$event)" /><BsText as="p">{{ copy.receiptHelp }}</BsText><BsButton :disabled="!view.canUpload" :pending="view.pending" @click="emit('upload')">{{ copy.upload }}</BsButton><BsButton :disabled="view.pending || view.uncertain" @click="emit('skipReceipt')">{{ copy.skipReceipt }}</BsButton></BsStack></BsPanel>
   </template>
   <BsDataTable v-if="view.rows.length" :value="view.rows" :columns="columns" row-key="id"><template #cell-open="{data}"><BsButton :disabled="view.pending || view.uncertain" @click="emit('select',data.id)">{{ copy.open }}</BsButton></template></BsDataTable>
   <BsEmptyState v-else :title="copy.empty" />
   <BsInline><BsButton :disabled="view.page<2 || view.pending || view.uncertain" @click="emit('page',view.page-1)">{{ copy.previous }}</BsButton><BsText>{{ view.page }}</BsText><BsButton :disabled="view.page*25>=view.total || view.pending || view.uncertain" @click="emit('page',view.page+1)">{{ copy.next }}</BsButton></BsInline>
   <BsPanel v-if="view.selected" padding="md"><BsStack><BsHeading :level="2">{{ copy.details }}</BsHeading><BsDescriptionList><BsDescriptionItem v-for="f in view.selected.fields" :key="f.label" :term="f.label">{{ f.value }}</BsDescriptionItem></BsDescriptionList>
    <BsButton v-for="e in view.selected.evidence" :key="e.id" :disabled="view.pending" @click="emit('download',e.id)">{{ e.label }}</BsButton>
    <BsHeading :level="3">{{ copy.history }}</BsHeading><BsText v-for="h in view.selected.history" :key="h.title" as="p">{{ h.title }} — {{ h.description }}</BsText>
    <template v-if="view.selected.canReview">
     <BsField v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" :model-value="values.reason" maxlength="500" :disabled="view.pending || view.uncertain" @update:model-value="update('reason',String($event))" /></BsField>
     <BsInline><BsButton :disabled="view.pending || view.uncertain || !values.reason.trim()" @click="emit('review','under_review')">{{ copy.underReview }}</BsButton><BsButton :disabled="view.pending || view.uncertain || !values.reason.trim()" @click="emit('review','rejected')">{{ copy.reject }}</BsButton></BsInline>
     <BsForm :pending="view.pending" @submit="emit('review','funds_verified')">
      <BsField v-slot="f" :label="copy.receivedReference" required><BsInput :id="f.id" :model-value="values.receivedReference" required maxlength="200" @update:model-value="update('receivedReference',String($event))" /></BsField>
      <BsField v-slot="f" :label="copy.receivedAmount" required><BsInput :id="f.id" :model-value="values.receivedAmount" required inputmode="decimal" @update:model-value="update('receivedAmount',String($event))" /></BsField>
      <BsField v-slot="f" :label="copy.receivedCurrency" required><BsInput :id="f.id" :model-value="values.receivedCurrency" required maxlength="3" @update:model-value="update('receivedCurrency',String($event))" /></BsField>
      <BsField v-slot="f" :label="copy.receivedAt" required><BsInput :id="f.id" type="datetime-local" :model-value="values.receivedAt" required @update:model-value="update('receivedAt',String($event))" /></BsField>
      <BsField v-slot="f" :label="copy.verification" required><BsInput :id="f.id" :model-value="values.verification" required maxlength="200" @update:model-value="update('verification',String($event))" /></BsField>
      <BsCheckbox :model-value="values.independent" :label="copy.independent" @update:model-value="update('independent',Boolean($event))" />
      <BsButton type="submit" :disabled="!view.selected.canVerify || view.uncertain" :pending="view.pending">{{ copy.verifyFunds }}</BsButton>
     </BsForm>
    </template>
    <BsAlert v-if="view.review" tone="info" :description="copy.activationNotice" /><BsButton v-if="view.selected.canActivate" :disabled="view.pending || view.uncertain" @click="emit('activate')">{{ copy.activate }}</BsButton>
   </BsStack></BsPanel>
  </template>
  <BsInline><BsButton :disabled="view.pending" @click="emit('retry')">{{ copy.retry }}</BsButton><BsLink to="/account">{{ copy.account }}</BsLink><BsLink v-if="view.canReview && !view.review" to="/payment-review">{{ copy.review }}</BsLink><BsLink v-if="view.review" to="/payment-notices">{{ copy.customer }}</BsLink></BsInline>
 </BsStack>
</template>
