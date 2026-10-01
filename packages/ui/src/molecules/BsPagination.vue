<script setup lang="ts">
const props = withDefaults(defineProps<{
  page: number
  pageSize?: number
  total: number
  label: string
  previousLabel: string
  nextLabel: string
}>(), { pageSize: 20 })

const emit = defineEmits<{ 'update:page': [page: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const current = computed(() => Math.min(Math.max(1, props.page), pages.value))
</script>

<template>
  <nav class="ls-pagination" :aria-label="label">
    <BsButton size="sm" :disabled="current <= 1" @click="emit('update:page', current - 1)">{{ previousLabel }}</BsButton>
    <span aria-live="polite">{{ current }} / {{ pages }}</span>
    <BsButton size="sm" :disabled="current >= pages" @click="emit('update:page', current + 1)">{{ nextLabel }}</BsButton>
  </nav>
</template>
