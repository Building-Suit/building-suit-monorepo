<script setup lang="ts">
import type { BsTaskDetailView, BsTaskDetailCopy } from '../types/taskDetailPresentation'
defineProps<{ task?: BsTaskDetailView | null; copy: BsTaskDetailCopy; error?: string | null }>()
const emit = defineEmits<{ refresh: []; copyAction: [id: string]; copyChatPrompt: []; copyRepairPrompt: [] }>()
</script>
<template>
  <BsPage padding="none" width="full">
    <BsAlert v-if="error" tone="error" :description="error" />
    <template v-if="task">
      <BsInline justify="between" align="start"><BsStack gap="sm"><BsText size="xs" tone="muted" emphasis="semibold">{{ task.context }}</BsText><BsHeading :level="1">{{ task.title }}</BsHeading><BsText size="sm" tone="muted">{{ task.description }}</BsText></BsStack><BsInline><BsStatusBadge :status="task.status" :label="task.statusLabel" :tone="task.statusTone" /><BsButton @click="emit('refresh')">{{ copy.refresh }}</BsButton></BsInline></BsInline>
      <BsGrid :columns="2" as="section"><BsKpiCard :title="task.attempt.label" :hint="task.attempt.hint"><BsText as="span" size="lg" emphasis="bold">{{ task.attempt.value }}</BsText></BsKpiCard><BsKpiCard :title="task.profile.label" :hint="task.profile.hint"><BsText as="span" size="lg" emphasis="bold">{{ task.profile.value }}</BsText></BsKpiCard><BsKpiCard :title="task.stage.label"><BsText as="span" size="lg" emphasis="bold">{{ task.stage.value }}</BsText></BsKpiCard><BsKpiCard :title="task.usage.label" :hint="task.usage.hint"><BsText as="span" size="lg" emphasis="bold">{{ task.usage.value }}</BsText></BsKpiCard></BsGrid>
      <BsCard as="section" :title="copy.actions"><BsStack gap="sm"><BsText size="xs" tone="muted">{{ copy.actionHint }}</BsText><BsInline><BsButton v-for="action in task.actions" :key="action.id" size="sm" @click="emit('copyAction', action.id)">{{ action.label }}</BsButton><BsButton size="sm" @click="emit('copyChatPrompt')">{{ copy.chatPrompt }}</BsButton><BsButton size="sm" @click="emit('copyRepairPrompt')">{{ copy.repairPrompt }}</BsButton></BsInline></BsStack></BsCard>
      <BsCard as="section" :title="copy.verification"><BsStack gap="sm"><BsInline v-for="check in task.checks" :key="check.id" justify="between"><BsStack gap="sm"><BsText as="strong" emphasis="semibold">{{ check.name }}</BsText><BsText size="xs" tone="muted">{{ check.description }}</BsText></BsStack><BsStack gap="sm"><BsStatusBadge :status="check.status" :label="check.statusLabel" :tone="check.statusTone" /><BsText size="xs" tone="muted">{{ check.elapsed }}</BsText></BsStack></BsInline></BsStack></BsCard>
      <BsGrid :columns="2" as="section"><BsCard :title="copy.process"><BsDescriptionList density="compact"><BsDescriptionItem :term="copy.worktree">{{ task.process.worktree }}</BsDescriptionItem><BsDescriptionItem :term="copy.branch">{{ task.process.branch }}</BsDescriptionItem><BsDescriptionItem :term="copy.parent">{{ task.process.parent }}</BsDescriptionItem><BsDescriptionItem :term="copy.prompt">{{ task.process.prompt }}</BsDescriptionItem><BsDescriptionItem :term="copy.log">{{ task.process.log }}</BsDescriptionItem></BsDescriptionList></BsCard><BsCard :title="copy.packet"><BsCodeBlock>{{ task.packet }}</BsCodeBlock></BsCard></BsGrid>
      <BsCard as="section" :title="copy.timeline"><BsStack gap="sm"><BsDisclosure v-for="event in task.events" :key="event.id" :summary="event.summary"><BsCodeBlock>{{ event.payload }}</BsCodeBlock></BsDisclosure></BsStack></BsCard>
    </template>
  </BsPage>
</template>
