<script setup lang="ts">
import type { BsDataTableColumn } from '@building-suit/ux'
import type { BsServiceWorkCopy, BsServiceWorkForm, BsServiceWorkView, BsServiceWorkRow } from '../types/serviceFulfillmentPresentation'
const props = defineProps<{ copy: BsServiceWorkCopy; view: BsServiceWorkView; dirty: boolean; backTo: string }>()
const form = defineModel<BsServiceWorkForm>('form', { required: true })
const editor = defineModel<boolean>('editor', { required: true })
const emit = defineEmits<{ retry: []; save: []; edit: []; defineUnit: []; page: [offset: number]; retryOffline: [id: string]; reconcileOffline: [id: string] }>()
const columns = computed<BsDataTableColumn<BsServiceWorkRow>[]>(() => [
 { key: 'name', field: 'name', header: props.copy.service }, { key: 'quantity', field: 'quantity', header: props.copy.quantity },
 { key: 'detail', field: 'detail', header: props.copy.detail }, { key: 'date', field: 'date', header: props.copy.date },
])
const materialOptions = computed(() => props.view.materials.filter(item => item.unit).map(item => ({ ...item, label: `${item.name} (${item.unit})` })))
const newMaterialOptions = computed(() => props.view.materials.filter(item => !item.unit && item.canDefineUnit))
const unitProduct = ref<string | number | null>(null)
</script>
<template>
 <BsStack gap="lg">
  <BsLink :to="backTo">{{ copy.back }}</BsLink>
  <BsPageHeader :title="copy.title" :subtitle="copy.help"><template #actions><BsButton v-if="view.available && !view.loading && !view.error" :disabled="view.pending" @click="emit('edit')">{{ view.saleMode ? copy.complete : copy.configure }}</BsButton></template></BsPageHeader>
  <BsOfflineCounterStatus v-if="view.saleMode" :view="view.offline" @retry="emit('retryOffline', $event)" @reconcile="emit('reconcileOffline', $event)" />
  <BsText v-if="view.success" role="status">{{ view.success }}</BsText>
  <BsText v-if="view.actionError && !editor" role="alert">{{ view.actionError }}</BsText>
  <BsText v-if="view.loading" role="status">{{ copy.loading }}</BsText>
  <BsBox v-else-if="view.error" role="alert"><BsText>{{ copy.error }}</BsText><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsBox>
  <BsText v-else-if="!view.available">{{ copy.noContext }}</BsText>
  <template v-else>
   <BsRecordActionDialog v-model:visible="editor" :title="view.saleMode ? copy.complete : copy.configure" :dirty="dirty" :pending="view.pending" :error="view.actionError || undefined" :submit-label="copy.save" @submit="emit('save')">
    <BsSelect v-model="form.target" :label="copy.service" :options="view.choices" option-label="name" option-value="id" required />
    <BsField v-if="view.saleMode" :label="copy.quantity"><BsInput v-model="form.quantity" type="number" min="0.01" max="1000000" step="0.01" required :aria-label="copy.quantity" /></BsField>
    <BsField v-else :label="copy.effectiveAt"><BsInput v-model="form.effectiveAt" type="datetime-local" :aria-label="copy.effectiveAt" /><BsText>{{ copy.immediate }}</BsText></BsField>
    <BsCheckbox v-if="view.saleMode && view.manager" v-model="form.override" :label="copy.override" />
    <BsStack v-if="!view.saleMode || (view.manager && form.override)">
     <BsPanel v-for="(item, index) in form.materials" :key="index">
      <BsSelect v-model="item.productId" :label="copy.product" :options="materialOptions" option-label="label" option-value="id" required />
      <BsField :label="copy.quantity"><BsInput v-model="item.quantity" type="number" min="0.01" max="1000000" step="0.01" required :aria-label="copy.quantity" /></BsField>
      <BsButton type="button" @click="form.materials.splice(index, 1)">{{ copy.remove }}</BsButton>
     </BsPanel>
     <BsButton type="button" @click="form.materials.push({ productId: '', quantity: '1' })">{{ copy.add }}</BsButton>
    </BsStack>
    <BsField :label="copy.reason"><BsInput v-model="form.reason" required minlength="2" maxlength="1000" :aria-label="copy.reason" /></BsField>
   </BsRecordActionDialog>
   <BsPanel v-if="view.manager && !view.saleMode">
    <BsHeading :level="2">{{ copy.defineUnit }}</BsHeading>
    <BsSelect v-model="unitProduct" :label="copy.product" :options="newMaterialOptions" option-label="name" option-value="id" />
    <BsSelect v-model="form.unit" :label="copy.unit" :options="[{ id: 'each' }, { id: 'mL' }, { id: 'g' }]" option-label="id" option-value="id" />
    <BsButton :disabled="view.pending || !unitProduct" @click="form.target = String(unitProduct); emit('defineUnit')">{{ copy.defineUnit }}</BsButton>
   </BsPanel>
   <BsDataTable :value="view.records" :columns="columns" row-key="id" :label="copy.history" lazy paginator :rows="50" :first="view.first" :total-records="view.totalRecords" @page="emit('page', $event.first)" />
  </template>
 </BsStack>
</template>
