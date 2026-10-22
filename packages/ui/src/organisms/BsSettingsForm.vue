<script setup lang="ts">
withDefaults(defineProps<{
  pending: boolean
  disabled?: boolean
  error?: string | null
  success?: string
  dirty: boolean
  allowPristineCancel?: boolean
  submitDisabled?: boolean
  submitLabel: string
  cancelLabel: string
}>(), { disabled: false, error: null, success: '', submitDisabled: false, allowPristineCancel: false })
const emit = defineEmits<{ submit: []; cancel: [] }>()
</script>

<template>
  <BsContainer width="md" padding="none" :center="false">
    <BsForm :pending="pending" :disabled="disabled" :error="error" @submit="emit('submit')">
      <slot />
      <BsText v-if="success" role="status" tone="success">{{ success }}</BsText>
      <BsFormActions v-if="!disabled" align="start">
        <BsButton type="submit" variant="primary" :pending="pending" :disabled="submitDisabled || !dirty">{{ submitLabel }}</BsButton>
        <BsButton type="button" :disabled="pending || (!dirty && !allowPristineCancel)" @click="emit('cancel')">{{ cancelLabel }}</BsButton>
      </BsFormActions>
    </BsForm>
  </BsContainer>
</template>
