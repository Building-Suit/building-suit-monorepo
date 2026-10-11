<script setup lang="ts">
import type { BsAccessEditorState, BsAccessRoleForm } from '../types/accessPresentation'
import { permissionSelection } from '@building-suit/ux'
import type { BsPermissionItem } from '@building-suit/ux'
import type { BsUsageItem } from '@building-suit/contracts'
const form = defineModel<BsAccessRoleForm>({ required: true })
const props = defineProps<{
  state: BsAccessEditorState
  names?: { english: string; arabic: string; maxLength: number; minLength?: number }
  permissionLabel: string
  permissions: { key: string; label: string; disabled?: boolean }[]
  archiveLabel?: string
  usage?: BsUsageItem
}>()
const emit = defineEmits<{ close: []; submit: []; archive: [] }>()
const items = computed<BsPermissionItem[]>(() => props.permissions.map(permission => ({ key: permission.key, label: permission.label, section: 'permissions', sectionLabel: props.permissionLabel })))
const disabledPermissions = computed(() => props.permissions.filter(permission => permission.disabled).map(permission => permission.key))
function toggle(key: string, checked: boolean) {
  const permissions = permissionSelection(form.value.permissions, key, checked, disabledPermissions.value, props.state.pending)
  if (permissions) form.value = { ...form.value, permissions }
}
</script>
<template>
  <BsRoleEditorDialog v-if="state.visible" :visible="true" :title="state.title" :dirty="state.dirty" :pending="state.pending" :error="state.error" :submit-label="state.submitLabel" :cancel-label="state.cancelLabel" :items="items" :selected="form.permissions" :permission-label="permissionLabel" :disabled-permissions="disabledPermissions" @toggle="toggle" @update:visible="value => { if (!value) emit('close') }" @submit="emit('submit')">
    <BsUsageMeter v-if="usage" compact :item="usage" />
    <BsGrid v-if="names" :columns="2" gap="md">
      <BsField v-slot="field" :label="names.english"><BsInput :id="field.id" :model-value="form.name" @update:model-value="form = { ...form, name: String($event ?? '') }" dir="ltr" required :maxlength="names.maxLength" :minlength="names.minLength" /></BsField>
      <BsField v-slot="field" :label="names.arabic"><BsInput :id="field.id" :model-value="form.nameAr" @update:model-value="form = { ...form, nameAr: String($event ?? '') }" dir="rtl" required :maxlength="names.maxLength" :minlength="names.minLength" /></BsField>
    </BsGrid>

    <BsButton v-if="archiveLabel" variant="danger" :disabled="state.pending" @click="emit('archive')">{{ archiveLabel }}</BsButton>
  </BsRoleEditorDialog>
</template>
