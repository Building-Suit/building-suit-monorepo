<script setup lang="ts">
const props = withDefaults(defineProps<{
  name?: string
  email?: string
  avatarUrl?: string
  compact?: boolean
}>(), {
  name: '',
  email: '',
  avatarUrl: '',
  compact: false,
})

const initials = computed(() => {
  const source = props.name.trim() || props.email.trim()
  if (!source) return ''
  return source
    .split(/[\s@._-]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toLocaleUpperCase())
    .join('')
})
</script>

<template>
  <div class="flex min-w-0 items-center gap-3" dir="auto">
    <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-muted text-sm font-bold text-fg" aria-hidden="true">
      <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover">
      <span v-else>{{ initials || '·' }}</span>
    </span>
    <span v-if="!compact" class="min-w-0">
      <span v-if="name" class="block truncate font-semibold text-fg">{{ name }}</span>
      <span v-if="email" class="block truncate text-sm text-fg-muted">{{ email }}</span>
    </span>
  </div>
</template>
