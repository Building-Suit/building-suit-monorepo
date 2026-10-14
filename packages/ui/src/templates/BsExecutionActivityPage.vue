<script setup lang="ts">
import type { BsExecutionActivityItem } from '../types/activityPresentation'
defineProps<{ eyebrow: string; title: string; description?: string; items: BsExecutionActivityItem[]; error?: string | null; warning?: string; emptyLabel?: string; refreshLabel?: string }>()
const emit = defineEmits<{ refresh: []; action: [key: 'copy-error' | 'copy-diagnostic', id: string] }>()
</script>
<template>
  <BsPage padding="none" width="full">
    <BsStack gap="md">
      <BsInline justify="between" :wrap="true"><BsStack gap="sm"><BsText size="xs" tone="muted" emphasis="semibold">{{ eyebrow }}</BsText><BsHeading :level="1">{{ title }}</BsHeading><BsText v-if="description" size="sm" tone="muted">{{ description }}</BsText></BsStack><BsButton v-if="refreshLabel" @click="emit('refresh')">{{ refreshLabel }}</BsButton></BsInline>
      <BsAlert v-if="error" tone="error" :description="error" />
      <BsAlert v-if="warning" tone="warning" :description="warning" />
      <BsEmptyState v-if="!items.length && emptyLabel" :title="emptyLabel" />
      <BsCard v-for="item in items" :key="item.id">
        <BsStack gap="sm">
          <BsInline justify="between" :wrap="true"><BsStack gap="sm"><BsHeading :level="2">{{ item.title }}</BsHeading><BsText v-if="item.subtitle" size="xs" tone="muted">{{ item.subtitle }}</BsText><BsText v-if="item.description" size="sm" tone="muted">{{ item.description }}</BsText></BsStack><BsStatusBadge :status="item.status" :label="item.statusLabel" :tone="item.statusTone" /></BsInline>
          <BsText v-if="item.attempt">{{ item.attempt }}</BsText><BsText v-if="item.date">{{ item.date }}</BsText><BsText v-if="item.summary" size="sm">{{ item.summary }}</BsText>
          <BsInline v-if="item.actions?.length || item.taskLink" :wrap="true"><BsButton v-for="action in item.actions" :key="action.key" size="sm" @click="emit('action', action.key, item.id)">{{ action.label }}</BsButton><BsLink v-if="item.taskLink" :to="item.taskLink.to">{{ item.taskLink.label }}</BsLink></BsInline>
          <BsText v-if="item.guidance" size="xs" tone="muted">{{ item.guidance }}</BsText>
          <BsStack v-if="item.nodes" gap="sm"><BsCard v-for="node in item.nodes" :key="node.id" variant="flat" padding="sm"><BsStack gap="sm"><BsText emphasis="semibold">{{ node.label }}</BsText><BsText size="xs" tone="muted">{{ node.detail }}</BsText></BsStack></BsCard></BsStack>
        </BsStack>
      </BsCard>
    </BsStack>
  </BsPage>
</template>
