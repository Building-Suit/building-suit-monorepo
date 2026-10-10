<script setup lang="ts">
type EntityValue = string | number | null
const model = defineModel<EntityValue>({ default: null })
withDefaults(defineProps<{
  label: string
  options: object[]
  optionLabel: string
  optionValue: string
  loading?: boolean
  error?: string | null
  hasMore?: boolean
  loadMoreLabel: string
  disabled?: boolean
}>(), { loading: false, error: null, hasMore: false, disabled: false })
const emit = defineEmits<{ search: [query: string]; loadMore: [] }>()
function search(event: { value?: string }) { emit('search', event.value || '') }
</script>

<template>
  <BsStack gap="sm" :aria-busy="loading">
    <BsSelect v-model="model" :label="label" :options="options" :option-label="optionLabel" :option-value="optionValue" filter virtual :loading="loading" :disabled="disabled" @filter="search" />
    <BsStateSurface v-if="error" state="error" :title="error" />
    <BsButton v-if="hasMore" size="sm" :disabled="loading || disabled" @click="emit('loadMore')">{{ loadMoreLabel }}</BsButton>
  </BsStack>
</template>
