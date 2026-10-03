<script setup lang="ts">
import Button from 'primevue/button'

defineOptions({ inheritAttrs: false })

type ButtonVariant = 'default' | 'primary' | 'secondary' | 'accent' | 'danger' | 'text' | 'link' | 'icon' | 'tab' | 'chip' | 'tile'

const props = withDefaults(defineProps<{
  pending?: boolean
  disabled?: boolean
  variant?: ButtonVariant
  /** PrimeVue-compatible migration alias. Prefer `variant`. */
  severity?: 'primary' | 'secondary' | 'danger'
  size?: 'default' | 'sm' | 'small' | 'large'
}>(), {
  pending: false,
  disabled: false,
  variant: 'default',
  severity: undefined,
  size: 'default',
})

const resolvedVariant = computed<ButtonVariant>(() => {
  if (props.variant !== 'default' || !props.severity) return props.variant
  return props.severity
})

const presentationClass = computed(() => {
  if (resolvedVariant.value === 'text') return 'ls-action-text'
  if (resolvedVariant.value === 'link') return 'ls-action-text ls-action-link'
  if (resolvedVariant.value === 'icon') return 'ls-action-icon'
  if (resolvedVariant.value === 'tab') return 'ls-action-tab'
  if (resolvedVariant.value === 'chip') return 'ls-action-chip'
  if (resolvedVariant.value === 'tile') return 'ls-action-tile'

  return [
    'ls-btn',
    {
      'ls-btn-primary': resolvedVariant.value === 'primary',
      'ls-btn-secondary': resolvedVariant.value === 'secondary',
      'ls-btn-accent': resolvedVariant.value === 'accent',
      'ls-btn-danger': resolvedVariant.value === 'danger',
      'ls-btn-sm': props.size === 'sm' || props.size === 'small',
    },
  ]
})
</script>

<template>
  <Button
    type="button"
    v-bind="$attrs"
    :class="presentationClass"
    :disabled="disabled || pending"
    :loading="pending"
    :size="size === 'small' || size === 'large' ? size : undefined"
    :aria-busy="pending"
    :data-pending="pending || undefined"
  >
    <slot />
  </Button>
</template>
