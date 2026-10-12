<script setup lang="ts">
import type { BsAuditHistoryView, BsAuditHistoryCopy } from '../types/auditPresentation'
defineProps<{ items: BsAuditHistoryView[]; copy: BsAuditHistoryCopy; windowLabel: string; errorMessage: string; loading: boolean; loadingMore: boolean; hasMore: boolean }>()
const emit = defineEmits<{ loadMore: [] }>()
</script>
<template>
  <BsStack gap="lg">
    <BsBox as="header">
      <BsHeading :level="1" size="h1">{{ copy.title }}</BsHeading>
      <BsText size="sm" tone="muted">{{ copy.subtitle }}</BsText>
    </BsBox>
    <BsCard v-if="windowLabel" role="status" as="section" padding="md">
      <BsStack gap="xs">
        <BsText emphasis="semibold">{{ windowLabel }}</BsText>
        <BsText size="sm" tone="muted">{{ copy.stored }}</BsText>
      </BsStack>
    </BsCard>
    <BsText v-if="errorMessage" role="alert" tone="danger">{{ errorMessage }}</BsText>
    <BsSectionSkeleton v-if="loading" variant="table" :rows="7" />
    <BsEmptyState v-else-if="!items.length && !errorMessage" :title="copy.empty" />
    <template v-else-if="items.length">
      <BsCard as="div" padding="none">
        <BsDataTable
          :value="items"
          row-key="id"
          :columns="[{ key: 'column1', header: (copy.date) }, { key: 'column2', header: (copy.actor) }, { key: 'column3', header: (copy.activity) }, { key: 'column4', header: (copy.record) }, { key: 'column5', header: (copy.changes) }]"
        >
          <template #header-column1>{{ copy.date }}</template>
          <template #cell-column1="{ row }">{{ row.timestamp }}</template>
          <template #header-column2>{{ copy.actor }}</template>
          <template #cell-column2="{ row }">
            <BsBox dir="ltr">{{ row.actor }}</BsBox>
          </template>
          <template #header-column3>{{ copy.activity }}</template>
          <template #cell-column3="{ row }">
            <BsText>{{ row.activity }}</BsText>
            <BsText dir="ltr" size="xs" tone="muted">{{ row.action }}</BsText>
          </template>
          <template #header-column4>{{ copy.record }}</template>
          <template #cell-column4="{ row }">
            <BsText>{{ row.entity }}</BsText>
            <BsText v-if="row.entityId" dir="ltr" size="xs" tone="muted">{{ row.entityId }}</BsText>
          </template>
          <template #header-column5>{{ copy.changes }}</template>
          <template #cell-column5="{ row }">
            <BsDisclosure>
              <template #summary>{{ copy.viewChanges }}</template>
              <BsGrid :columns="1" gap="md">
                <BsBox>
                  <BsText emphasis="semibold">{{ copy.before }}</BsText>
                  <BsCodeBlock dir="ltr">{{ row.before }}</BsCodeBlock>
                </BsBox>
                <BsBox>
                  <BsText emphasis="semibold">{{ copy.after }}</BsText>
                  <BsCodeBlock dir="ltr">{{ row.after }}</BsCodeBlock>
                </BsBox>
                <BsBox>
                  <BsText emphasis="semibold">{{ copy.metadata }}</BsText>
                  <BsCodeBlock dir="ltr">{{ row.metadata }}</BsCodeBlock>
                </BsBox>
              </BsGrid>
            </BsDisclosure>
          </template>
        </BsDataTable>
      </BsCard>
      <BsInline v-if="hasMore" gap="none" :wrap="false" justify="center">
        <BsButton type="button" :disabled="loadingMore" @click="emit('loadMore')">{{ copy.loadMore }}</BsButton>
      </BsInline>
    </template>
  </BsStack>
</template>
