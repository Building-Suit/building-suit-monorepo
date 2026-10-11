<script setup lang="ts">
import { tabNavigationTarget } from '@building-suit/ux'
const props = defineProps<{ modelValue: string; tabs: { key: string; label: string; count?: number; disabled?: boolean }[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
function navigate(event: KeyboardEvent, current: string) {
  const target = event.currentTarget as HTMLElement
  const direction = getComputedStyle(target).direction === 'rtl' ? 'rtl' : 'ltr'
  const key = tabNavigationTarget(props.tabs.filter(tab => !tab.disabled).map(tab => tab.key), current, event.key, direction)
  if (key === undefined) return
  event.preventDefault()
  emit('update:modelValue', key)
  const buttons = target.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]')
  const index = props.tabs.findIndex(tab => tab.key === key)
  buttons?.[index]?.focus()
}
</script>
<template>
  <BsCard role="tablist" :aria-label="label" as="div" padding="sm">
    <BsStack gap="xs">
      <BsButton v-for="tab in tabs" :key="tab.key" variant="tab" type="button" role="tab" :aria-selected="modelValue === tab.key" :tabindex="modelValue === tab.key ? 0 : -1" @keydown="navigate($event, tab.key)" :disabled="tab.disabled" @click="emit('update:modelValue', tab.key)">{{ tab.label }} <BsText v-if="tab.count !== undefined" as="span">{{ tab.count }}</BsText></BsButton>
    </BsStack>
  </BsCard>
</template>
