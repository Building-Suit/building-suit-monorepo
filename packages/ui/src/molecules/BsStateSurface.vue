<script setup lang="ts">
const props = withDefaults(defineProps<{
  state: 'loading' | 'empty' | 'error' | 'denied' | 'permission' | 'read-only' | 'info' | 'warning' | 'success'
  title: string
  description?: string
  actionLabel?: string
}>(), { description: undefined, actionLabel: undefined })

defineEmits<{ action: [] }>()
const icon = computed(() => ({ loading: 'repeat', empty: 'reports', error: 'notification', denied: 'lock', permission: 'lock', 'read-only': 'lock', info: 'notification', warning: 'notification', success: 'check' })[props.state])
</script>

<template>
  <div class="ls-state-surface" :data-state="state" :role="state === 'error' ? 'alert' : 'status'" :aria-busy="state === 'loading' || undefined">
    <BsIcon :name="icon" :class="state === 'loading' ? 'animate-spin' : ''" />
    <div class="min-w-0"><p class="font-bold">{{ title }}</p><p v-if="description" class="mt-1 text-sm text-fg-muted">{{ description }}</p></div>
    <BsButton v-if="actionLabel" size="sm" :variant="state === 'error' ? 'primary' : 'default'" @click="$emit('action')">{{ actionLabel }}</BsButton>
  </div>
</template>
