<script setup lang="ts">
const tags = defineModel<string[]>({ default: () => [] })
const props = withDefaults(defineProps<{ label: string; addLabel: string; removeLabel: string; placeholder?: string; disabled?: boolean; allowDuplicates?: boolean }>(), { placeholder: undefined, disabled: false, allowDuplicates: false })
const draft = ref('')
function add() {
  const value = draft.value.trim()
  if (!value || props.disabled || (!props.allowDuplicates && tags.value.includes(value))) return
  tags.value = [...tags.value, value]
  draft.value = ''
}
function remove(index: number) {
  if (props.disabled) return
  tags.value = tags.value.filter((_tag, itemIndex) => itemIndex !== index)
}
</script>

<template>
  <BsStack gap="sm" :aria-label="label">
    <BsInline gap="sm" wrap>
      <BsButton v-for="(tag, index) in tags" :key="`${tag}-${index}`" variant="chip" :disabled="disabled" :aria-label="`${removeLabel}: ${tag}`" @click="remove(index)">{{ tag }} ×</BsButton>
    </BsInline>
    <BsInline gap="sm" wrap>
      <BsInput v-model="draft" :aria-label="label" :placeholder="placeholder" :disabled="disabled" @keydown.enter.prevent="add" />
      <BsButton :disabled="disabled || !draft.trim()" @click="add">{{ addLabel }}</BsButton>
    </BsInline>
  </BsStack>
</template>
