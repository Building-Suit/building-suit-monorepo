<script setup lang="ts">
import type { BsCustomerDirectoryRow, BsCustomerDirectoryCopy, BsCustomerIdentityForm } from '../types/customerDirectoryPresentation'
const props = defineProps<{
  copy: BsCustomerDirectoryCopy
  rows: BsCustomerDirectoryRow[]
  contextAvailable: boolean
  contextLoading: boolean
  permissionDenied: boolean
  canManage: boolean
  loading: boolean
  error: string | null
  page: number
  pageSize: number
  total: number
  editorDirty: boolean
  saving: boolean
  actionError: string
  statusOptions: { label: string; value: string }[]
}>()
const form = defineModel<BsCustomerIdentityForm>('form', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const status = defineModel<string>('status', { required: true })
const emit = defineEmits<{ create: []; save: []; retry: []; search: [value: string]; page: [event: { page: number }] }>()
const columns = computed(() => [
  { key: 'name', header: props.copy.name }, { key: 'contact', header: props.copy.contact },
  { key: 'status', header: props.copy.status }, { key: 'updated', header: props.copy.updated },
])
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"/>
    <BsPanel v-if="!contextAvailable && !contextLoading" padding="md">
      <BsText as="p">{{ copy.noShop }}</BsText>
      <BsLink to="/dashboard">{{ copy.dashboard }}</BsLink>
    </BsPanel>
    <template v-else-if="contextAvailable">
      <BsText as="p" size="sm">{{ copy.historyNotice }}</BsText>
      <BsText v-if="permissionDenied" role="alert" as="p" size="sm" tone="warning">{{ copy.permissionDenied }}</BsText>
      <BsText v-else-if="!canManage" as="p" size="sm">{{ copy.manageDenied }}</BsText>
      <BsRecordActionDialog v-model:visible="visible" :title="copy.createTitle" :dirty="editorDirty" :pending="saving" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
        <BsCustomerIdentityFields v-model="form" :labels="copy"/>
      </BsRecordActionDialog>
      <BsPanel v-if="!permissionDenied" padding="md">
        <BsDataTable :value="rows" :loading="loading" :error="error" :label="copy.title" :capabilities="{ insert: canManage }" :action-labels="{ insert: copy.add }" searchable :search-label="copy.search" data-key="id" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="total" :always-show-paginator="false" :columns="columns" @search="emit('search', $event)" @page="emit('page', $event)" @retry="emit('retry')" @create="emit('create')">
          <template #cell-name="{ row }"><BsLink :to="row.href">{{ row.name }}</BsLink></template>
          <template #cell-contact="{ row }">
            <BsStack gap="xs"><BsText as="p">{{ row.phone }}</BsText><BsText as="p" size="xs" tone="muted">{{ row.email }}</BsText></BsStack>
          </template>
          <template #cell-status="{ row }"><BsStatusBadge :status="row.status" :label="row.status" tone="neutral" /></template>
          <template #cell-updated="{ row }">{{ row.updated }}</template>
          <template #filters><BsSelect v-model="status" :label="copy.status" :options="statusOptions" option-label="label" option-value="value"/></template>
          <template #empty><BsText as="p" size="sm" tone="muted">{{ copy.noCustomers }}</BsText></template>
        </BsDataTable>
      </BsPanel>
    </template>
  </BsStack>
</template>
