<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
interface N8nNode { id: string | null; name: string; type: string }
interface N8nWorkflow { id: string | null; name: string; active: boolean; updatedAt: string | null; nodes: N8nNode[]; connections: unknown[] }
interface N8nResponse { available: boolean; message?: string; workflows: N8nWorkflow[] }
const { data, error, refresh } = await useFetch<N8nResponse>('/api/n8n')
</script>
<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between">
      <BsStack gap="sm">
        <BsText size="xs" tone="muted" emphasis="semibold">
          Optional adapter
        </BsText>
        <BsHeading :level="1">
          n8n inspection
        </BsHeading>
        <BsText size="sm" tone="muted">
          Read-only normalized workflow snapshots. The control plane remains authoritative.
        </BsText>
      </BsStack>
      <BsButton @click="refresh()">
        Refresh
      </BsButton>
    </BsInline>
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <BsAlert v-if="!data?.available" tone="warning" :description="data?.message" />
    <BsCard v-for="workflow in data?.workflows || []" :key="workflow.id || workflow.name">
      <BsStack gap="sm">
        <BsInline justify="between">
          <BsHeading :level="2">
            {{ workflow.name }}
          </BsHeading>
          <BsStatusBadge :status="workflow.active ? 'published' : 'inactive'" :label="workflow.active ? 'published' : 'inactive'" :tone="automationStatusTone(workflow.active ? 'published' : 'inactive')" />
        </BsInline>
        <BsText size="xs" tone="muted">
          {{ workflow.nodes.length }} nodes · {{ workflow.connections.length }} connections · {{ workflow.updatedAt || 'unknown sync time' }}
        </BsText>
        <BsStack gap="sm">
          <BsCard v-for="node in workflow.nodes" :key="node.id || node.name" variant="flat" padding="sm">
            <BsStack gap="sm">
              <BsText as="strong" emphasis="semibold">
                {{ node.name }}
              </BsText>
              <BsText as="span" size="xs" tone="muted">
                {{ node.type }}
              </BsText>
            </BsStack>
          </BsCard>
        </BsStack>
      </BsStack>
    </BsCard>
  </BsPage>
</template>
