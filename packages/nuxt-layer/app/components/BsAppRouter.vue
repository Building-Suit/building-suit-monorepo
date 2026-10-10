<script setup lang="ts">
defineProps<{
  layoutKey?: string
  pageKey?: string
}>()
</script>

<template>
  <NuxtLayout :key="layoutKey">
    <NuxtPage :key="pageKey" />
  </NuxtLayout>
</template>
