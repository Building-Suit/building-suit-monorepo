<script setup lang="ts">
defineProps<{
  title: string
  description: string
  notice: { title: string; description: string }
  loading: boolean
  loadingLabel: string
  error?: string | null
  retryLabel: string
  denied?: { title: string; description: string }
  profile?: { title: string; fields: { id: string; label: string; value: string }[] }
  location?: { title: string; fields: { id: string; label: string; value: string }[] }
  actions: { label: string; to: string }[]
}>()
const emit = defineEmits<{ retry: [] }>()
</script>
<template>
  <BsContentSection padding="lg">
    <BsStack gap="lg">
      <BsHeading :level="1">{{ title }}</BsHeading>
      <BsText as="p" tone="muted">{{ description }}</BsText>
      <BsAlert tone="info" :title="notice.title" :description="notice.description" />
      <BsStateSurface v-if="loading" state="loading" :title="loadingLabel" />
      <BsStateSurface v-else-if="denied" state="permission" :title="denied.title" :description="denied.description" />
      <BsStateSurface v-else-if="error" state="error" :title="error" :action-label="retryLabel" @action="emit('retry')" />
      <template v-else>
        <BsContentSection v-if="profile" :title="profile.title"><BsDescriptionList><BsDescriptionItem v-for="field in profile.fields" :key="field.id" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList></BsContentSection>
        <BsContentSection v-if="location" :title="location.title"><BsDescriptionList><BsDescriptionItem v-for="field in location.fields" :key="field.id" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList></BsContentSection>
        <BsInline :wrap="true"><BsLink v-for="action in actions" :key="action.to" :to="action.to">{{ action.label }}</BsLink></BsInline>
      </template>
    </BsStack>
  </BsContentSection>
</template>
