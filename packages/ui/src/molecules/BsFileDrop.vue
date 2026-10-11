<script setup lang="ts">
import { useFileDrop } from '@building-suit/ux'
const file = defineModel<File | null>({ default: null })
const props = defineProps<{ label: string; description?: string; accept?: string; disabled?: boolean; invalid?: boolean }>()
const emit = defineEmits<{ select: [file: File | null] }>()
const { dragging, select, drop } = useFileDrop(file, () => Boolean(props.disabled), value => emit('select', value))
</script>
<template>
  <div class="bs-file-drop" :data-dragging="dragging && !disabled || undefined" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="drop">
    <BsFileInput :model-value="file" :label="label" :accept="accept" :disabled="disabled" :invalid="invalid" @update:model-value="select" />
    <p v-if="description">{{ description }}</p>
  </div>
</template>
