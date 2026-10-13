<script setup lang="ts">
import type { BsRoleOption } from '@building-suit/contracts'
const model = defineModel<string | null>({ default: null })
defineProps<{ label: string; options: BsRoleOption[]; disabled?: boolean; invalid?: boolean }>()
</script>

<template>
  <BsSelect v-model="model" :label="label" :options="options" option-label="label" option-value="value" option-disabled="disabled" :disabled="disabled" :invalid="invalid" />
</template>
