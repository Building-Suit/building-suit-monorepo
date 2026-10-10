<script setup lang="ts">
const file = defineModel<File | null>({ default: null })
const props = defineProps<{ label: string; description?: string; accept?: string; disabled?: boolean; invalid?: boolean }>()
const emit = defineEmits<{ select: [file: File | null] }>()
const dragging = ref(false)
function select(value: File | File[] | null) {
  if (props.disabled) return
  file.value = Array.isArray(value) ? value[0] || null : value
  emit('select', file.value)
}
function drop(event: DragEvent) {
  dragging.value = false
  const dropped = event.dataTransfer?.files[0]
  if (!props.disabled && dropped) select(dropped)
}
</script>
<template>
  <div class="bs-file-drop" :data-dragging="dragging && !disabled || undefined" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="drop">
    <BsFileInput :model-value="file" :label="label" :accept="accept" :disabled="disabled" :invalid="invalid" @update:model-value="select" />
    <p v-if="description">{{ description }}</p>
  </div>
</template>
