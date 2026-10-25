<script setup lang="ts">
import type { BsOrderDeliveryForm, BsOrderDeliveryView } from '../types/tradeOrderPresentation'
const props = defineProps<{ view: BsOrderDeliveryView }>()
const page = defineModel<number>('page', { required: true })
const open = defineModel<boolean>('open', { required: true })
const form = defineModel<BsOrderDeliveryForm>('form', { required: true })
const emit = defineEmits<{ retry: []; collect: []; submit: [] }>()
function lineValue(id: string, key: 'quantity' | 'loss', value: string) { form.value = { ...form.value, lines: form.value.lines.map(line => line.id === id ? { ...line, [key]: value } : line) } }
const columns = computed(() => [{ key: 'name', field: 'name', header: props.view.title }, { key: 'ordered', field: 'ordered', header: props.view.quantity }, { key: 'delivered', field: 'delivered', header: props.view.delivered }, { key: 'remaining', field: 'remaining', header: props.view.remaining }, { key: 'held', field: 'held', header: props.view.held }])
const historyColumns = computed(() => [{ key: 'invoice', header: props.view.invoice }, { key: 'total', field: 'total', header: props.view.total }, { key: 'date', field: 'date', header: props.view.date }, { key: 'reason', field: 'reason', header: props.view.reason }, { key: 'actor', field: 'actor', header: props.view.actor }])
</script>
<template>
 <BsStack gap="md">
  <BsInline wrap gap="sm"><BsHeading :level="2">{{ view.title }}</BsHeading><BsButton variant="secondary" :disabled="view.locked" @click="emit('retry')">{{ view.retry }}</BsButton><BsButton v-if="view.canFulfill" :disabled="view.locked" @click="emit('collect')">{{ view.collect }}</BsButton></BsInline>
  <BsText as="p" tone="muted">{{ view.explanation }}</BsText>
  <BsText v-if="view.loading" role="status">{{ view.retry }}</BsText>
  <BsText v-else-if="view.error" role="alert">{{ view.error }}</BsText>
  <BsStack v-else gap="md"><BsDataTable :value="view.rows" :label="view.title" :columns="columns" data-key="id" /><BsDataTable :value="view.history" :label="view.historyTitle" :columns="historyColumns" data-key="id" lazy paginator :rows="20" :first="(page - 1) * 20" :total-records="view.eventCount" @page="page = $event.page + 1"><template #cell-invoice="{ row }"><BsLink :to="row.invoiceTo">{{ row.invoice }}</BsLink></template></BsDataTable></BsStack>
  <BsRecordActionDialog v-model:visible="open" :title="view.collect" :dirty="view.editor.dirty" :pending="view.editor.pending" :close-blocked="view.locked" :error="view.editor.error" :submit-label="view.collect" :cancel-label="view.close" @submit="emit('submit')">
   <BsText as="p" tone="muted">{{ view.explanation }}</BsText>
   <BsStack v-for="line in form.lines" :key="line.id" gap="sm">
    <BsText as="p">{{ line.summary }}</BsText>
    <BsField v-slot="field" :for="`order-collection-quantity-${line.id}`" :label="line.name"><BsInput :id="field.id" :model-value="line.quantity" inputmode="decimal" :disabled="view.locked" @update:model-value="lineValue(line.id, 'quantity', String($event))" /></BsField>
    <BsField v-if="line.reelTracked" v-slot="field" :for="`order-collection-loss-${line.id}`" :label="view.loss"><BsInput :id="field.id" :model-value="line.loss" inputmode="decimal" :disabled="view.locked" @update:model-value="lineValue(line.id, 'loss', String($event))" /></BsField>
   </BsStack>
   <BsCheckbox v-if="view.canApplyDeposits" :model-value="form.applyDeposits" :label="view.applyDeposits" :disabled="view.locked" @update:model-value="form = { ...form, applyDeposits: $event === true }" />
   <BsField v-slot="field" for="order-collection-reason" :label="view.reason"><BsTextarea :id="field.id" :model-value="form.reason" :disabled="view.locked" :minlength="3" :maxlength="1000" required @update:model-value="form = { ...form, reason: String($event) }" /></BsField>
  </BsRecordActionDialog>
 </BsStack>
</template>
