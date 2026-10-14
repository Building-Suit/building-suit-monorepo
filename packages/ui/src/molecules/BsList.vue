<script setup lang="ts">
withDefaults(defineProps<{ ordered?: boolean; marker?: 'disc' | 'decimal' | 'none' | 'check'; spacing?: 'compact' | 'normal' | 'relaxed' }>(), {
  ordered: false, marker: 'disc', spacing: 'normal',
})
</script>

<template><component :is="ordered ? 'ol' : 'ul'" class="bs-list" :class="[`bs-list--marker-${marker}`, `bs-list--spacing-${spacing}`]"><slot /></component></template>
