<script setup lang="ts">
type EntityValue = string | number | null
const model = defineModel<EntityValue>({ default: null })
const picker = ref<{ focus: () => void } | null>(null)
defineExpose({ focus: () => picker.value?.focus() })
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
  showClear?: boolean
  retryLabel?: string
}>(), { loading: false, error: null, hasMore: false, disabled: false, showClear: false, retryLabel: undefined })
const emit = defineEmits<{ search: [query: string]; loadMore: []; retry: [] }>()
function search(event: { value?: string }) { emit('search', event.value || '') }
</script>

<template>
  <BsStack gap="sm" :aria-busy="loading">
    <BsSelect ref="picker" v-model="model" :label="label" :options="options" :option-label="optionLabel" :option-value="optionValue" :show-clear="showClear" filter virtual :loading="loading" :disabled="disabled" @filter="search" />
    <BsStateSurface v-if="error" state="error" :title="error" :action-label="retryLabel" @action="emit('retry')" />
    <BsButton v-if="hasMore" size="sm" :disabled="loading || disabled" @click="emit('loadMore')">{{ loadMoreLabel }}</BsButton>
  </BsStack>
</template>
