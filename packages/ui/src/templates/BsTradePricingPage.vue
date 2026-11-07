<script setup lang="ts">
import type { BsTradePricingCopy, BsTradePricingView, BsTradePricingForm, BsTradePricingRow, BsTradePicker } from '../types/tradePricingPresentation'
const props = defineProps<{ copy: BsTradePricingCopy; view: BsTradePricingView; rows: BsTradePricingRow[]; productPicker: BsTradePicker; customerPicker: BsTradePicker; groupPicker: BsTradePicker; units: { value: string; label: string }[] }>()
const kind = defineModel<string>('kind', { required: true })
const search = defineModel<string>('search', { required: true })
const page = defineModel<number>('page', { required: true })
const editorOpen = defineModel<boolean>('editorOpen', { required: true })
const form = defineModel<BsTradePricingForm>('form', { required: true })
const emit = defineEmits<{ retry: []; add: []; assign: []; edit: [id: string]; submit: []; pickerSearch: [kind: 'product' | 'customer' | 'group', query: string]; pickerMore: [kind: 'product' | 'customer' | 'group']; pickerRetry: [kind: 'product' | 'customer' | 'group'] }>()
function change<K extends keyof BsTradePricingForm>(key: K, value: BsTradePricingForm[K]) { form.value = { ...form.value, [key]: value } }
const columns = computed(() => [{ key: 'name', header: props.copy.name, field: 'name' }, { key: 'scope', header: props.copy.scope, field: 'scope' }, { key: 'quantity', header: props.copy.quantity, field: 'quantity' }, { key: 'price', header: props.copy.price, field: 'price' }, { key: 'validity', header: props.copy.validity, field: 'validity' }, { key: 'status', header: props.copy.status, field: 'status' }, { key: 'revision', header: props.copy.revision, field: 'revision' }, { key: 'actions', header: props.copy.actions }])
const lockedFields = computed(() => locked.value || Boolean(props.view.editor.archive))
const locked = computed(() => props.view.editor.pending || props.view.editor.locked)
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"><template #actions><BsInline><BsLink to="/customers">{{ copy.customers }}</BsLink><BsLink to="/products">{{ copy.products }}</BsLink><BsButton v-if="view.canManageGroups" @click="emit('assign')">{{ copy.assign }}</BsButton><BsButton v-if="kind !== 'history' && (kind === 'group' ? view.canManageGroups : view.canManagePrices)" @click="emit('add')">{{ copy.add }}</BsButton></BsInline></template></BsPageHeader>
  <BsPanel v-if="!view.available" padding="md"><BsText as="p">{{ copy.noShop }}</BsText></BsPanel>
  <BsPanel v-else padding="md">
   <BsTabs v-model="kind" :label="copy.title" :tabs="[{ value: 'price', label: copy.prices, disabled: !view.canManagePrices }, { value: 'group', label: copy.groups }, ...(view.canManagePrices ? [{ value: 'history', label: copy.history }] : [])]" />
   <BsText as="p" tone="muted">{{ copy.rulePolicy }}</BsText>
   <BsDataTable :value="rows" :label="copy.title" :columns="columns" data-key="id" :loading="view.loading" :error="view.error || null" searchable :search-label="copy.search" lazy paginator :rows="view.pageSize" :first="(page - 1) * view.pageSize" :total-records="view.total" @search="search = $event" @page="page = $event.page + 1" @retry="emit('retry')">
    <template #cell-actions="{ row }"><BsButton v-if="row.canEdit" variant="secondary" @click="emit('edit', row.id)">{{ copy.edit }}</BsButton></template>
    <template #empty><BsText as="p">{{ copy.empty }}</BsText></template>
   </BsDataTable>
  </BsPanel>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editor.title" :dirty="view.editor.dirty" :pending="view.editor.pending" :error="view.editor.error" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('submit')">
   <template v-if="view.editor.kind === 'group'">
    <BsField v-slot="field" for="trade-group-name" :label="copy.name"><BsInput :id="field.id" :model-value="form.name" :disabled="lockedFields" :minlength="2" :maxlength="120" required @update:model-value="change('name', String($event))" /></BsField>
   </template>
   <template v-else>
    <BsEntityPicker v-if="view.editor.kind === 'price'" :model-value="form.productId" :label="copy.product" :options="productPicker.options" :disabled="lockedFields || view.editor.productLocked" option-label="name" option-value="id" :loading="productPicker.loading" :error="productPicker.error" :has-more="productPicker.hasMore" :load-more-label="productPicker.more" :retry-label="productPicker.retry" @search="emit('pickerSearch', 'product', $event)" @retry="emit('pickerRetry', 'product')" @load-more="emit('pickerMore', 'product')" @update:model-value="change('productId', String($event ?? ''))" />
    <BsEntityPicker :model-value="form.customerId" :label="copy.customer" :options="[{ id: '', name: copy.noCustomer }, ...customerPicker.options]" :disabled="lockedFields" option-label="name" option-value="id" :loading="customerPicker.loading" :error="customerPicker.error" :has-more="customerPicker.hasMore" :load-more-label="customerPicker.more" :retry-label="customerPicker.retry" @search="emit('pickerSearch', 'customer', $event)" @retry="emit('pickerRetry', 'customer')" @load-more="emit('pickerMore', 'customer')" @update:model-value="change('customerId', String($event ?? ''))" />
    <BsEntityPicker :model-value="form.groupId" :label="copy.group" :options="[{ id: '', name: copy.noGroup }, ...groupPicker.options]" :disabled="lockedFields || view.editor.kind === 'price' && Boolean(form.customerId)" option-label="name" option-value="id" :loading="groupPicker.loading" :error="groupPicker.error" :has-more="groupPicker.hasMore" :load-more-label="groupPicker.more" :retry-label="groupPicker.retry" @search="emit('pickerSearch', 'group', $event)" @retry="emit('pickerRetry', 'group')" @load-more="emit('pickerMore', 'group')" @update:model-value="change('groupId', String($event ?? ''))" />
    <BsText v-if="view.editor.kind === 'assignment'" as="p" tone="muted">{{ copy.assignmentPolicy }}</BsText>
    <BsGrid v-else :columns="2">
     <BsField v-slot="field" :label="copy.unit"><BsSelect :input-id="field.id" :model-value="form.unit" :label="copy.unit" :options="units" option-label="label" option-value="value" :disabled="lockedFields || !form.productId" @update:model-value="change('unit', String($event ?? ''))" /></BsField>
     <BsField v-slot="field" for="trade-price-minimum" :label="`${copy.minimum}${view.editor.baseUnit ? ` (${view.editor.baseUnit})` : ''}`"><BsInput :id="field.id" :model-value="form.minimum" inputmode="decimal" :disabled="lockedFields" required @update:model-value="change('minimum', String($event))" /></BsField>
     <BsField v-slot="field" for="trade-price-amount" :label="copy.price"><BsInput :id="field.id" :model-value="form.price" inputmode="decimal" :disabled="lockedFields" required @update:model-value="change('price', String($event))" /></BsField>
     <BsField v-slot="field" for="trade-price-priority" :label="copy.priority"><BsInput :id="field.id" :model-value="form.priority" inputmode="numeric" :disabled="lockedFields" required @update:model-value="change('priority', String($event))" /></BsField>
     <BsField v-slot="field" for="trade-price-start" :label="copy.startsAt"><BsInput :id="field.id" :model-value="form.startsAt" type="datetime-local" :disabled="lockedFields" required @update:model-value="change('startsAt', String($event))" /></BsField>
     <BsField v-slot="field" for="trade-price-end" :label="copy.endsAt"><BsInput :id="field.id" :model-value="form.endsAt" type="datetime-local" :disabled="lockedFields" @update:model-value="change('endsAt', String($event))" /></BsField>
    </BsGrid>
   </template>
   <BsCheckbox v-if="view.editor.kind !== 'assignment'" :model-value="form.active" :label="copy.active" :disabled="locked" @update:model-value="change('active', Boolean($event))" />
   <BsField v-slot="field" for="trade-configuration-reason" :label="copy.reason"><BsTextarea :id="field.id" :model-value="form.reason" :disabled="locked" :minlength="3" :maxlength="1000" required @update:model-value="change('reason', String($event))" /></BsField>
  </BsRecordActionDialog>
 </BsStack>
</template>
