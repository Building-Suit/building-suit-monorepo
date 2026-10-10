<script setup lang="ts">
defineProps<{ label: string; removeLabel: string; removable?: boolean; disabled?: boolean; error?: string }>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <li class="bs-line-item">
    <fieldset :disabled="disabled" :aria-label="label">
      <legend>{{ label }}</legend>
      <div class="bs-line-item__fields">
        <slot />
      </div>
      <p v-if="error" role="alert" class="bs-line-item__error">{{ error }}</p>
      <BsButton v-if="removable" variant="text" :disabled="disabled" :aria-label="`${removeLabel}: ${label}`" @click="emit('remove')">{{ removeLabel }}</BsButton>
    </fieldset>
  </li>
</template>
