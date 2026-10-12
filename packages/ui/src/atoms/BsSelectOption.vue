<script setup lang="ts">
import { inject, type Ref } from 'vue'
defineProps<{ value?: string | number | boolean | null; selected?: boolean }>()
const model = inject<Ref<unknown> | undefined>('bs-native-select-value', undefined)
</script>

<template><option :value="value" :selected="selected || (model !== undefined && Object.is(model, value))"><slot /></option></template>
