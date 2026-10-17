<script setup lang="ts">
import type { BsDataTableQueryAdapter,BsDataTableRowAction } from '@building-suit/ux'
interface PatientRow { id: string; name: string; phone: string; email: string; dateOfBirth: string; status: string; updated: string; canEdit: boolean; canArchive: boolean; href?: string }
const props = defineProps<{
  title: string; description: string; scopeLabel: string; notice: string
  rows: PatientRow[]; total: number; page: number; pageSize: number; scopeKey: string | null
  status: string; statusOptions: { value: string; label: string }[]
  loading: boolean; error: string | null; denied: string | null; canCreate: boolean
  copy: { create: string; edit: string; archive: string; name: string; phone: string; email: string; dateOfBirth: string; status: string; updated: string; search: string; save: string; cancel: string; retry: string; empty: string; duplicateTitle: string; duplicateDescription: string; duplicateCount: string; duplicateAcknowledgement: string; unverified: string }
  editor: { title: string; dirty: boolean; pending: boolean; error: string | null; submitDisabled: boolean; latestDate: string; duplicates: { id: string; name: string; phone: string; email: string; status: string }[]; duplicateTotal: number }
  archive: { title: string; description: string; pending: boolean; error: string | null }
}>()
const form = defineModel<{ name: string; phone: string; email: string; dateOfBirth: string }>('form',{ required: true })
const editorOpen = defineModel<boolean>('editorOpen',{ required: true })
const archiveOpen = defineModel<boolean>('archiveOpen',{ required: true })
const acknowledged = defineModel<boolean>('acknowledged',{ required: true })
const emit = defineEmits<{ create: []; edit: [id: string]; archive: [id: string]; save: []; confirmArchive: []; retry: []; search: [scope: string | null,value: string]; page: [scope: string | null,page: number,size: number]; status: [scope: string | null,value: string] }>()
const queryAdapter = computed<BsDataTableQueryAdapter>(() => {
  const scope = props.scopeKey
  return { search: value => emit('search',scope,value),page: value => emit('page',scope,value.page,value.rows) }
})
function canAction(action: BsDataTableRowAction,row: PatientRow) { return action==='edit' ? row.canEdit : action==='archive' ? row.canArchive : false }
const columns = computed(() => [{ key: 'name',field: 'name',header: props.copy.name },{ key: 'phone',field: 'phone',header: props.copy.phone },{ key: 'email',field: 'email',header: props.copy.email },{ key: 'dateOfBirth',field: 'dateOfBirth',header: props.copy.dateOfBirth },{ key: 'status',field: 'status',header: props.copy.status },{ key: 'updated',field: 'updated',header: props.copy.updated }])
const duplicateColumns = computed(() => [{ key: 'name',field: 'name',header: props.copy.name },{ key: 'phone',field: 'phone',header: props.copy.phone },{ key: 'email',field: 'email',header: props.copy.email },{ key: 'status',field: 'status',header: props.copy.status }])
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="title" :subtitle="scopeLabel || description"><template #actions><BsButton v-if="canCreate" variant="primary" @click="emit('create')">{{ copy.create }}</BsButton></template></BsPageHeader>
    <BsAlert tone="info" :description="notice" />
    <BsStateSurface v-if="denied" state="permission" :title="denied" />
    <BsDataTable v-else :value="rows" :columns="columns" row-key="id" :label="title" searchable :search-label="copy.search" :loading="loading" :error="error" lazy paginator :page-size="pageSize" :first="page*pageSize" :total-records="total" :query-adapter="queryAdapter" :capabilities="{ edit: true,archive: true }" :can-row-action="canAction" :action-labels="{ edit: copy.edit,archive: copy.archive }" @edit="emit('edit',$event.id)" @archive="emit('archive',$event.id)" @retry="emit('retry')">
      <template #cell-name="{ row }"><BsLink v-if="row.href" :to="row.href">{{ row.name }}</BsLink><BsText v-else>{{ row.name }}</BsText></template>
      <template #filters><BsSelect :model-value="status" :label="copy.status" :options="statusOptions" option-label="label" option-value="value" @update:model-value="emit('status',scopeKey,String($event))" /></template>
      <template #empty><BsStateSurface state="empty" :title="copy.empty" /></template>
    </BsDataTable>
    <BsRecordActionDialog v-model:visible="editorOpen" :title="editor.title" :dirty="editor.dirty" :pending="editor.pending" :error="editor.error" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="editor.submitDisabled" @submit="emit('save')">
      <BsText as="p" size="sm">{{ copy.unverified }}</BsText>
      <BsPatientIdentityFields v-model="form" :labels="copy" :disabled="editor.pending" :latest-date="editor.latestDate" />
      <BsStack v-if="editor.duplicateTotal>0" gap="sm">
        <BsAlert tone="warning" :title="copy.duplicateTitle" :description="copy.duplicateDescription" />
        <BsText as="p" size="sm">{{ copy.duplicateCount }}</BsText>
        <BsDataTable :value="editor.duplicates" :columns="duplicateColumns" row-key="id" :label="copy.duplicateTitle" />
        <BsCheckbox v-model="acknowledged" :label="copy.duplicateAcknowledgement" :disabled="editor.pending" />
      </BsStack>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="archiveOpen" :title="archive.title" :pending="archive.pending" :error="archive.error" :submit-label="copy.archive" :cancel-label="copy.cancel" submit-tone="danger" @submit="emit('confirmArchive')"><BsText as="p">{{ archive.description }}</BsText></BsRecordActionDialog>
  </BsStack>
</template>
