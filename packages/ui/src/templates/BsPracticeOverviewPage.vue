<script setup lang="ts">
interface ActivityRow { id: string; patient: string; time: string; status: string }
interface ActivitySection { id: string; scope: string; title: string; window: string; total: number; queueTotal: number; page: number; queuePage: number; items: ActivityRow[]; queue: ActivityRow[] }
const props = defineProps<{
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
  activity?: { title: string; description: string; today: string; queue: string; appointments: string; patient: string; time: string; status: string; source: string; refresh: string; refreshed: string; empty: string; noRows: string; previous: string; next: string; pages: string; queuePages: string }
  activitySections?: ActivitySection[]
  activityLoading?: boolean
  activityPending?: boolean
  activityError?: string|null
  refreshedAt?: string|null
}>()
const emit = defineEmits<{ retry: []; refresh: []; page: [scope: string,page: number,queue: boolean]; source: [scope: string,id: string] }>()
const columns = computed(() => props.activity ? [{ key: 'patient',field: 'patient',header: props.activity.patient },{ key: 'time',field: 'time',header: props.activity.time },{ key: 'status',field: 'status',header: props.activity.status },{ key: 'source',header: props.activity.source }] : [])
</script>
<template>
  <BsBox as="section">
    <BsStack gap="lg">
      <BsPageHeader :title="title" :subtitle="description"><template v-if="actions.length" #actions><BsLink v-for="action in actions" :key="action.to" :to="action.to" variant="standalone">{{ action.label }}</BsLink></template></BsPageHeader>
      <BsAlert tone="info" :title="notice.title" :description="notice.description" />
      <BsStateSurface v-if="loading" state="loading" :title="loadingLabel" />
      <BsStateSurface v-else-if="denied" state="permission" :title="denied.title" :description="denied.description" />
      <BsStateSurface v-else-if="error" state="error" :title="error" :action-label="retryLabel" @action="emit('retry')" />
      <template v-else>
        <BsStack v-if="activity" gap="lg">
          <BsSectionHeader :title="activity.title" :description="activity.description"><template #actions><BsButton :disabled="activityPending" @click="emit('refresh')">{{ activity.refresh }}</BsButton></template></BsSectionHeader>
          <BsText v-if="refreshedAt" as="p" size="sm">{{ activity.refreshed }}: {{ refreshedAt }}</BsText>
          <BsSectionSkeleton v-if="activityLoading" :rows="4" />
          <BsStateSurface v-else-if="activityError" state="error" :title="activityError"><BsButton :disabled="activityPending" @click="emit('refresh')">{{ activity.refresh }}</BsButton></BsStateSurface>
          <BsStateSurface v-else-if="!activitySections?.length" state="empty" :title="activity.empty" />
          <BsPanel v-for="section in activityLoading || activityError ? [] : activitySections" :key="section.scope" padding="md"><BsStack gap="md">
            <BsHeading :level="3">{{ section.title }}</BsHeading><BsText as="p">{{ section.window }}</BsText>
            <BsGrid :columns="2"><BsKpiCard :title="activity.today" role="group" :aria-label="activity.today">{{ section.total }}</BsKpiCard><BsKpiCard :title="activity.queue" role="group" :aria-label="activity.queue">{{ section.queueTotal }}</BsKpiCard></BsGrid>
            <BsHeading :level="4">{{ activity.appointments }}</BsHeading>
            <BsDataTable :value="section.items" :columns="columns" row-key="id" :label="`${section.title} · ${activity.appointments}`"><template #cell-source="{ row }"><BsButton size="sm" :disabled="activityPending" @click="emit('source',section.scope,row.id)">{{ activity.source }}</BsButton></template><template #empty><BsStateSurface state="empty" :title="activity.noRows" /></template></BsDataTable>
            <BsPagination :page="section.page+1" :total="section.total" :label="`${section.title} · ${activity.pages}`" :previous-label="activity.previous" :next-label="activity.next" @update:page="emit('page',section.scope,$event-1,false)" />
            <BsHeading :level="4">{{ activity.queue }}</BsHeading>
            <BsDataTable :value="section.queue" :columns="columns" row-key="id" :label="`${section.title} · ${activity.queue}`"><template #cell-source="{ row }"><BsButton size="sm" :disabled="activityPending" @click="emit('source',section.scope,row.id)">{{ activity.source }}</BsButton></template><template #empty><BsStateSurface state="empty" :title="activity.noRows" /></template></BsDataTable>
            <BsPagination :page="section.queuePage+1" :total="section.queueTotal" :label="`${section.title} · ${activity.queuePages}`" :previous-label="activity.previous" :next-label="activity.next" @update:page="emit('page',section.scope,$event-1,true)" />
          </BsStack></BsPanel>
        </BsStack>
        <BsGrid v-if="profile || location" :columns="2"><BsPanel v-if="profile" padding="md"><BsHeading :level="2">{{ profile.title }}</BsHeading><BsDescriptionList><BsDescriptionItem v-for="field in profile.fields" :key="field.id" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList></BsPanel><BsPanel v-if="location" padding="md"><BsHeading :level="2">{{ location.title }}</BsHeading><BsDescriptionList><BsDescriptionItem v-for="field in location.fields" :key="field.id" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList></BsPanel></BsGrid>
      </template>
    </BsStack>
  </BsBox>
</template>
