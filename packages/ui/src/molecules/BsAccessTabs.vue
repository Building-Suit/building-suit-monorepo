<script setup lang="ts">
const props = defineProps<{ modelValue: string; tabs: { key: string; label: string; count?: number; disabled?: boolean }[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const navigation = useTabNavigation(() => props.tabs, () => props.modelValue, key => emit('update:modelValue', key))
</script>
<template>
  <BsCard role="tablist" :aria-label="label" as="div" padding="sm">
    <BsStack gap="xs">
      <BsButton v-for="tab in tabs" :key="tab.key" variant="tab" type="button" role="tab" :aria-selected="modelValue === tab.key" :tabindex="navigation.tabindex(tab.key)" :disabled="tab.disabled" @keydown="navigation.onKeydown($event, tab.key)" @click="emit('update:modelValue', tab.key)"><BsInline as="span" gap="xs" :wrap="false">{{ tab.label }}<BsText v-if="tab.count !== undefined" as="span">{{ tab.count }}</BsText></BsInline></BsButton>
    </BsStack>
  </BsCard>
</template>
