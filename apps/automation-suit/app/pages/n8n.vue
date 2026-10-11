<script setup lang="ts">
import type { BsExecutionActivityItem } from '@building-suit/ui/activity-presentation'
import { automationStatusTone } from '../utils/automationStatusTone'
interface N8nNode { id: string | null; name: string; type: string }
interface N8nWorkflow { id: string | null; name: string; active: boolean; updatedAt: string | null; nodes: N8nNode[]; connections: unknown[] }
interface N8nResponse { available: boolean; message?: string; workflows: N8nWorkflow[] }
const { data, error, refresh } = await useFetch<N8nResponse>('/api/n8n')
const activities = computed<BsExecutionActivityItem[]>(() => (data.value?.workflows ?? []).map(workflow => ({ id: workflow.id || workflow.name, title: workflow.name, status: workflow.active ? 'published' : 'inactive', statusLabel: workflow.active ? 'published' : 'inactive', statusTone: automationStatusTone(workflow.active ? 'published' : 'inactive'), summary: `${workflow.nodes.length} nodes · ${workflow.connections.length} connections · ${workflow.updatedAt || 'unknown sync time'}`, nodes: workflow.nodes.map(node => ({ id: node.id || node.name, label: node.name, detail: node.type })) })))
</script>
<template>
  <BsExecutionActivityPage eyebrow="Optional adapter" title="n8n inspection" description="Read-only normalized workflow snapshots. The control plane remains authoritative." :items="activities" :error="error?.message" :warning="!data?.available ? data?.message : undefined" refresh-label="Refresh" @refresh="refresh()" />
</template>
