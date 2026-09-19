<script setup lang="ts">
definePageMeta({
  middleware: [to => navigateTo({ path: '/transactions', query: { ...to.query, import: '1' } }, { replace: true })],
})
</script>
<template><div /></template>
