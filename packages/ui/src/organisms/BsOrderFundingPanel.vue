<script setup lang="ts">
import type { BsOrderFundingForm, BsOrderFundingView } from '../types/tradeOrderPresentation'
const props = defineProps<{ view: BsOrderFundingView }>()
const page = defineModel<number>('page', { required: true })
const historyPage = defineModel<number>('historyPage', { required: true })
const open = defineModel<boolean>('open', { required: true })
const form = defineModel<BsOrderFundingForm>('form', { required: true })
const emit = defineEmits<{ retry: []; action: [action: 'receive' | 'apply' | 'refund' | 'reverse', id?: string]; submit: []; invoiceSearch: [query: string]; invoiceMore: []; invoiceRetry: [] }>()
function change<K extends keyof BsOrderFundingForm>(key: K, value: BsOrderFundingForm[K]) { form.value = { ...form.value, [key]: value } }
const columns = computed(() => [{ key: 'date', field: 'date', header: props.view.date }, { key: 'amount', field: 'amount', header: props.view.amount }, { key: 'available', field: 'available', header: props.view.available }, { key: 'applied', field: 'applied', header: props.view.applied }, { key: 'method', field: 'method', header: props.view.method }, { key: 'reference', field: 'reference', header: props.view.reference }, { key: 'actions', header: props.view.actions }])
const eventColumns = computed(() => [{ key: 'action', field: 'action', header: props.view.actions }, { key: 'amount', field: 'amount', header: props.view.amount }, { key: 'date', field: 'date', header: props.view.date }, { key: 'reason', field: 'reason', header: props.view.reason }, { key: 'actor', field: 'actor', header: props.view.actor }, { key: 'invoice', header: props.view.invoice }])
</script>
<template>
 <BsStack gap="md">
  <BsInline wrap gap="sm"><BsHeading :level="2">{{ view.title }}</BsHeading><BsButton v-if="!view.denied" variant="secondary" :disabled="view.locked" @click="emit('retry')">{{ view.retry }}</BsButton><BsButton v-if="view.canReceive" :disabled="view.locked" @click="emit('action', 'receive')">{{ view.receive }}</BsButton></BsInline>
  <BsText as="p" tone="muted">{{ view.explanation }}</BsText>
  <BsText v-if="view.loading" role="status">{{ view.retry }}</BsText>
  <BsText v-else-if="view.error" role="alert">{{ view.error }}</BsText>
  <BsStack v-else gap="md">
   <BsDescriptionList><BsDescriptionItem v-for="item in view.summaries" :key="item.label" :term="item.label">{{ item.value }}</BsDescriptionItem></BsDescriptionList>
   <BsDataTable :value="view.rows" :label="view.title" :columns="columns" data-key="id" lazy paginator :rows="20" :first="(page - 1) * 20" :total-records="view.total" @page="page = $event.page + 1"><template #cell-actions="{ row }"><BsInline wrap gap="sm"><BsButton v-if="row.canApply" variant="secondary" :disabled="view.locked" @click="emit('action', 'apply', row.id)">{{ view.apply }}</BsButton><BsButton v-if="row.canRefund" variant="secondary" :disabled="view.locked" @click="emit('action', 'refund', row.id)">{{ view.refund }}</BsButton><BsButton v-if="row.canReverse" variant="secondary" :disabled="view.locked" @click="emit('action', 'reverse', row.id)">{{ view.reverse }}</BsButton></BsInline></template></BsDataTable>
   <BsDataTable :value="view.events" :label="view.historyTitle" :columns="eventColumns" data-key="id" lazy paginator :rows="20" :first="(historyPage - 1) * 20" :total-records="view.eventCount" @page="historyPage = $event.page + 1"><template #cell-invoice="{ row }"><BsLink v-if="row.invoiceTo" :to="row.invoiceTo">{{ view.invoice }}</BsLink></template></BsDataTable>
  </BsStack>
  <BsRecordActionDialog v-model:visible="open" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :close-blocked="view.locked" :error="view.editor.error" :submit-label="view.editor.title" :cancel-label="view.close" @submit="emit('submit')">
   <BsText v-if="view.editor.summary" as="p">{{ view.editor.summary }}</BsText><BsText as="p" tone="muted">{{ view.editor.explanation }}</BsText>
   <BsEntityPicker v-if="view.editor.needsInvoice" :model-value="form.invoiceId" :label="view.invoice" :options="view.invoicePicker.options" option-label="name" option-value="id" :loading="view.invoicePicker.loading" :error="view.invoicePicker.error" :has-more="view.invoicePicker.hasMore" :load-more-label="view.invoicePicker.more" :retry-label="view.invoicePicker.retry" :disabled="view.locked" @search="emit('invoiceSearch', $event)" @load-more="emit('invoiceMore')" @retry="emit('invoiceRetry')" @update:model-value="change('invoiceId', String($event ?? ''))" />
   <BsField v-slot="field" for="order-deposit-amount" :label="view.amount"><BsInput :id="field.id" :model-value="form.amount" inputmode="decimal" :disabled="view.locked" required @update:model-value="change('amount', String($event))" /></BsField>
   <BsField v-slot="field" for="order-deposit-date" :label="view.date"><BsInput :id="field.id" :model-value="form.at" type="datetime-local" :disabled="view.locked" required @update:model-value="change('at', String($event))" /></BsField>
   <BsField v-if="view.editor.needsMethod" v-slot="field" for="order-deposit-method" :label="view.method"><BsSelect :input-id="field.id" :model-value="form.method" :label="view.method" :options="view.methodOptions" option-label="label" option-value="value" :disabled="view.locked" @update:model-value="change('method', String($event))" /></BsField>
   <BsField v-slot="field" for="order-deposit-reference" :label="view.reference"><BsInput :id="field.id" :model-value="form.reference" :disabled="view.locked" :maxlength="200" @update:model-value="change('reference', String($event))" /></BsField>
   <BsField v-slot="field" for="order-deposit-reason" :label="view.reason"><BsTextarea :id="field.id" :model-value="form.reason" :disabled="view.locked" :minlength="3" :maxlength="1000" required @update:model-value="change('reason', String($event))" /></BsField>
  </BsRecordActionDialog>
 </BsStack>
</template>
