<script setup lang="ts">
import type { BsRoleOption } from '@building-suit/contracts'
const visible = defineModel<boolean>('visible', { default: false })
const email = defineModel<string>('email', { default: '' })
const role = defineModel<string | null>('role', { default: null })
defineProps<{ title: string; emailLabel: string; roleLabel: string; roles: BsRoleOption[]; submitLabel: string; cancelLabel: string; pending?: boolean; dirty?: boolean; error?: string | null; capacityNotice?: string; disabled?: boolean }>()
const emit = defineEmits<{ submit: [] }>()
const emailId = useId()
</script>

<template>
  <BsRecordActionDialog v-model:visible="visible" :title="title" :pending="pending" :dirty="dirty" :error="error" :submit-label="submitLabel" :cancel-label="cancelLabel" :submit-disabled="disabled || !email.trim() || !role" @submit="emit('submit')">
    <BsAlert v-if="capacityNotice" tone="warning">{{ capacityNotice }}</BsAlert>
    <BsField v-slot="field" :label="emailLabel" :for="emailId" required>
      <BsInput :id="emailId" v-model="email" type="email" required :aria-describedby="field.describedby" />
    </BsField>
    <BsRolePicker v-model="role" :label="roleLabel" :options="roles" :disabled="pending || disabled" />
    <slot />
    <slot name="result" />
  </BsRecordActionDialog>
</template>
