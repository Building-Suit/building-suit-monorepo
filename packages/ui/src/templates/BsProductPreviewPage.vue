<script setup lang="ts">
defineProps<{
  productName: string
  eyebrow: string
  title: string
  description: string
  notice: string
  featuresTitle: string
  features: { id: string; title: string; description: string; status: string }[]
  workflowTitle: string
  workflow: { id: string; title: string; description: string }[]
  actionLabel: string
  scopeNotice: string
  scopeVisible: boolean
  previewLink: { label: string; to: string }
}>()
const emit = defineEmits<{ inspectScope: [] }>()
</script>
<template>
  <BsPage width="xl" padding="lg">
    <BsInline as="header" justify="between" :wrap="true">
      <BsText emphasis="bold">{{ productName }}</BsText>
      <BsSettingsMenu always-show-label />
    </BsInline>
    <BsContentSection padding="lg">
      <BsStack gap="lg">
        <BsText size="sm" tone="muted">{{ eyebrow }}</BsText>
        <BsHeading :level="1">{{ title }}</BsHeading>
        <BsText tone="muted">{{ description }}</BsText>
        <BsAlert tone="info">{{ notice }}</BsAlert>
        <BsInline :wrap="true">
          <BsButton variant="primary" :disabled="scopeVisible" @click="emit('inspectScope')">{{ actionLabel }}</BsButton>
          <BsLink :to="previewLink.to">{{ previewLink.label }}</BsLink>
        </BsInline>
        <BsText v-if="scopeVisible" role="status">{{ scopeNotice }}</BsText>
      </BsStack>
    </BsContentSection>
    <BsContentSection :title="featuresTitle">
      <BsGrid :columns="3">
        <BsCard v-for="feature in features" :key="feature.id" padding="lg">
          <BsStack gap="sm">
            <BsStatusBadge :status="feature.status" tone="neutral" />
            <BsHeading :level="3" size="body">{{ feature.title }}</BsHeading>
            <BsText tone="muted">{{ feature.description }}</BsText>
          </BsStack>
        </BsCard>
      </BsGrid>
    </BsContentSection>
    <BsContentSection :title="workflowTitle">
      <BsStack gap="lg">
        <BsContentSection v-for="step in workflow" :key="step.id" :title="step.title" :description="step.description" />
      </BsStack>
    </BsContentSection>
  </BsPage>
</template>
