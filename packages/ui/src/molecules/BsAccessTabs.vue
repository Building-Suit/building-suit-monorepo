<script setup lang="ts">
defineProps<{ modelValue: string; tabs: { key: string; label: string; count?: number; disabled?: boolean }[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <BsCard role="tablist" :aria-label="label" as="div" padding="sm">
    <BsStack gap="xs">
      <BsButton v-for="tab in tabs" :key="tab.key" variant="tab" type="button" role="tab" :aria-selected="modelValue === tab.key" :disabled="tab.disabled" @click="emit('update:modelValue', tab.key)">{{ tab.label }} <BsText v-if="tab.count !== undefined" as="span">{{ tab.count }}</BsText></BsButton>
    </BsStack>
  </BsCard>
</template>
