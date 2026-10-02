<script setup lang="ts">
// Calm and instructive, never apologetic. Anatomy per the brand guidelines:
// short headline, one line of guidance, one primary action — and gold only on
// that single action.
defineProps<{
  title: string
  description?: string
  actionLabel?: string
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <BsStateSurface state="empty" :title="title" :description="description" :action-label="actionLabel" @action="$emit('action')" />
</template>
