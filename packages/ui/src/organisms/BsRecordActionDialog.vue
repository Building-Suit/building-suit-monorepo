<script setup lang="ts">
const visible = defineModel<boolean>('visible', { default: false })
const props = withDefaults(defineProps<{
  title: string
  dirty?: boolean
  pending?: boolean
  error?: string | null
  size?: 'sm' | 'md' | 'lg'
  submitLabel?: string
  cancelLabel?: string
  submitTone?: 'primary' | 'danger'
  submitDisabled?: boolean
  formLayout?: 'stack' | 'grid'
  formColumns?: 1 | 2 | 3 | 4
  actionsLabel?: string
}>(), {
  dirty: false,
  pending: false,
  error: null,
  size: 'md',
  submitLabel: undefined,
  cancelLabel: undefined,
  submitTone: 'primary',
  submitDisabled: false,
  formLayout: 'stack',
  formColumns: 1,
  actionsLabel: undefined,
})

const emit = defineEmits<{ submit: [event: Event] }>()
const ui = useUiCopy()
</script>

<template>
  <BsDialog v-model:visible="visible" :title="title" :dirty="dirty" :pending="pending" :size="size">
    <template #default="{ close }">
      <BsForm :pending="pending" :error="error" :layout="formLayout" :columns="formColumns" @submit="emit('submit', $event)">
        <slot :close="close" />
        <BsFormActions :label="actionsLabel">
          <slot name="actions" :close="close">
            <BsButton type="button" :disabled="pending" @click="close">{{ props.cancelLabel || ui('cancel') }}</BsButton>
            <BsButton type="submit" :variant="submitTone" :pending="pending" :disabled="submitDisabled">
              {{ props.submitLabel || ui('save') }}
            </BsButton>
          </slot>
        </BsFormActions>
      </BsForm>
    </template>
  </BsDialog>
</template>
