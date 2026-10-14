<script setup lang="ts">
withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical'; tone?: 'default' | 'strong'; spacing?: 'none' | 'sm' | 'md' | 'lg' }>(), {
  orientation: 'horizontal', tone: 'default', spacing: 'md',
})
</script>

<template><hr class="bs-divider" :class="[`bs-divider--${orientation}`, `bs-divider--${tone}`, `bs-divider--spacing-${spacing}`]"></template>
