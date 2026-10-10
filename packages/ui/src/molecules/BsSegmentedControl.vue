<script setup lang="ts">
export interface BsSegmentedOption { label: string; value: string; disabled?: boolean }
defineProps<{ modelValue: string; options: BsSegmentedOption[]; label: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template><div class="bs-segmented-control" role="radiogroup" :aria-label="label"><BsButton v-for="option in options" :key="option.value" variant="chip" role="radio" :aria-checked="modelValue === option.value" :disabled="option.disabled" @click="$emit('update:modelValue', option.value)">{{ option.label }}</BsButton></div></template>
