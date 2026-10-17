<script setup lang="ts">
defineProps<{ status: number; title: string; description: string; links: { to: string; label: string }[] }>()
</script>
<template>
  <BsStack gap="lg">
    <BsText as="p">{{ status }}</BsText>
    <BsHeading :level="1">{{ title }}</BsHeading>
    <BsText as="p">{{ description }}</BsText>
    <BsInline :wrap="true"><BsLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</BsLink></BsInline>
  </BsStack>
</template>
