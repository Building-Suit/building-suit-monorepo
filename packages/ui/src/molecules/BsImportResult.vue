<script setup lang="ts">
defineProps<{ title: string; description: string; success: boolean; actionLabel?: string }>()
const emit = defineEmits<{ restart: [] }>()
</script>

<template>
  <BsStateSurface :state="success ? 'success' : 'error'" :title="title" :description="description" :action-label="actionLabel" @action="emit('restart')">
    <slot />
  </BsStateSurface>
</template>
