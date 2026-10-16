<script setup lang="ts">
defineProps<{
  product: { name: string; homeLabel: string; title: string; description: string }
  title: string
  description: string
  status: string
  statusDescription: string
  signOut: string
  pending?: boolean
  links?: { label: string; to: string }[]
  error?: string | null
  availability?: { state: 'loading' | 'error' | 'permission'; title: string; description: string }
}>()
const emit = defineEmits<{ signOut: [] }>()
</script>
<template>
  <BsProductAuthFrame :product="product">
    <BsStateSurface v-if="availability" :title-level="1" :state="availability.state" :title="availability.title" :description="availability.description" />
    <BsStack v-else>
      <BsHeading :level="1">{{ title }}</BsHeading>
      <BsText as="p">{{ description }}</BsText>
      <BsStateSurface state="success" :title="status" :description="statusDescription" />
      <BsAlert v-if="error" tone="error" :description="error" />
      <BsLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</BsLink>
      <BsButton :pending="pending" :disabled="pending" @click="emit('signOut')">{{ signOut }}</BsButton>
    </BsStack>
  </BsProductAuthFrame>
</template>
