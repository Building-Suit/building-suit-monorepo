<script setup lang="ts">
defineProps<{ name?: 'default' | false }>()
</script>

<template>
  <NuxtLayout :name="name"><slot /></NuxtLayout>
</template>
