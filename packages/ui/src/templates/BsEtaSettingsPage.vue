<script setup lang="ts">
import type { BsEtaCopy, BsEtaForm, BsEtaRow } from '../types/etaPresentation'
import type { BsDataTableColumn } from '@building-suit/ux'
const props = defineProps<{copy:BsEtaCopy;available:boolean;loading:boolean;error:boolean;pending:boolean;dirty:boolean;message:string;records:BsEtaRow[];canPrevious:boolean;canNext:boolean}>()
const form=defineModel<BsEtaForm>('form',{required:true})
const editor=defineModel<boolean>('editor',{required:true})
const invoice=defineModel<string>('invoice',{required:true})
const buyerName=defineModel<string>('buyerName',{required:true})
const buyerId=defineModel<string>('buyerId',{required:true})
const paymentMethod=defineModel<string>('paymentMethod',{required:true})
const emit=defineEmits<{edit:[];save:[];retry:[];queue:[];previous:[];next:[]}>()
const columns=computed<BsDataTableColumn<BsEtaRow>[]>(()=>[
{key:'invoice',field:'invoice',header:props.copy.invoice},{key:'state',field:'state',header:props.copy.status},
{key:'reference',field:'reference',header:props.copy.reference},{key:'help',field:'help',header:props.copy.details},
])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.help"><template #actions><BsButton v-if="available && !loading && !error" @click="emit('edit')">{{copy.edit}}</BsButton></template></BsPageHeader>
  <BsText v-if="loading" role="status">{{copy.loading}}</BsText>
  <BsBox v-else-if="error" role="alert"><BsText>{{copy.error}}</BsText><BsButton @click="emit('retry')">{{copy.retry}}</BsButton></BsBox>
  <BsText v-else-if="!available">{{copy.noContext}}</BsText>
  <template v-else>
   <BsText role="status">{{copy.setup}}</BsText>
   <BsText v-if="message" role="status">{{message}}</BsText>
   <BsPanel>
    <BsHeading :level="2">{{copy.queue}}</BsHeading>
    <BsForm @submit="emit('queue')">
     <BsField :label="copy.invoice"><BsInput v-model="invoice" required :aria-label="copy.invoice" /></BsField>
     <BsField :label="copy.buyerName"><BsInput v-model="buyerName" maxlength="100" :aria-label="copy.buyerName" /></BsField>
     <BsField :label="copy.buyerId"><BsInput v-model="buyerId" maxlength="14" :aria-label="copy.buyerId" /></BsField>
     <BsField :label="copy.paymentMethod"><BsSelect v-model="paymentMethod" :options="[{label:'C',value:'C'},{label:'V',value:'V'},{label:'O',value:'O'}]" option-label="label" option-value="value" :aria-label="copy.paymentMethod" /></BsField>
     <BsButton type="submit" :disabled="pending">{{copy.queue}}</BsButton>
    </BsForm>
   </BsPanel>
   <BsDataTable :value="records" :columns="columns" row-key="id" :label="copy.history"><template #empty><BsText>{{copy.empty}}</BsText></template></BsDataTable>
   <BsInline><BsButton :disabled="!canPrevious || loading" @click="emit('previous')">{{copy.previous}}</BsButton><BsButton :disabled="!canNext || loading" @click="emit('next')">{{copy.next}}</BsButton><BsButton @click="emit('retry')">{{copy.retry}}</BsButton></BsInline>
   <BsRecordActionDialog v-model:visible="editor" :title="copy.title" :dirty="dirty" :pending="pending" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
    <BsField :label="copy.legalName"><BsInput v-model="form.profile.legalName" required maxlength="200" :aria-label="copy.legalName" /></BsField>
    <BsField :label="copy.rin"><BsInput v-model="form.profile.rin" required pattern="[0-9]{9}" maxlength="9" :aria-label="copy.rin" /></BsField>
    <BsField :label="copy.activityCode"><BsInput v-model="form.profile.activityCode" required maxlength="10" :aria-label="copy.activityCode" /></BsField>
    <BsHeading :level="2">{{copy.branches}}</BsHeading>
    <BsPanel v-for="branch in form.branches" :key="branch.locationId">
     <BsHeading :level="3">{{branch.name}}</BsHeading><BsCheckbox v-model="branch.configured" :label="copy.configured" />
     <template v-if="branch.configured">
      <BsField :label="copy.branchCode"><BsInput v-model="branch.branchCode" required maxlength="50" :aria-label="copy.branchCode" /></BsField>
      <BsField :label="copy.deviceSerialNumber"><BsInput v-model="branch.deviceSerialNumber" required maxlength="100" :aria-label="copy.deviceSerialNumber" /></BsField>
      <BsField :label="copy.governate"><BsInput v-model="branch.address.governate" required maxlength="100" :aria-label="copy.governate" /></BsField>
      <BsField :label="copy.regionCity"><BsInput v-model="branch.address.regionCity" required maxlength="100" :aria-label="copy.regionCity" /></BsField>
      <BsField :label="copy.street"><BsInput v-model="branch.address.street" required maxlength="200" :aria-label="copy.street" /></BsField>
      <BsField :label="copy.buildingNumber"><BsInput v-model="branch.address.buildingNumber" required maxlength="100" :aria-label="copy.buildingNumber" /></BsField>
     </template>
    </BsPanel>
    <BsHeading :level="2">{{copy.items}}</BsHeading>
    <BsPanel v-for="item in form.items" :key="`${item.sourceType}:${item.sourceId}`">
     <BsHeading :level="3">{{item.name}}</BsHeading><BsCheckbox v-model="item.configured" :label="copy.configured" />
     <template v-if="item.configured">
      <BsField :label="copy.itemType"><BsSelect v-model="item.itemType" :options="[{label:'GS1',value:'GS1'},{label:'EGS',value:'EGS'}]" option-label="label" option-value="value" :aria-label="copy.itemType" /></BsField>
      <BsField :label="copy.itemCode"><BsInput v-model="item.itemCode" required maxlength="100" :aria-label="copy.itemCode" /></BsField>
      <BsField :label="copy.unitType"><BsInput v-model="item.unitType" required maxlength="30" :aria-label="copy.unitType" /></BsField>
     </template>
    </BsPanel>
    <BsField :label="copy.reason"><BsInput v-model="form.reason" required minlength="2" maxlength="1000" :aria-label="copy.reason" /></BsField>
   </BsRecordActionDialog>
  </template>
 </BsStack>
</template>
