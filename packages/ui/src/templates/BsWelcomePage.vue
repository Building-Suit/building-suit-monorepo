<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>
<template>
  <BsPage width="sm" padding="none"><BsCard as="section" padding="lg"><BsStack gap="sm"><BsHeading :level="1">{{ title }}</BsHeading><BsText tone="muted">{{ description }}</BsText></BsStack></BsCard></BsPage>
</template>
