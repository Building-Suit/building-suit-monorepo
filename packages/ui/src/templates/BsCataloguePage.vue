<script setup lang="ts">
import type { BsCatalogueItemView, BsCatalogueForm, BsCatalogueCopy } from '../types/cataloguePresentation'
const form = defineModel<BsCatalogueForm>('form', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const category = defineModel<string>('category', { required: true })
const props = defineProps<{
  kind: 'product' | 'service'
  copy: BsCatalogueCopy
  context: { available: boolean; loading: boolean; dashboardTo: string; importTo: string }
  rows: BsCatalogueItemView[]
  categories: { value: string; label: string }[]
  table: { loading: boolean; error: string | null; canManage: boolean; archivePendingId: string | null; pageSize: number; page: number; total: number; filtered: boolean }
  editor: { uploadBlocked?: boolean; mediaSupported?: boolean; editing: boolean; dirty: boolean; pending: boolean; error: string; priceMax?: number }
  upload?: { preview: string; status: 'idle' | 'uploading' | 'uploaded' | 'error' | 'invalid' }
  scheduling?: { loading: boolean; error: string | null; locations: { value: string; label: string }[]; staff: { value: string; label: string }[] }
  discounts?: { value: string; label: string }[]
}>()
const emit = defineEmits<{ imageSelect: [file: File]; imageRemove: []; imageRetry: []; search: [value: string]; page: [page: number]; retry: []; create: []; edit: [id: string]; archive: [id: string]; submit: [] }>()
function change<K extends keyof BsCatalogueForm>(key: K, value: BsCatalogueForm[K]) { form.value = { ...form.value, [key]: value } }
function discount<K extends keyof BsCatalogueForm['discount']>(key: K, value: BsCatalogueForm['discount'][K]) { change('discount', { ...form.value.discount, [key]: value }) }
function schedule<K extends keyof BsCatalogueForm['schedule']>(key: K, value: BsCatalogueForm['schedule'][K]) { change('schedule', { ...form.value.schedule, [key]: value }) }
const columns = computed(() => [
  { key: 'name', header: props.copy.name }, { key: 'category', header: props.copy.category, field: 'category' },
  ...(props.kind === 'product' ? [{ key: 'sku', header: props.copy.sku ?? '', field: 'sku' }, { key: 'barcode', header: props.copy.barcode ?? '', field: 'barcode' }] : []),
  { key: 'price', header: props.copy.tablePrice ?? props.copy.price, field: 'price', align: 'end' as const },
  ...(props.kind === 'service' ? [{ key: 'schedule', header: props.copy.scheduleSummary ?? '', field: 'schedule' }] : []),
])
</script>
<template>
  <BsStack>
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"><template #actions><BsInline v-if="context.available"><BsLink :to="context.importTo">{{ copy.import }}</BsLink></BsInline></template></BsPageHeader>
    <BsPanel v-if="!context.available && !context.loading" padding="md"><BsText as="p">{{ copy.noShop }}</BsText><BsLink :to="context.dashboardTo">{{ copy.dashboard }}</BsLink></BsPanel>
    <template v-else-if="context.available">
      <BsText v-if="copy.stockLater" as="p" size="sm">{{ copy.stockLater }}</BsText>
      <BsText v-if="editor.error && !visible" role="alert" as="p" size="sm" tone="danger">{{ editor.error }}</BsText>
      <BsRecordActionDialog v-model:visible="visible" class="bs-catalog-editor" :data-catalog-kind="kind" pinned-actions :title="editor.editing ? (copy.editTitle ?? copy.edit) : copy.add" :dirty="editor.dirty" :pending="editor.pending" :error="editor.error" :submit-disabled="editor.uploadBlocked" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('submit')">
        <BsField v-slot="field" :label="copy.name"><BsInput :id="field.id" :model-value="form.name" :placeholder="copy.name" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required @update:model-value="change('name', String($event))" /></BsField>
        <template v-if="kind === 'product'">
          <BsField v-slot="field" :label="copy.sku ?? ''"><BsInput :id="field.id" :model-value="form.sku" :aria-describedby="field.describedby" type="text" :maxlength="80" @update:model-value="change('sku', String($event))" /></BsField>
          <BsField v-slot="field" :label="copy.barcode ?? ''"><BsInput :id="field.id" :model-value="form.barcode" :aria-describedby="field.describedby" type="text" :maxlength="80" @update:model-value="change('barcode', String($event))" /></BsField>
        </template>
        <BsField v-else v-slot="field" :label="copy.description ?? ''"><BsTextarea :id="field.id" :model-value="form.description" :placeholder="copy.description" :aria-describedby="field.describedby" :maxlength="1000" :rows="2" @update:model-value="change('description', String($event))" /></BsField>
        <BsField v-slot="field" :label="copy.price"><BsInput :id="field.id" :model-value="form.price" :aria-describedby="field.describedby" type="number" :min="0" :max="editor.priceMax" :step="0.01" required @update:model-value="change('price', Number($event))" /></BsField>
        <template v-if="kind === 'service'">
          <BsField v-slot="field" :label="copy.discountType ?? ''"><BsSelect :model-value="form.discount.type" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.discountType ?? ''" :options="discounts" option-label="label" option-value="value" @update:model-value="discount('type', String($event))" /></BsField>
          <BsField v-slot="field" :label="copy.discountValue ?? ''"><BsInput :id="field.id" :model-value="form.discount.value" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required @update:model-value="discount('value', Number($event))" /></BsField>
        </template>
        <BsStack gap="sm">
        <BsField v-if="copy.imageLabel && copy.imageUpload && upload" v-slot="field" :label="copy.imageLabel" :hint="editor.mediaSupported ? '' : copy.imageUnavailable"><BsCatalogImageUploader :input-id="field.id" :describedby="field.describedby" :preview="upload.preview" :name="form.name" :status="upload.status" :copy="copy.imageUpload" :disabled="!editor.mediaSupported || editor.pending" @select="emit('imageSelect', $event)" @remove="emit('imageRemove')" @retry="emit('imageRetry')" /></BsField>
        <BsField v-slot="field" :label="copy.category"><BsSelect :model-value="form.category" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.category" :options="categories" :placeholder="categories.find(option => option.value === '')?.label" option-label="label" option-value="value" @update:model-value="change('category', String($event))" /></BsField>
        </BsStack>
        <BsFieldGroup v-if="kind === 'service'" legend="">
          <BsCheckbox :model-value="form.schedule.enabled" :label="copy.scheduling ?? ''" @update:model-value="schedule('enabled', Boolean($event))" /><BsText as="p" size="sm" tone="muted">{{ copy.schedulingHelp }}</BsText>
          <BsText v-if="scheduling?.loading" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText><BsText v-else-if="scheduling?.error" role="alert" as="p" size="sm" tone="danger">{{ scheduling.error }}</BsText>
          <BsGrid v-if="form.schedule.enabled" :columns="2">
            <BsField v-slot="field" :label="copy.duration ?? ''"><BsInput :id="field.id" :model-value="form.schedule.duration" :aria-describedby="field.describedby" type="number" :min="5" :max="1440" :step="1" required @update:model-value="schedule('duration', Number($event))" /></BsField>
            <BsField v-slot="field" :label="copy.cleanup ?? ''"><BsInput :id="field.id" :model-value="form.schedule.cleanup" :aria-describedby="field.describedby" type="number" :min="0" :max="240" :step="1" required @update:model-value="schedule('cleanup', Number($event))" /></BsField>
            <BsFieldGroup :legend="copy.locations ?? ''"><BsCheckbox v-for="location in scheduling?.locations" :key="location.value" :model-value="form.schedule.locations" :value="location.value" :label="location.label" @update:model-value="schedule('locations', $event as string[])" /></BsFieldGroup>
            <BsFieldGroup :legend="copy.staff ?? ''"><BsCheckbox v-for="member in scheduling?.staff" :key="member.value" :model-value="form.schedule.staff" :value="member.value" :label="member.label" @update:model-value="schedule('staff', $event as string[])" /></BsFieldGroup>
          </BsGrid>
        </BsFieldGroup>
        <template #actions="{ close, formId }">
          <BsButton class="bs-catalog-editor__cancel" variant="secondary" :disabled="editor.pending" @click="close">{{ copy.cancel }}</BsButton>
          <BsButton class="bs-catalog-editor__save" type="submit" :form="formId" variant="primary" :pending="editor.pending" :disabled="editor.pending || editor.uploadBlocked">{{ copy.save }}</BsButton>
        </template>
      </BsRecordActionDialog>
      <BsPanel padding="md">
        <BsDataTable :value="rows" :label="copy.title" :loading="table.loading" :error="table.error" :capabilities="{ insert: table.canManage, edit: table.canManage, archive: table.canManage }" :action-labels="{ insert: copy.add, edit: copy.edit, archive: copy.archive }" :row-action-pending="(action, row) => action === 'archive' && table.archivePendingId === row.id" searchable :search-label="copy.search" lazy paginator :rows="table.pageSize" :first="(table.page - 1) * table.pageSize" :total-records="table.total" :always-show-paginator="false" data-key="id" :columns="columns" @search="emit('search', $event)" @page="emit('page', $event.page + 1)" @retry="emit('retry')" @create="emit('create')" @edit="emit('edit', $event.id)" @archive="emit('archive', $event.id)">
          <template #cell-name="{ row }">{{ row.name }}<BsText v-if="row.description" as="p" size="xs" tone="muted" emphasis="semibold">{{ row.description }}</BsText></template>
          <template #filters><BsSelect v-model="category" :label="copy.category" :options="categories" :placeholder="categories.find(option => option.value === '')?.label" option-label="label" option-value="value" /></template>
          <template #empty><BsStateSurface state="empty" :title="table.filtered ? copy.noResults : copy.empty" /></template>
        </BsDataTable>
      </BsPanel>
    </template>
  </BsStack>
</template>

<style>
/* Geometry belongs to this catalog template, not the generic record dialog. */
.bs-catalog-editor[data-pc-name='dialog'] { min-block-size: min(51.25rem, 90dvh); }
.bs-catalog-editor[data-catalog-kind='service'] { min-block-size: min(68.75rem, 90dvh); }
.bs-catalog-editor > [data-pc-section='header'] {
  padding: var(--bs-space-4) var(--bs-space-5); border-block-end: 0;
}
.bs-catalog-editor [data-pc-section='title'] { font-size: var(--bs-type-h2-size); line-height: var(--bs-type-h2-lh); }
.bs-catalog-editor > [data-pc-section='header'] button { border-color: transparent; background: transparent; }
.bs-catalog-editor > [data-pc-section='content'] {
  flex: 1; min-block-size: 0; padding: var(--bs-space-3) var(--bs-space-5);
}
.bs-catalog-editor .bs-form-fields { gap: var(--bs-space-6); }
.bs-catalog-editor[data-catalog-kind='service'] .bs-form-fields { gap: var(--bs-space-5); }
.bs-catalog-editor .ls-field { gap: var(--bs-space-1); }
.bs-catalog-editor .ls-field__label { font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); font-weight: var(--bs-weight-regular); }
.bs-catalog-editor .ls-input { min-height: var(--bs-tap-target-min); }
.bs-catalog-editor textarea.ls-input { min-block-size: 6rem; }
.bs-catalog-editor > [data-pc-section='footer'] { padding: var(--bs-space-5); border-block-start: 0; }
.bs-catalog-editor > [data-pc-section='footer'] .ls-btn { min-height: var(--bs-tap-target-min); padding-block: var(--bs-space-2); }
.bs-catalog-editor__cancel { min-inline-size: 11.25rem; border-color: var(--bs-primary); background: var(--bs-surface); }
.bs-catalog-editor__save { min-inline-size: 12.75rem; }
@media (max-width: 639px) {
  .bs-catalog-editor > [data-pc-section='header'],
  .bs-catalog-editor > [data-pc-section='content'],
  .bs-catalog-editor > [data-pc-section='footer'] { padding-inline: var(--bs-space-4); }
  .bs-catalog-editor .bs-form-actions { flex-wrap: nowrap; }
  .bs-catalog-editor__cancel, .bs-catalog-editor__save { min-inline-size: 0; flex: 1; }
}
</style>
