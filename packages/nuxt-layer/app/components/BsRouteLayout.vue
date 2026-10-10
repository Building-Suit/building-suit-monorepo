<script setup lang="ts">
defineProps<{ name?: string | false }>()
</script>

<template>
  <NuxtLayout :name="name"><slot /></NuxtLayout>
</template>
