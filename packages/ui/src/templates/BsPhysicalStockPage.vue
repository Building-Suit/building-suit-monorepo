<script setup lang="ts">
import type { BsPhysicalStockCopy, BsPhysicalStockView, BsPhysicalStockRow, BsPhysicalStockEvent, BsPhysicalStockForm, BsPhysicalStockPicker } from '../types/physicalInventoryPresentation'
const props = defineProps<{ copy: BsPhysicalStockCopy; view: BsPhysicalStockView; rows: BsPhysicalStockRow[]; events: BsPhysicalStockEvent[]; productPicker: BsPhysicalStockPicker; classifications: { value: string; label: string; disabled?: boolean }[] }>()
const productId = defineModel<string>('productId', { required: true })
const search = defineModel<string>('search', { required: true })
const page = defineModel<number>('page', { required: true })
const historyPage = defineModel<number>('historyPage', { required: true })
const editorOpen = defineModel<boolean>('editorOpen', { required: true })
const form = defineModel<BsPhysicalStockForm>('form', { required: true })
const emit = defineEmits<{ retry: []; export: []; history: [id: string]; count: [id: string]; classify: [id: string]; archive: [id: string]; submit: []; productSearch: [query: string]; productMore: []; productRetry: [] }>()
function change<K extends keyof BsPhysicalStockForm>(key: K, value: BsPhysicalStockForm[K]) { form.value = { ...form.value, [key]: value } }
const columns = computed(() => [{ key: 'name', header: props.copy.product, field: 'name' }, { key: 'barcode', header: props.copy.barcode, field: 'barcode' }, { key: 'original', header: props.copy.original, field: 'original', align: 'end' as const }, { key: 'remaining', header: props.copy.remaining, field: 'remaining', align: 'end' as const }, { key: 'reserved', header: props.copy.reserved, field: 'reserved', align: 'end' as const }, { key: 'status', header: props.copy.status, field: 'status' }, { key: 'classification', header: props.copy.classification, field: 'classification' }, { key: 'position', header: props.copy.position, field: 'position' }, ...(props.view.canViewCosts ? [{ key: 'value', header: props.copy.value, field: 'value', align: 'end' as const }] : []), { key: 'actions', header: props.copy.actions }])
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"><template #actions><BsInline><BsLink to="/inventory">{{ copy.inventory }}</BsLink><BsLink to="/purchases">{{ copy.purchases }}</BsLink><BsButton v-if="view.available" variant="secondary" :pending="view.exporting" :disabled="view.loading || Boolean(view.error) || !view.total" @click="emit('export')">{{ copy.export }}</BsButton></BsInline></template></BsPageHeader>
    <BsPanel v-if="!view.available" padding="md"><BsText as="p">{{ copy.noShop }}</BsText><BsLink to="/dashboard">{{ copy.dashboard }}</BsLink></BsPanel>
    <template v-else>
      <BsMetricGrid v-if="view.summary.length" :columns="3"><BsKpiCard v-for="metric in view.summary" :key="metric.id" :title="metric.label" :value="metric.value" /></BsMetricGrid>
      <BsPanel padding="md">
        <BsEntityPicker :model-value="productId" :label="copy.product" :options="[{ id: '', name: copy.allProducts }, ...productPicker.options]" option-label="name" option-value="id" :loading="productPicker.loading" :error="productPicker.error" :has-more="productPicker.hasMore" :load-more-label="productPicker.more" :retry-label="productPicker.retry" @search="emit('productSearch', $event)" @retry="emit('productRetry')" @load-more="emit('productMore')" @update:model-value="productId = String($event ?? '')" />
        <BsDataTable :value="rows" :label="copy.title" :columns="columns" data-key="id" :loading="view.loading" :error="view.error || null" searchable :search-label="copy.search" lazy paginator :rows="view.pageSize" :first="(page - 1) * view.pageSize" :total-records="view.total" @search="search = $event" @page="page = $event.page + 1" @retry="emit('retry')">
          <template #cell-actions="{ row }"><BsInline><BsButton variant="link" @click="emit('history', row.id)">{{ copy.history }}</BsButton><BsButton v-if="row.canCount" variant="link" @click="emit('count', row.id)">{{ copy.count }}</BsButton><BsButton v-if="row.canManage" variant="link" @click="emit('classify', row.id)">{{ copy.classify }}</BsButton><BsButton v-if="row.canArchive" variant="link" @click="emit('archive', row.id)">{{ copy.archive }}</BsButton></BsInline></template>
          <template #empty><BsStateSurface state="empty" :title="copy.empty" /></template>
        </BsDataTable>
      </BsPanel>
      <BsPanel v-if="view.historyName" padding="md"><BsHeading :level="2">{{ copy.history }} · {{ view.historyName }}</BsHeading><BsDataTable :value="events" :label="copy.history" :columns="[{ key: 'date', header: copy.date, field: 'date' }, { key: 'kind', header: copy.kind, field: 'kind' }, { key: 'quantity', header: copy.quantity, field: 'quantity' }, ...(view.canViewCosts ? [{ key: 'value', header: copy.value, field: 'value' }] : []), { key: 'reason', header: copy.reason, field: 'reason' }, { key: 'actor', header: copy.actor, field: 'actor' }]" data-key="id" :loading="view.historyLoading" :error="view.historyError || null" lazy paginator :rows="20" :first="(historyPage - 1) * 20" :total-records="view.historyTotal" @page="historyPage = $event.page + 1" @retry="emit('retry')"><template #empty><BsStateSurface state="empty" :title="copy.historyEmpty" /></template></BsDataTable></BsPanel>
    </template>
    <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('submit')">
      <BsText as="p" emphasis="semibold">{{ view.editor.name }}</BsText>
      <BsText v-if="view.editor.consequence" as="p" role="status">{{ view.editor.consequence }}</BsText>
      <template v-if="view.editor.count">
        <BsField v-slot="field" :label="`${copy.quantity} (${view.editor.unit})`"><BsInput :id="field.id" :model-value="form.quantity" :aria-describedby="field.describedby" inputmode="decimal" :disabled="view.editor.pending || view.editor.locked" required @update:model-value="change('quantity', String($event))" /></BsField>
        <BsField v-slot="field" :label="copy.countedAt"><BsInput :id="field.id" :model-value="form.countedAt" :aria-describedby="field.describedby" type="datetime-local" :disabled="view.editor.pending || view.editor.locked" required @update:model-value="change('countedAt', String($event))" /></BsField>
        <BsField v-slot="field" :label="copy.reference"><BsInput :id="field.id" :model-value="form.reference" :aria-describedby="field.describedby" :maxlength="200" :disabled="view.editor.pending || view.editor.locked" required @update:model-value="change('reference', String($event))" /></BsField>
      </template>
      <template v-else-if="!view.editor.archive">
        <BsField v-slot="field" :label="copy.classification"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="form.classification" :label="copy.classification" :disabled="view.editor.pending || view.editor.locked" :options="classifications" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="change('classification', String($event))" /></BsField>
        <BsField v-if="form.classification === 'discounted'" v-slot="field" :label="`${copy.price} (${view.editor.unit})`"><BsInput :id="field.id" :model-value="form.price" :aria-describedby="field.describedby" inputmode="decimal" required :disabled="view.editor.pending || view.editor.locked || !view.editor.canPrice" @update:model-value="change('price', String($event))" /></BsField>
        <BsField v-slot="field" :label="copy.position"><BsInput :id="field.id" :model-value="form.position" :aria-describedby="field.describedby" :maxlength="160" :disabled="view.editor.pending || view.editor.locked" @update:model-value="change('position', String($event))" /></BsField>
      </template>
      <BsField v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" :model-value="form.reason" :aria-describedby="field.describedby" :disabled="view.editor.pending || view.editor.locked" :minlength="3" :maxlength="500" required @update:model-value="change('reason', String($event))" /></BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>
