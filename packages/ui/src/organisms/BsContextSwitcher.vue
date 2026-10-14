<script setup lang="ts">
import type { ScopeOption } from '@building-suit/contracts'
const model = defineModel<string | null>({ default: null })
defineProps<{ label: string; options: ScopeOption[]; placeholder?: string; createLabel?: string; createDisabled?: boolean }>()
defineEmits<{ create: [] }>()
</script>
<template><div class="bs-context-switcher"><BsScopeSwitcher v-model="model" :label="label" :options="options" :placeholder="placeholder" /><BsButton v-if="createLabel" variant="text" size="sm" :disabled="createDisabled" @click="$emit('create')"><BsIcon name="add" :size="18" />{{ createLabel }}</BsButton></div></template>
<style>.bs-context-switcher { display: grid; gap: var(--bs-space-2); }.bs-context-switcher > .ls-action-text { justify-content: flex-start; }</style>
