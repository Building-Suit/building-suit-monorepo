<script setup lang="ts">
const role = defineModel<string>('role', { default: '' })
const roleName = useId()
const visible = defineModel<boolean>('visible', { default: false })
defineProps<{ title: string; pending?: boolean; dirty?: boolean; error?: string | null; submitLabel: string; cancelLabel: string; size?: 'sm' | 'md' | 'lg'; submitDisabled?: boolean; roleLabel?: string; roles?: { value: string; label: string; description?: string; disabled?: boolean }[] }>()
const emit = defineEmits<{ submit: [] }>()
</script>
<template>
  <BsRecordActionDialog v-slot="{ close }" v-model:visible="visible" :title="title" :size="size" :pending="pending" :dirty="dirty" :error="error" :submit-label="submitLabel" :cancel-label="cancelLabel" :submit-disabled="submitDisabled" @submit="emit('submit')">
    <slot name="identity" :close="close" />
    <slot name="role" :close="close">
      <BsFieldGroup v-if="roles" :legend="roleLabel">
        <BsGrid :columns="1" gap="sm">
          <BsFieldLabel v-for="option in roles" :key="option.value">
            <BsInline as="span" gap="md" :wrap="false">
              <BsRadio v-model="role" :name="roleName" :value="option.value" :disabled="pending || option.disabled" bare />
              <BsText as="span" emphasis="bold">{{ option.label }}</BsText>
            </BsInline>
            <BsText v-if="option.description" as="span" size="xs" tone="muted">{{ option.description }}</BsText>
          </BsFieldLabel>
        </BsGrid>
      </BsFieldGroup>
    </slot>
    <slot :close="close" />
  </BsRecordActionDialog>
</template>
