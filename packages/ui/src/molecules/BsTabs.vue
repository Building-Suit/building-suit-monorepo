<script setup lang="ts">
export interface BsTabOption { label: string; value: string; disabled?: boolean }

defineProps<{ modelValue: string; tabs: BsTabOption[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="ls-tabs" role="tablist" :aria-label="label">
    <BsButton
      v-for="tab in tabs" :key="tab.value" variant="tab" role="tab"
      :aria-selected="modelValue === tab.value" :disabled="tab.disabled"
      @click="emit('update:modelValue', tab.value)"
    >{{ tab.label }}</BsButton>
  </div>
</template>
