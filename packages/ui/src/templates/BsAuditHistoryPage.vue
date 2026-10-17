<script setup lang="ts">
import type { BsAuditHistoryView, BsAuditHistoryCopy } from '../types/auditPresentation'
const props = withDefaults(defineProps<{ summaryOnly?: boolean; controls?: { searchLabel: string; submitLabel: string; retryLabel: string; notice: string; governance: string; scopeKey: string|null; backTo: string; backLabel: string; page: number; pages: number; pageLabel: string; previous: string; next: string }; items: BsAuditHistoryView[]; copy: BsAuditHistoryCopy; windowLabel: string; errorMessage: string; loading: boolean; loadingMore: boolean; hasMore: boolean }>(), { summaryOnly: false })
const search = defineModel<string>('search', { default: '' })
const emit = defineEmits<{ loadMore: []; search: [scope: string|null,value: string]; retry: []; page: [scope: string|null,value: number] }>()
const columns = computed(() => [{ key: 'column1',header: props.copy.date },{ key: 'column2',header: props.copy.actor },{ key: 'column3',header: props.copy.activity },{ key: 'column4',header: props.copy.record },...(!props.summaryOnly ? [{ key: 'column5',header: props.copy.changes }] : [])])
</script>
<template>
  <BsStack class="bs-audit-history" gap="lg">
    <BsBox as="header">
      <BsHeading :level="1" size="h1">{{ copy.title }}</BsHeading>
      <BsText size="sm" tone="muted">{{ copy.subtitle }}</BsText>
    </BsBox>
    <BsStack v-if="controls">
      <BsLink :to="controls.backTo">{{ controls.backLabel }}</BsLink>
      <BsText as="p">{{ controls.notice }}</BsText>
      <BsText as="p">{{ controls.governance }}</BsText>
      <BsForm :pending="loading" @submit="emit('search',controls.scopeKey,search)"><BsField v-slot="field" :label="controls.searchLabel"><BsInput :id="field.id" v-model="search" :maxlength="120" /></BsField><BsButton type="submit" :disabled="loading">{{ controls.submitLabel }}</BsButton></BsForm>
      <BsButton v-if="errorMessage" :disabled="loading" @click="emit('retry')">{{ controls.retryLabel }}</BsButton>
    </BsStack>
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
          :columns="columns"
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
    <BsInline v-if="controls && !errorMessage" :wrap="true">
      <BsButton :disabled="loading || controls.page===0" @click="emit('page',controls.scopeKey,controls.page-1)">{{ controls.previous }}</BsButton>
      <BsText role="status">{{ controls.pageLabel }}</BsText>
      <BsButton :disabled="loading || controls.page+1>=controls.pages" @click="emit('page',controls.scopeKey,controls.page+1)">{{ controls.next }}</BsButton>
    </BsInline>
  </BsStack>
</template>

<style>
.bs-audit-history { inline-size: 100%; min-inline-size: 0; max-inline-size: 100%; }
</style>
