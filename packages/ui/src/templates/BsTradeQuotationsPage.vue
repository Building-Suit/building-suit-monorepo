<script setup lang="ts">
import type { BsQuotationCopy, BsQuotationView, BsQuotationRow, BsQuotationForm, BsQuotationFormLine, BsQuotationLineView, BsQuotationPicker } from '../types/tradeQuotationPresentation'
const props = defineProps<{ copy: BsQuotationCopy; view: BsQuotationView; rows: BsQuotationRow[]; customerPicker: BsQuotationPicker; lineViews: BsQuotationLineView[] }>()
const search = defineModel<string>('search', { required: true })
const page = defineModel<number>('page', { required: true })
const historyPage = defineModel<number>('historyPage', { required: true })
const editorOpen = defineModel<boolean>('editorOpen', { required: true })
const detailOpen = defineModel<boolean>('detailOpen', { required: true })
const form = defineModel<BsQuotationForm>('form', { required: true })
const reason = defineModel<string>('reason', { required: true })
const emit = defineEmits<{ retry: []; add: []; open: [id: string]; edit: []; revise: []; submit: []; action: [id: string]; print: []; version: [id: string]; currentVersion: []; retryDetail: []; addLine: [kind: 'product' | 'service']; removeLine: [key: string]; source: [key: string, value: string]; pickerSearch: [kind: string, query: string]; pickerMore: [kind: string]; pickerRetry: [kind: string] }>()
function change<K extends keyof BsQuotationForm>(key: K, value: BsQuotationForm[K]) { form.value = { ...form.value, [key]: value } }
function lineChange<K extends keyof BsQuotationFormLine>(id: string, key: K, value: BsQuotationFormLine[K]) { change('lines', form.value.lines.map(line => line.key === id ? { ...line, [key]: value } : line)) }
const locked = computed(() => props.view.editor.pending || props.view.editor.locked)
const columns = computed(() => [{ key: 'number', field: 'number', header: props.copy.number }, { key: 'customer', field: 'customer', header: props.copy.customer }, { key: 'project', field: 'project', header: props.copy.project }, { key: 'status', field: 'status', header: props.copy.status }, { key: 'version', field: 'version', header: props.copy.version }, { key: 'validity', field: 'validity', header: props.copy.validity }, { key: 'total', field: 'total', header: props.copy.total }, { key: 'actions', header: props.copy.actions }])
const lineColumns = computed(() => [{ key: 'name', field: 'name', header: props.copy.lines }, { key: 'quantity', field: 'quantity', header: props.copy.quantity }, { key: 'price', field: 'price', header: props.copy.price }, { key: 'total', field: 'total', header: props.copy.total }])
const historyColumns = computed(() => [{ key: 'version', field: 'version', header: props.copy.version }, { key: 'status', field: 'status', header: props.copy.status }, { key: 'reason', field: 'reason', header: props.copy.reason }, { key: 'actor', field: 'actor', header: props.copy.actor }, { key: 'date', field: 'date', header: props.copy.date }, { key: 'total', field: 'total', header: props.copy.total }, { key: 'actions', header: props.copy.actions }])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"><template #actions><BsButton v-if="view.available && view.canCreate" @click="emit('add')">{{ copy.add }}</BsButton></template></BsPageHeader>
  <BsPanel v-if="!view.available" padding="md"><BsText as="p">{{ copy.noShop }}</BsText></BsPanel>
  <BsPanel v-else padding="md">
   <BsDataTable :value="rows" :label="copy.title" :columns="columns" data-key="id" :loading="view.loading" :error="view.error || null" searchable :search-label="copy.search" lazy paginator :rows="view.pageSize" :first="(page - 1) * view.pageSize" :total-records="view.total" @search="search = $event" @page="page = $event.page + 1" @retry="emit('retry')">
    <template #cell-actions="{ row }"><BsButton variant="secondary" :disabled="view.locked" @click="emit('open', row.id)">{{ copy.open }}</BsButton></template>
    <template #empty><BsText as="p">{{ copy.empty }}</BsText></template>
   </BsDataTable>
  </BsPanel>
  <BsDialog v-model:visible="detailOpen" :title="view.detail.title || copy.title" :pending="view.detail.pending || view.detail.locked || editorOpen" size="lg">
   <BsText v-if="view.detail.loading" role="status">{{ copy.retry }}</BsText>
   <BsStack v-else-if="view.detail.error"><BsText role="alert">{{ view.detail.error }}</BsText><BsButton @click="emit('retryDetail')">{{ copy.retry }}</BsButton></BsStack>
   <BsStack v-else>
    <BsText v-if="view.detail.actionError" role="alert">{{ view.detail.actionError }}</BsText>
    <BsText as="p">{{ view.detail.subtitle }}</BsText><BsText as="p">{{ view.detail.status }}</BsText><BsText as="p" tone="muted">{{ view.detail.notice }}</BsText>
    <BsInline wrap><BsLink v-if="view.detail.relatedAction" :to="view.detail.relatedAction.to">{{ view.detail.relatedAction.label }}</BsLink><BsButton v-if="view.detail.canEdit" :disabled="view.detail.pending" @click="emit('edit')">{{ copy.edit }}</BsButton><BsButton v-if="view.detail.canRevise" :disabled="view.detail.pending" @click="emit('revise')">{{ copy.revise }}</BsButton><BsButton :disabled="view.detail.pending" @click="emit('print')">{{ copy.print }}</BsButton><BsButton variant="secondary" @click="emit('currentVersion')">{{ copy.currentVersion }}</BsButton></BsInline>
    <BsDataTable :value="view.detail.lines" :label="copy.lines" :columns="lineColumns" data-key="id" />
    <BsDescriptionList><BsDescriptionItem v-for="total in view.detail.totals" :key="total.label" :term="total.label">{{ total.value }}</BsDescriptionItem></BsDescriptionList>
    <BsField v-if="view.detail.actions.length" v-slot="field" for="quotation-action-reason" :label="copy.reason"><BsTextarea :id="field.id" v-model="reason" :disabled="view.detail.pending || view.detail.locked" :minlength="3" :maxlength="1000" required /></BsField>
    <BsInline wrap><BsButton v-for="action in view.detail.actions" :key="action.id" :disabled="view.detail.pending" @click="emit('action', action.id)">{{ action.label }}</BsButton></BsInline>
    <BsDataTable :value="view.detail.history" :label="copy.history" :columns="historyColumns" data-key="id" lazy paginator :rows="10" :first="(historyPage - 1) * 10" :total-records="view.detail.versionCount" @page="historyPage = $event.page + 1"><template #cell-actions="{ row }"><BsButton variant="secondary" @click="emit('version', row.id)">{{ copy.open }}</BsButton></template></BsDataTable>
    <BsDataTable :value="view.detail.events" :label="copy.events" :columns="historyColumns.filter(column => column.key !== 'actions')" data-key="id" lazy paginator :rows="10" :first="(historyPage - 1) * 10" :total-records="view.detail.eventCount" @page="historyPage = $event.page + 1" />
   </BsStack>
   <template #footer><BsButton :disabled="view.detail.pending || view.detail.locked || editorOpen" @click="detailOpen = false">{{ copy.close }}</BsButton></template>
  </BsDialog>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-label="copy.save" :cancel-label="copy.cancel" size="lg" @submit="emit('submit')">
   <BsEntityPicker :model-value="form.customerId" :label="copy.customer" :options="customerPicker.options" :disabled="locked" option-label="name" option-value="id" :loading="customerPicker.loading" :error="customerPicker.error" :has-more="customerPicker.hasMore" :load-more-label="customerPicker.more" :retry-label="customerPicker.retry" @search="emit('pickerSearch', 'customer', $event)" @retry="emit('pickerRetry', 'customer')" @load-more="emit('pickerMore', 'customer')" @update:model-value="change('customerId', String($event ?? ''))" />
   <BsGrid :columns="2">
    <BsField v-slot="field" for="quotation-project" :label="copy.project"><BsInput :id="field.id" :model-value="form.projectReference" :disabled="locked" :maxlength="200" @update:model-value="change('projectReference', String($event))" /></BsField>
    <BsField v-slot="field" for="quotation-validity" :label="copy.validity"><BsInput :id="field.id" :model-value="form.validUntil" type="datetime-local" :disabled="locked" required @update:model-value="change('validUntil', String($event))" /></BsField>
   </BsGrid>
   <BsStack v-for="(line, index) in form.lines" :key="line.key">
    <BsHeading :level="3">{{ line.itemType === 'service' ? copy.service : copy.product }} {{ index + 1 }}</BsHeading>
    <BsEntityPicker :model-value="line.sourceId" :label="lineViews[index]?.sourceLabel || copy.product" :options="lineViews[index]?.picker.options || []" :disabled="locked || lineViews[index]?.loading" option-label="name" option-value="id" :loading="lineViews[index]?.picker.loading" :error="lineViews[index]?.picker.error" :has-more="lineViews[index]?.picker.hasMore" :load-more-label="lineViews[index]?.picker.more || copy.next" :retry-label="lineViews[index]?.picker.retry || copy.retry" @search="emit('pickerSearch', line.itemType, $event)" @retry="emit('pickerRetry', line.itemType)" @load-more="emit('pickerMore', line.itemType)" @update:model-value="emit('source', line.key, String($event ?? ''))" />
    <BsGrid :columns="2"><BsField v-slot="field" :for="`quotation-quantity-${line.key}`" :label="copy.quantity"><BsInput :id="field.id" :model-value="line.quantity" inputmode="decimal" :disabled="locked" required @update:model-value="lineChange(line.key, 'quantity', String($event))" /></BsField><BsField v-if="line.itemType === 'product'" v-slot="field" :label="copy.unit"><BsSelect :input-id="field.id" :model-value="line.unit" :label="copy.unit" :options="lineViews[index]?.units || []" option-label="label" option-value="value" :disabled="locked || lineViews[index]?.loading" @update:model-value="lineChange(line.key, 'unit', String($event ?? ''))" /></BsField></BsGrid>
    <BsPriceApprovalFields v-if="lineViews[index]?.approval" :approval="lineViews[index]!.approval!" :record-id="line.key" :disabled="locked" @price="lineChange(line.key, 'overridePrice', $event)" @reason="lineChange(line.key, 'overrideReason', $event)" />
    <BsButton variant="text" :disabled="locked" @click="emit('removeLine', line.key)">{{ copy.remove }}</BsButton>
   </BsStack>
   <BsInline wrap><BsButton v-if="view.editor.canProducts" :disabled="locked" @click="emit('addLine', 'product')">{{ copy.addProduct }}</BsButton><BsButton v-if="view.editor.canServices" :disabled="locked" @click="emit('addLine', 'service')">{{ copy.addService }}</BsButton></BsInline>
   <BsField v-slot="field" for="quotation-discount" :label="copy.discount"><BsInput :id="field.id" :model-value="form.orderDiscount" inputmode="decimal" :disabled="locked" @update:model-value="change('orderDiscount', String($event))" /></BsField>
   <BsField v-slot="field" for="quotation-notes" :label="copy.notes"><BsTextarea :id="field.id" :model-value="form.notes" :disabled="locked" :maxlength="2000" @update:model-value="change('notes', String($event))" /></BsField>
   <BsField v-slot="field" for="quotation-save-reason" :label="copy.reason"><BsTextarea :id="field.id" :model-value="form.reason" :disabled="locked" :minlength="3" :maxlength="1000" required @update:model-value="change('reason', String($event))" /></BsField>
  </BsRecordActionDialog>
 </BsStack>
</template>
