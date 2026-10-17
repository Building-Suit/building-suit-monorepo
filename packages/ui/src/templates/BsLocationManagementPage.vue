<script setup lang="ts">
import type { BsDataTableQueryAdapter, BsDataTableRowAction } from '@building-suit/ux'
interface LocationRow { id: string; name: string; timezone: string; phone: string; address: string; status: string; canEdit: boolean; canArchive: boolean }
interface LocationForm { name: string; timezone: string; phone: string; address: string }
const props = defineProps<{
  title: string; description: string; practiceName: string
  rows: LocationRow[]; total: number; page: number; pageSize: number; scopeKey: string | null
  loading: boolean; error?: string | null; denied?: string; canCreate: boolean
  copy: { create: string; edit: string; archive: string; name: string; timezone: string; phone: string; address: string; status: string; search: string; save: string; cancel: string; retry: string; empty: string }
  editor: { title: string; dirty: boolean; pending: boolean; error: string | null; submitDisabled: boolean }
  archive: { title: string; description: string; pending: boolean; error: string | null }
  limits: { name: number; timezone: number; phone: number; address: number }
}>()
const form = defineModel<LocationForm>('form', { required: true })
const editorOpen = defineModel<boolean>('editorOpen', { required: true })
const archiveOpen = defineModel<boolean>('archiveOpen', { required: true })
const emit = defineEmits<{ create: []; edit: [id: string]; archive: [id: string]; save: []; confirmArchive: []; retry: []; search: [scope: string | null, value: string]; page: [scope: string | null, page: number, size: number] }>()
const queryAdapter = computed<BsDataTableQueryAdapter>(() => {
  const scope = props.scopeKey
  return { search: value => emit('search', scope, value), page: event => emit('page', scope, event.page, event.rows) }
})
function updateField(key: keyof LocationForm, value: unknown) { form.value = { ...form.value, [key]: String(value ?? '') } }
function canAction(action: BsDataTableRowAction, row: LocationRow) { return action === 'edit' ? row.canEdit : action === 'archive' ? row.canArchive : false }
const columns = computed(() => [{ key: 'name', field: 'name', header: props.copy.name }, { key: 'timezone', field: 'timezone', header: props.copy.timezone }, { key: 'phone', field: 'phone', header: props.copy.phone }, { key: 'address', field: 'address', header: props.copy.address }, { key: 'status', field: 'status', header: props.copy.status }])
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="title" :subtitle="practiceName || description"><template #actions><BsButton v-if="canCreate" variant="primary" @click="emit('create')">{{ copy.create }}</BsButton></template></BsPageHeader>
    <BsStateSurface v-if="denied" state="permission" :title="denied" />
    <BsStateSurface v-else-if="error" state="error" :title="error" :action-label="copy.retry" @action="emit('retry')" />
    <BsDataTable v-else :value="rows" :columns="columns" row-key="id" :label="title" searchable :search-label="copy.search" :loading="loading" lazy paginator :page-size="pageSize" :first="page*pageSize" :total-records="total" :query-adapter="queryAdapter" :capabilities="{ edit: true, archive: true }" :can-row-action="canAction" :action-labels="{ edit: copy.edit, archive: copy.archive }" @edit="emit('edit', $event.id)" @archive="emit('archive', $event.id)" />
    <BsRecordActionDialog v-model:visible="editorOpen" :title="editor.title" :dirty="editor.dirty" :pending="editor.pending" :error="editor.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="editor.submitDisabled" @submit="emit('save')">
      <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" :model-value="form.name" @update:model-value="updateField('name', $event)" required :maxlength="limits.name" /></BsField>
      <BsField v-slot="field" :label="copy.timezone" required><BsInput :id="field.id" :model-value="form.timezone" @update:model-value="updateField('timezone', $event)" required :maxlength="limits.timezone" dir="ltr" /></BsField>
      <BsField v-slot="field" :label="copy.phone"><BsInput :id="field.id" :model-value="form.phone" @update:model-value="updateField('phone', $event)" :maxlength="limits.phone" dir="auto" /></BsField>
      <BsField v-slot="field" :label="copy.address"><BsInput :id="field.id" :model-value="form.address" @update:model-value="updateField('address', $event)" :maxlength="limits.address" /></BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="archiveOpen" :title="archive.title" :pending="archive.pending" :error="archive.error" :submit-label="copy.archive" :cancel-label="copy.cancel" submit-tone="danger" @submit="emit('confirmArchive')"><BsText as="p">{{ archive.description }}</BsText></BsRecordActionDialog>
  </BsStack>
</template>
