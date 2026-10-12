<script setup lang="ts">
defineProps<{ printLabel: string; backLabel?: string; backTo?: string; disabled?: boolean }>()
const emit = defineEmits<{ print: [] }>()
</script>

<template>
  <BsInline class="bs-print-actions" gap="sm" wrap>
    <BsLink v-if="backTo && backLabel" :to="backTo">{{ backLabel }}</BsLink>
    <BsButton variant="primary" :disabled="disabled" @click="emit('print')">{{ printLabel }}</BsButton>
    <slot />
  </BsInline>
</template>
