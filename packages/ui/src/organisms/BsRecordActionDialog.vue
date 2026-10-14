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
  submitVisible?: boolean
  submitDisabled?: boolean
  formLayout?: 'stack' | 'grid'
  formColumns?: 1 | 2 | 3 | 4
  actionsLabel?: string
  pinnedActions?: boolean
}>(), {
  dirty: false,
  pending: false,
  error: null,
  size: 'md',
  submitLabel: undefined,
  cancelLabel: undefined,
  submitTone: 'primary',
  submitVisible: true,
  submitDisabled: false,
  formLayout: 'stack',
  formColumns: 1,
  actionsLabel: undefined,
  pinnedActions: false,
})

const emit = defineEmits<{ submit: [event: Event] }>()
const ui = useUiCopy()
const formId = useId()
</script>

<template>
  <BsDialog v-model:visible="visible" :title="title" :dirty="dirty" :pending="pending" :size="size">
    <template #default="{ close }">
      <BsForm :id="formId" :pending="pending" :error="error" :layout="formLayout" :columns="formColumns" @submit="emit('submit', $event)">
        <slot :close="close" />
        <BsFormActions v-if="!pinnedActions" :label="actionsLabel">
          <slot name="actions" :close="close">
            <BsButton type="button" :disabled="pending" @click="close">{{ props.cancelLabel || ui('cancel') }}</BsButton>
            <BsButton v-if="submitVisible" type="submit" :variant="submitTone" :pending="pending" :disabled="submitDisabled">
              {{ props.submitLabel || ui('save') }}
            </BsButton>
          </slot>
        </BsFormActions>
      </BsForm>
    </template>
    <template v-if="pinnedActions" #footer="{ close }">
      <BsFormActions :label="actionsLabel" align="between">
        <slot name="actions" :close="close" :form-id="formId">
          <BsButton type="button" :disabled="pending" @click="close">{{ props.cancelLabel || ui('cancel') }}</BsButton>
          <BsButton v-if="submitVisible" type="submit" :form="formId" :variant="submitTone" :pending="pending" :disabled="pending || submitDisabled">
            {{ props.submitLabel || ui('save') }}
          </BsButton>
        </slot>
      </BsFormActions>
    </template>
  </BsDialog>
</template>
