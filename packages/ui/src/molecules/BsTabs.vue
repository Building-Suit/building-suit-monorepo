<script setup lang="ts">
export interface BsTabOption { label: string; value: string; disabled?: boolean }

const props = defineProps<{ modelValue: string; tabs: BsTabOption[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const navigation = useTabNavigation(() => props.tabs.map(tab => ({ key: tab.value, disabled: tab.disabled })), () => props.modelValue, key => emit('update:modelValue', key))
</script>

<template>
  <div class="ls-tabs" role="tablist" :aria-label="label">
    <BsButton
      v-for="tab in tabs" :key="tab.value" variant="tab" role="tab"
      :aria-selected="modelValue === tab.value" :tabindex="navigation.tabindex(tab.value)" :disabled="tab.disabled" @keydown="navigation.onKeydown($event, tab.value)"
      @click="emit('update:modelValue', tab.value)"
    >{{ tab.label }}</BsButton>
  </div>
</template>
