<script setup lang="ts">
import Button from 'primevue/button'
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ pending?: boolean; disabled?: boolean; variant?: 'default' | 'primary' }>(), {
  pending: false, disabled: false, variant: 'default',
})
</script>

<template>
  <Button type="button" v-bind="$attrs" class="ls-btn" :class="{ 'ls-btn-primary': variant === 'primary' }" :disabled="disabled || pending" :loading="pending" :aria-busy="pending">
    <slot />
  </Button>
</template>
