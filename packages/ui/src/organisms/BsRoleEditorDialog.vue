<script setup lang="ts">
import type { BsPermissionItem } from '@building-suit/ux'
const visible = defineModel<boolean>('visible', { default: false })
defineProps<{ title: string; items: BsPermissionItem[]; selected: string[]; permissionLabel: string; pending?: boolean; dirty?: boolean; disabledPermissions?: string[]; error?: string | null; submitLabel: string; cancelLabel: string }>()
const emit = defineEmits<{ submit: []; toggle: [key: string, checked: boolean] }>()
</script>
<template>
  <BsRecordActionDialog v-slot="{ close }" v-model:visible="visible" :title="title" size="lg" :pending="pending" :dirty="dirty" :error="error" :submit-label="submitLabel" :cancel-label="cancelLabel" @submit="emit('submit')">
    <slot :close="close" />
    <BsBox><BsPermissionMatrix :items="items" :label="permissionLabel" editable :selected="selected" :disabled="pending" :disabled-permissions="disabledPermissions" @toggle="(key, checked) => emit('toggle', key, checked)" /></BsBox>
  </BsRecordActionDialog>
</template>
