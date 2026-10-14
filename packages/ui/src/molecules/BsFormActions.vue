<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
  align?: 'start' | 'center' | 'end' | 'between'
  stackOnMobile?: boolean
  sticky?: boolean
}>(), {
  label: undefined,
  align: 'end',
  stackOnMobile: true,
  sticky: false,
})
</script>

<template>
  <div
    class="bs-form-actions"
    role="group"
    :aria-label="label"
    :data-align="align"
    :data-stack-mobile="stackOnMobile || undefined"
    :data-sticky="sticky || undefined"
  ><slot /></div>
</template>
