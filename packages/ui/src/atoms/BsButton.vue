<script setup lang="ts">
import Button from 'primevue/button'
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  pending?: boolean
  disabled?: boolean
  variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'danger'
  size?: 'default' | 'sm' | 'small' | 'large'
}>(), {
  pending: false, disabled: false, variant: 'default', size: 'default',
})
</script>

<template>
  <Button
    type="button"
    v-bind="$attrs"
    class="ls-btn"
    :class="{
      'ls-btn-primary': variant === 'primary',
      'ls-btn-secondary': variant === 'secondary',
      'ls-btn-accent': variant === 'accent',
      'ls-btn-danger': variant === 'danger',
      'ls-btn-sm': size === 'sm' || size === 'small',
    }"
    :disabled="disabled || pending"
    :loading="pending"
    :size="size === 'small' || size === 'large' ? size : undefined"
    :aria-busy="pending"
    :data-pending="pending || undefined"
  >
    <slot />
  </Button>
</template>
