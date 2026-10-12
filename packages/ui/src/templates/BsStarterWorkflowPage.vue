<script setup lang="ts">
defineProps<{
  title: string
  description: string
  feature: { title: string; description: string; actionLabel: string; result: string }
  started: boolean
}>()
const emit = defineEmits<{ start: [] }>()
</script>
<template>
  <BsContentSection :title="title" :description="description" padding="lg">
    <BsStack>
      <BsContentSection :title="feature.title" :description="feature.description">
        <BsButton variant="primary" :disabled="started" @click="emit('start')">{{ feature.actionLabel }}</BsButton>
      </BsContentSection>
      <BsText v-if="started" role="status">{{ feature.result }}</BsText>
    </BsStack>
  </BsContentSection>
</template>
