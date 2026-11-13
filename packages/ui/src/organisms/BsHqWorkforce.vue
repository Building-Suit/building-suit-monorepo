<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { HqTaskCancellationResult } from '../utils/hqTaskBrowserSource'
import BsHqTaskBrowser from './BsHqTaskBrowser.vue'
import BsHqWorkActivity from '../molecules/BsHqWorkActivity.vue'
import BsDisclosure from '../molecules/BsDisclosure.vue'
import BsButton from '../atoms/BsButton.vue'
import { useHqTaskBrowserSource } from '../utils/hqTaskBrowserSource'
import type { HqAgentsPresentation, HqTaskPresentation, HqWorkforceContent } from '../types/hqAgentsPresentation'

const props = defineProps<{ section: 'tasks' | 'team' | 'learning'; presentation: HqAgentsPresentation; content: HqWorkforceContent; locale?: string; selectedTaskId?: string | null; selectedLessonId?: string | null; browseOnly?: boolean; detailOnly?: boolean }>()
const emit = defineEmits<{ refresh: []; openTask: [id: string, title?: string]; openLearning: [id: string]; 'update:selectedTaskId': [id: string | null] }>()
const taskSource = useHqTaskBrowserSource()
const confirmation = useConfirmation()
const cancelConfirming = ref(false)
const cancellationFeedback = ref<HqTaskCancellationResult | null>(null)
let selectionEpoch = 0, disposed = false
const localTaskId = ref<string | null>(null)
const selectedTaskId = computed({ get: () => props.selectedTaskId === undefined ? localTaskId.value : props.selectedTaskId, set: (id: string | null) => { localTaskId.value = id; emit('update:selectedTaskId', id) } })
const tasks = computed(() => [...(props.presentation.tasks ?? [])].sort((a, b) => {
  const rank = { active: 0, pending: 1, blocked: 2, complete: 3 }
  return rank[a.state] - rank[b.state] || Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)
}))
const detailTask = ref<HqTaskPresentation | null>(null)
const detailPending = ref(false)
let detailRequest: AbortController | null = null
watch([selectedTaskId, () => props.presentation.taskBrowserRevision, () => props.presentation.status], async () => {
  detailRequest?.abort(); detailTask.value = null; detailPending.value = false
  const id = selectedTaskId.value
  if (!id || !taskSource || props.presentation.status !== 'connected') return
  const request = new AbortController(); detailRequest = request; detailPending.value = true
  try {
    const result = await taskSource.detail(id, request.signal)
    if (!request.signal.aborted) detailTask.value = result
  } catch { /* Existing bounded snapshot remains available during recovery. */ }
  finally { if (!request.signal.aborted) detailPending.value = false }
}, { immediate: true })
const selected = computed(() => detailTask.value ?? tasks.value.find(task => task.id === selectedTaskId.value) ?? null)
watch([selectedTaskId, () => props.presentation.status], () => {
  selectionEpoch += 1; cancellationFeedback.value = null
}, { flush: 'sync' })
async function cancelSelected() {
  const task = selected.value, copy = props.content.cancellation
  if (!task?.canCancel || !copy || !taskSource?.cancel || cancelConfirming.value || props.presentation.taskCancellationPending || props.presentation.status !== 'connected') return
  const expected = selectionEpoch, id = task.id
  cancelConfirming.value = true; cancellationFeedback.value = null
  try {
    const accepted = await confirmation.ask({ title: copy.title, message: `${copy.message}\n\n${task.title}\n${id}`, confirmLabel: copy.action, cancelLabel: copy.keep, tone: 'danger' })
    if (!accepted || disposed || expected !== selectionEpoch || selected.value?.id !== id || !selected.value.canCancel || props.presentation.status !== 'connected') return
    const result = await taskSource.cancel(id)
    if (!disposed && expected === selectionEpoch && selectedTaskId.value === id && props.presentation.status === 'connected') cancellationFeedback.value = result
  } finally { if (!disposed) cancelConfirming.value = false }
}
function selectTask(id: string, title?: string) {
  if (props.browseOnly) emit('openTask', id, title)
  else selectedTaskId.value = id
}
function openTask(task: HqTaskPresentation) { selectTask(task.id, task.title) }

const visibleLessons = computed(() => (props.presentation.lessons ?? []).filter(lesson => !props.selectedLessonId || lesson.id === props.selectedLessonId))

function date(value: string): string {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(props.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : value
}
function sourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname) ? url.href : undefined
  } catch { return undefined }
}
function workforceKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') event.stopPropagation()
}
onBeforeUnmount(() => { disposed = true; selectionEpoch += 1; detailRequest?.abort() })
</script>

<template>
  <section class="bs-hq-workforce" :aria-busy="presentation.pending" @keydown="workforceKeydown">
    <div v-if="!detailOnly" class="bs-hq-workforce__toolbar">
      <p v-if="section === 'team'" class="bs-hq-workforce__muted">{{ content.configuredNotice }}</p>
      <BsButton :disabled="presentation.pending || presentation.sending" @click="emit('refresh')" variant="icon" :aria-label="content.refreshLabel" :title="content.refreshLabel"><BsIcon name="refresh" :size="18" /></BsButton>
    </div>
    <p v-if="presentation.error" class="bs-hq-workforce__notice" role="alert">{{ presentation.error }}</p>
    <p v-if="presentation.status === 'loading'" class="bs-hq-workforce__muted" role="status">{{ content.loadingLabel }}</p>
    <p v-else-if="presentation.status === 'unavailable'" class="bs-hq-workforce__muted" role="status">{{ content.unavailableLabel }}</p>

    <template v-if="section === 'tasks'">
      <BsHqWorkActivity v-if="!selectedTaskId && !taskSource && content.activity && presentation.workActivity" :items="presentation.workActivity" :copy="content.activity" :locale="locale" @open-task="selectTask" />
      <p v-if="detailPending" role="status">{{ content.loadingLabel }}</p>
      <template v-else-if="selectedTaskId && !selected"><BsButton v-if="!detailOnly" variant="secondary" size="sm" @click="selectedTaskId = null">{{ content.backLabel }}</BsButton><p class="bs-hq-workforce__muted" role="status">{{ content.unavailableLabel }}</p></template>
      <template v-else-if="selected">
        <BsButton v-if="!detailOnly" variant="secondary" size="sm" @click="selectedTaskId = null">{{ content.backLabel }}</BsButton>
        <article class="bs-hq-workforce__detail">
          <header><h3 dir="auto">{{ selected.title }}</h3><p class="bs-hq-workforce__status" :data-state="selected.state">{{ selected.statusLabel }}</p><p class="bs-hq-workforce__muted">{{ selected.assigneeName }} · <time :datetime="selected.createdAt">{{ date(selected.createdAt) }}</time></p><p v-if="selected.completedAt && content.completedLabel" class="bs-hq-workforce__muted">{{ content.completedLabel }} · <time :datetime="selected.completedAt">{{ date(selected.completedAt) }}</time></p></header>
          <section v-if="content.cancellation && taskSource?.cancel && presentation.status === 'connected'" :aria-busy="presentation.taskCancellationPending">
            <BsButton v-if="selected.canCancel" variant="danger" size="sm" :disabled="presentation.taskCancellationPending" @click="cancelSelected">{{ presentation.taskCancellationPending ? content.cancellation.pending : content.cancellation.action }}</BsButton>
            <p v-if="cancellationFeedback" class="bs-hq-workforce__notice" role="status">{{ content.cancellation[cancellationFeedback] }}</p>
          </section>
          <p v-if="selected.error" class="bs-hq-workforce__notice" role="status">{{ selected.error }}</p>
          <section><h4>{{ content.deliverableLabel }}</h4><p v-if="selected.deliverable" class="bs-hq-workforce__prose" dir="auto">{{ selected.deliverable }}</p><p v-else class="bs-hq-workforce__muted">{{ content.pendingDeliverableLabel }}</p></section>
          <section><h4>{{ content.reviewsLabel }}</h4><ul v-if="selected.reviews.length" class="bs-hq-workforce__list"><li v-for="review in selected.reviews" :key="review.id"><strong dir="auto">{{ review.reviewer }} · {{ review.outcome }}</strong><p class="bs-hq-workforce__prose" dir="auto">{{ review.text }}</p></li></ul><p v-else class="bs-hq-workforce__muted">{{ content.pendingReviewLabel }}</p></section>
          <BsDisclosure :summary="content.briefLabel"><p class="bs-hq-workforce__prose" dir="auto">{{ selected.brief }}</p></BsDisclosure>
          <BsDisclosure :summary="content.acceptanceLabel"><p class="bs-hq-workforce__prose" dir="auto">{{ selected.acceptance }}</p></BsDisclosure>
        </article>
      </template>
      <template v-else-if="!selectedTaskId && !detailOnly">
        <BsHqTaskBrowser v-if="taskSource && content.taskBrowser && presentation.status === 'connected'" :source="taskSource" :revision="presentation.taskBrowserRevision" :copy="content.taskBrowser" :agents="presentation.agents" show-owner :locale="locale" @select="openTask" />
        <p v-else-if="!tasks.length" class="bs-hq-workforce__muted" role="status">{{ content.emptyTasksLabel }}</p>
        <ul v-else class="bs-hq-workforce__list"><li v-for="task in tasks" :key="task.id"><BsButton variant="tile" align="start" class="bs-hq-workforce__choice" @click="selectTask(task.id, task.title)"><strong dir="auto">{{ task.title }}</strong><span>{{ task.statusLabel }} · {{ task.assigneeName }}</span><time :datetime="task.completedAt ?? task.createdAt">{{ date(task.completedAt ?? task.createdAt) }}</time></BsButton></li></ul>
      </template>
    </template>

    <template v-else-if="section === 'team'">
      <p v-if="!presentation.agents.length" class="bs-hq-workforce__muted" role="status">{{ content.emptyTeamLabel }}</p>
      <ul v-else class="bs-hq-workforce__list"><li v-for="agent in presentation.agents" :key="agent.id" class="bs-hq-workforce__employee"><header><strong dir="auto">{{ agent.name }}</strong><span>{{ agent.roleLabel }}</span></header><code>{{ agent.id }}</code><dl><div v-if="agent.departmentName"><dt>{{ content.departmentLabel }}</dt><dd dir="auto">{{ agent.departmentName }}</dd></div><div><dt>{{ content.lifecycleLabel }}</dt><dd>{{ agent.lifecycleLabel }}</dd></div><div><dt>{{ content.connectionLabel }}</dt><dd>{{ agent.connectionLabel ?? agent.activityLabel }}</dd></div></dl></li></ul>
    </template>

    <template v-else>
      <p v-if="!visibleLessons.length" class="bs-hq-workforce__muted" role="status">{{ selectedLessonId ? content.unavailableLabel : content.emptyLessonsLabel }}</p>
      <ul v-else class="bs-hq-workforce__list"><li v-for="lesson in visibleLessons" :key="lesson.id" class="bs-hq-workforce__detail"><header><BsButton v-if="browseOnly" variant="tile" align="start" @click="emit('openLearning', lesson.id)"><bdi>{{ lesson.title }}</bdi></BsButton><h3 v-else dir="auto">{{ lesson.title }}</h3><p class="bs-hq-workforce__muted">{{ lesson.agentName }} · {{ lesson.statusLabel }} · <time :datetime="lesson.createdAt">{{ date(lesson.createdAt) }}</time></p></header><template v-if="!browseOnly"><p class="bs-hq-workforce__prose" dir="auto">{{ lesson.text }}</p><p v-if="lesson.taskId" class="bs-hq-workforce__muted">{{ content.sourceTaskLabel }}: <bdi>{{ lesson.taskId }}</bdi></p><p v-if="lesson.reviewedAt" class="bs-hq-workforce__muted">{{ content.reviewedLabel }}: <time :datetime="lesson.reviewedAt">{{ date(lesson.reviewedAt) }}</time></p><p v-if="lesson.publishedAt" class="bs-hq-workforce__muted">{{ content.publishedLabel }}: <time :datetime="lesson.publishedAt">{{ date(lesson.publishedAt) }}</time></p><p v-if="lesson.publicationReference" class="bs-hq-workforce__muted">{{ content.receiptLabel }}: <bdi>{{ lesson.publicationReference }}</bdi></p><BsButton as="a" variant="secondary" size="sm" v-if="sourceUrl(lesson.sourceUrl)" :href="sourceUrl(lesson.sourceUrl)" target="_blank" rel="noopener noreferrer">{{ content.lessonSourceLabel }}</BsButton></template></li></ul>
    </template>
  </section>
</template>

<style scoped>
.bs-hq-workforce { display: grid; gap: var(--bs-space-4); min-width: 0; color: var(--bs-text); }
.bs-hq-workforce h3, .bs-hq-workforce h4, .bs-hq-workforce p { margin: 0; }
.bs-hq-workforce h3 { font-size: .95rem; font-weight: var(--bs-weight-bold); line-height: 1.6; }
.bs-hq-workforce h4 { font-size: .8rem; font-weight: var(--bs-weight-bold); line-height: 1.6; }
.bs-hq-workforce__toolbar { display: flex; align-items: start; justify-content: space-between; gap: var(--bs-space-2); }
.bs-hq-workforce__detail, .bs-hq-workforce__detail section { display: grid; gap: var(--bs-space-3); min-width: 0; }
.bs-hq-workforce__list { display: grid; gap: var(--bs-space-4); margin: 0; padding: 0; list-style: none; }
.bs-hq-workforce__list > li + li { padding-block-start: var(--bs-space-4); border-block-start: 1px solid var(--bs-border); }
.bs-hq-workforce__muted, .bs-hq-workforce__choice span, .bs-hq-workforce__choice time { color: var(--bs-text-muted); font-size: .75rem; line-height: 1.7; overflow-wrap: anywhere; }
.bs-hq-workforce__prose { font-size: .82rem; line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; }
.bs-hq-workforce__choice { display: grid; gap: var(--bs-space-1); width: 100%; text-align: start; }
.bs-hq-workforce__status { color: var(--bs-accent); font-size: .75rem; line-height: 1.7; }
.bs-hq-workforce__employee header { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--bs-space-2); font-size: .85rem; }
.bs-hq-workforce__employee header span { color: var(--bs-text-muted); font-size: .75rem; }
.bs-hq-workforce__employee code { color: var(--bs-text-muted); font-size: .68rem; }
.bs-hq-workforce dl { display: grid; gap: var(--bs-space-1); margin-block: var(--bs-space-2) 0; font-size: .75rem; line-height: 1.7; }
.bs-hq-workforce dl > div { display: grid; grid-template-columns: minmax(5rem, .7fr) minmax(0, 1fr); gap: var(--bs-space-2); }
.bs-hq-workforce dt { color: var(--bs-text-muted); } .bs-hq-workforce dd { margin: 0; overflow-wrap: anywhere; }
.bs-hq-workforce__notice { color: var(--bs-text); font-size: .78rem; line-height: 1.7; padding: var(--bs-space-3); border-inline-start: 2px solid var(--bs-accent); background: var(--bs-surface-muted); }
</style>
