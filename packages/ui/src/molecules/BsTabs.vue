<script setup lang="ts">
export interface BsTabOption { label: string; value: string; disabled?: boolean; count?: number }

const props = defineProps<{ modelValue: string; tabs: BsTabOption[]; label: string; idPrefix?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const navigation = useTabNavigation(() => props.tabs.map(tab => ({ key: tab.value, disabled: tab.disabled })), () => props.modelValue, key => emit('update:modelValue', key))
</script>

<template>
  <div class="ls-tabs" role="tablist" :aria-label="label">
    <BsButton
      v-for="tab in tabs" :id="idPrefix ? `${idPrefix}-${tab.value}` : undefined" :key="tab.value" variant="tab"
      role="tab" :aria-controls="idPrefix ? `${idPrefix}-panel` : undefined" :aria-selected="modelValue === tab.value" :tabindex="navigation.tabindex(tab.value)" :disabled="tab.disabled" @keydown="navigation.onKeydown($event, tab.value)"
      @click="emit('update:modelValue', tab.value)"
    ><BsInline as="span" gap="xs" :wrap="false">{{ tab.label }}<BsText v-if="tab.count !== undefined" as="span">{{ tab.count }}</BsText></BsInline></BsButton>
  </div>
</template>
