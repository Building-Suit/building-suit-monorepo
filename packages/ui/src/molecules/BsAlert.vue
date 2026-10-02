<script setup lang="ts">
const props = withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'error' | 'permission' | 'read-only'; title?: string; description?: string; actionLabel?: string }>(), {
  tone: 'info', title: undefined, description: undefined, actionLabel: undefined,
})
defineEmits<{ action: [] }>()
const icon = computed(() => ({ info: 'notification', success: 'check', warning: 'notification', error: 'close', permission: 'lock', 'read-only': 'lock' })[props.tone])
</script>

<template><aside class="bs-alert" :class="`bs-alert--${tone}`" :role="tone === 'error' ? 'alert' : 'status'"><BsIcon :name="icon" /><div class="bs-alert__content"><strong v-if="title">{{ title }}</strong><p v-if="description">{{ description }}</p><slot /></div><BsButton v-if="actionLabel" size="sm" variant="text" @click="$emit('action')">{{ actionLabel }}</BsButton></aside></template>
