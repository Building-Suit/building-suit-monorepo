<script setup lang="ts">
withDefaults(defineProps<{ to?: string | Record<string, unknown>; title?: string; description?: string; selected?: boolean; disabled?: boolean; external?: boolean; ariaLabel?: string }>(), {
  to: undefined, title: undefined, description: undefined, selected: false, disabled: false, external: undefined, ariaLabel: undefined,
})
defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template><BsActionTile v-bind="$props" class="bs-interactive-card" @click="$emit('click', $event)"><template #leading><slot name="leading" /></template><slot /><template #trailing><slot name="trailing" /></template></BsActionTile></template>
