<script setup lang="ts">
import type { BsRoleOption } from '@building-suit/contracts'
const model = defineModel<string | number | Array<string | number> | null>({ default: null })
defineProps<{ title: string; description?: string; legend: string; options: BsRoleOption[]; pending?: boolean; error?: string; actionLabel: string; disabled?: boolean }>()
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <BsForm :pending="pending" :error="error" @submit="emit('submit')">
    <BsSectionHeader :title="title" :description="description" />
    <BsChoiceGroup v-model="model" type="radio" :legend="legend" :options="options" :disabled="pending || disabled" />
    <BsFormActions>
      <BsButton type="submit" variant="primary" :pending="pending" :disabled="disabled || model === null">{{ actionLabel }}</BsButton>
    </BsFormActions>
  </BsForm>
</template>
