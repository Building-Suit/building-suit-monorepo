<script setup lang="ts">
import type { Slot } from 'vue'

defineProps<{
  render?: Slot
}>()
</script>

<template>
  <component :is="render" v-if="render" />
</template>
