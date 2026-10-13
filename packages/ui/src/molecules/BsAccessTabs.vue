<script setup lang="ts">
defineProps<{ modelValue: string; tabs: { key: string; label: string; count?: number; disabled?: boolean }[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <BsTabs :model-value="modelValue" :label="label" :tabs="tabs.map(tab => ({ value: tab.key, label: tab.label, count: tab.count, disabled: tab.disabled }))" @update:model-value="emit('update:modelValue', $event)" />
</template>
