<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import BsHqWorkActivity from '../molecules/BsHqWorkActivity.vue'
import BsDisclosure from '../molecules/BsDisclosure.vue'
import BsButton from '../atoms/BsButton.vue'
import BsInput from '../atoms/BsInput.vue'
import BsTextarea from '../atoms/BsTextarea.vue'
import BsLink from '../atoms/BsLink.vue'
import BsField from '../molecules/BsField.vue'
import BsSelect from '../molecules/BsSelect.vue'
import type { HqAgentsPresentation, HqTaskRequest, HqWorkforceContent } from '../types/hqAgentsPresentation'

const props = defineProps<{ section: 'tasks' | 'team' | 'learning'; presentation: HqAgentsPresentation; content: HqWorkforceContent; locale?: string; selectedTaskId?: string | null; selectedLessonId?: string | null }>()
const emit = defineEmits<{ createTask: [request: HqTaskRequest]; refresh: []; 'update:selectedTaskId': [id: string | null] }>()
const assignee = ref<string | number | null>(null)
const title = ref(''), brief = ref(''), acceptance = ref('')
const dispatching = ref(false)
const followupSource = ref<{ id: string; updatedAt?: string; title: string; deliverable: string } | null>(null)
const localTaskId = ref<string | null>(null)
const selectedTaskId = computed({ get: () => props.selectedTaskId === undefined ? localTaskId.value : props.selectedTaskId, set: (id: string | null) => { localTaskId.value = id; emit('update:selectedTaskId', id) } })
let disposed = false
let pendingDraft: { request: HqTaskRequest; ids: Set<string> } | null = null
const tasks = computed(() => props.presentation.tasks ?? [])
const selected = computed(() => tasks.value.find(task => task.id === selectedTaskId.value) ?? null)
const sourceCurrent = computed(() => !followupSource.value || selected.value?.id === followupSource.value.id
  && selected.value.state === 'complete' && selected.value.updatedAt === followupSource.value.updatedAt
  && selected.value.deliverable === followupSource.value.deliverable)
const visibleLessons = computed(() => (props.presentation.lessons ?? []).filter(lesson => !props.selectedLessonId || lesson.id === props.selectedLessonId))
const blocked = computed(() => props.presentation.status !== 'connected' || props.presentation.sending || props.presentation.submittingTask || dispatching.value || !sourceCurrent.value)
const requestBrief = computed(() => followupSource.value && props.content.followup
  ? `${props.content.followup.briefPrefix}\n${followupSource.value.id} · ${followupSource.value.title}\n${followupSource.value.updatedAt ?? ''}\n\n${brief.value.trim()}` : brief.value.trim())
const options = computed<{ id: string | null; label: string; disabled?: boolean }[]>(() => [{ id: null, label: props.content.autoAssignLabel }, ...props.presentation.agents.map(agent => ({ id: agent.id, label: `${agent.name} · ${agent.roleLabel ?? agent.role}`, disabled: agent.configured === false }))])
const canSubmit = computed(() => !blocked.value && options.value.some(option => option.id === assignee.value && !option.disabled) && title.value.trim().length > 0 && title.value.length <= 180 && brief.value.trim().length > 0 && requestBrief.value.length <= 12000 && acceptance.value.trim().length > 0 && acceptance.value.length <= 6000)

function beginFollowup() {
  const task = selected.value, copy = props.content.followup
  if (!task || task.state !== 'complete' || !task.deliverable || !task.reviews.length || !copy) return
  followupSource.value = { id: task.id, title: task.title, updatedAt: task.updatedAt, deliverable: task.deliverable }
  title.value = `${copy.titlePrefix} ${task.title}`.slice(0, 180)
  brief.value = ''; acceptance.value = copy.acceptance; assignee.value = null
}
function cancelFollowup() { followupSource.value = null; title.value = ''; brief.value = ''; acceptance.value = ''; pendingDraft = null }
watch(selectedTaskId, () => { if (followupSource.value) cancelFollowup() })

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
async function submit() {
  if (!canSubmit.value) return
  const request = { assigneeId: typeof assignee.value === 'string' ? assignee.value : null, title: title.value.trim(), brief: requestBrief.value, acceptance: acceptance.value.trim() }
  pendingDraft = { request, ids: new Set(tasks.value.map(task => task.id)) }
  dispatching.value = true
  emit('createTask', request)
  await nextTick()
  if (!disposed) dispatching.value = false
}
watch(tasks, records => {
  if (!pendingDraft) return
  const draft = pendingDraft
  const saved = records.find(task => !draft.ids.has(task.id) && task.title === draft.request.title && task.brief === draft.request.brief && task.acceptance === draft.request.acceptance)
  if (!saved) return
  if (title.value.trim() === draft.request.title && requestBrief.value === draft.request.brief && acceptance.value.trim() === draft.request.acceptance) {
    title.value = ''; brief.value = ''; acceptance.value = ''; assignee.value = null
  }
  selectedTaskId.value = saved.id; pendingDraft = null
})
onBeforeUnmount(() => { disposed = true; pendingDraft = null; title.value = ''; brief.value = ''; acceptance.value = '' })
</script>

<template>
  <section class="bs-hq-workforce" :aria-busy="presentation.pending" @keydown="workforceKeydown">
    <div class="bs-hq-workforce__toolbar">
      <p v-if="section === 'team'" class="bs-hq-workforce__muted">{{ content.configuredNotice }}</p>
      <BsButton variant="text" size="sm" :disabled="presentation.pending || presentation.sending || presentation.submittingTask" @click="emit('refresh')">{{ content.refreshLabel }}</BsButton>
    </div>
    <p v-if="presentation.error" class="bs-hq-workforce__notice" role="alert">{{ presentation.error }}</p>
    <p v-if="presentation.status === 'loading'" class="bs-hq-workforce__muted" role="status">{{ content.loadingLabel }}</p>
    <p v-else-if="presentation.status === 'unavailable'" class="bs-hq-workforce__muted" role="status">{{ content.unavailableLabel }}</p>

    <template v-if="section === 'tasks'">
      <BsHqWorkActivity v-if="content.activity && presentation.workActivity" :items="presentation.workActivity" :copy="content.activity" :locale="locale" @open-task="selectedTaskId = $event" />
      <template v-if="selectedTaskId && !selected"><BsButton variant="text" size="sm" @click="selectedTaskId = null">{{ content.backLabel }}</BsButton><p class="bs-hq-workforce__muted" role="status">{{ content.unavailableLabel }}</p></template>
      <template v-if="selected">
        <BsButton variant="text" size="sm" @click="selectedTaskId = null">{{ content.backLabel }}</BsButton>
        <article class="bs-hq-workforce__detail">
          <header><h3 dir="auto">{{ selected.title }}</h3><p class="bs-hq-workforce__status" :data-state="selected.state">{{ selected.statusLabel }}</p><p class="bs-hq-workforce__muted">{{ selected.assigneeName }} · <time :datetime="selected.createdAt">{{ date(selected.createdAt) }}</time></p><p v-if="selected.completedAt && content.followup" class="bs-hq-workforce__muted">{{ content.followup.completed }} · <time :datetime="selected.completedAt">{{ date(selected.completedAt) }}</time></p></header>
          <p v-if="selected.error" class="bs-hq-workforce__notice" role="status">{{ selected.error }}</p>
          <section v-if="selected.state === 'complete' && selected.deliverable && content.followup" class="bs-hq-workforce__next">
            <h4>{{ content.followup.title }}</h4><p class="bs-hq-workforce__muted">{{ content.followup.explanation }}</p>
            <BsButton v-if="selected.reviews.length && !followupSource" variant="primary" :disabled="blocked" @click="beginFollowup">{{ content.followup.action }}</BsButton>
          </section>
          <form v-if="followupSource && content.followup" class="bs-hq-workforce__form" @submit.prevent="submit">
            <p class="bs-hq-workforce__muted">{{ content.followup.source }}: <bdi>{{ followupSource.id }}</bdi></p>
            <p class="bs-hq-workforce__muted">{{ content.followup.supported }}</p>
            <p v-if="!sourceCurrent" class="bs-hq-workforce__notice" role="alert">{{ content.followup.updated }}</p>
            <BsField v-slot="field" :label="content.titleLabel" required><BsInput :id="field.id" :model-value="title" :maxlength="180" :disabled="blocked" dir="auto" required @update:model-value="title = String($event)" /></BsField>
            <BsField v-slot="field" :label="content.assigneeLabel"><BsSelect v-model="assignee" :input-id="field.id" :options="options" option-label="label" option-value="id" option-disabled="disabled" :label="content.assigneeLabel" :disabled="blocked" append-to="self" /></BsField>
            <BsField v-slot="field" :label="content.followup.scope" :hint="content.followup.scopeHint" required><BsTextarea :id="field.id" v-model="brief" :rows="4" :maxlength="11000" :disabled="blocked" :aria-describedby="field.describedby" dir="auto" required /></BsField>
            <BsField v-slot="field" :label="content.followup.criteria" required><BsTextarea :id="field.id" v-model="acceptance" :rows="3" :maxlength="6000" :disabled="blocked" dir="auto" required /></BsField>
            <div class="bs-hq-workforce__actions"><BsButton type="submit" variant="primary" :pending="presentation.submittingTask || dispatching" :disabled="!canSubmit">{{ presentation.submittingTask || dispatching ? content.creatingLabel : content.followup.submit }}</BsButton><BsButton variant="text" :disabled="presentation.submittingTask || dispatching" @click="cancelFollowup">{{ content.followup.cancel }}</BsButton></div>
          </form>
          <section><h4>{{ content.deliverableLabel }}</h4><p v-if="selected.deliverable" class="bs-hq-workforce__prose" dir="auto">{{ selected.deliverable }}</p><p v-else class="bs-hq-workforce__muted">{{ content.pendingDeliverableLabel }}</p></section>
          <section><h4>{{ content.reviewsLabel }}</h4><ul v-if="selected.reviews.length" class="bs-hq-workforce__list"><li v-for="review in selected.reviews" :key="review.id"><strong dir="auto">{{ review.reviewer }} · {{ review.outcome }}</strong><p class="bs-hq-workforce__prose" dir="auto">{{ review.text }}</p></li></ul><p v-else class="bs-hq-workforce__muted">{{ content.pendingReviewLabel }}</p></section>
          <BsDisclosure :summary="content.briefLabel"><p class="bs-hq-workforce__prose" dir="auto">{{ selected.brief }}</p></BsDisclosure>
          <BsDisclosure :summary="content.acceptanceLabel"><p class="bs-hq-workforce__prose" dir="auto">{{ selected.acceptance }}</p></BsDisclosure>
        </article>
      </template>
      <template v-else-if="!selectedTaskId">
        <p v-if="!tasks.length" class="bs-hq-workforce__muted" role="status">{{ content.emptyTasksLabel }}</p>
        <ul v-else class="bs-hq-workforce__list"><li v-for="task in tasks" :key="task.id"><BsButton variant="tile" align="start" class="bs-hq-workforce__choice" @click="selectedTaskId = task.id"><strong dir="auto">{{ task.title }}</strong><span>{{ task.statusLabel }} · {{ task.assigneeName }}</span><time :datetime="task.completedAt ?? task.createdAt">{{ date(task.completedAt ?? task.createdAt) }}</time></BsButton></li></ul>
        <BsDisclosure :summary="content.newTaskLabel" :open="!tasks.length"><form class="bs-hq-workforce__form" @submit.prevent="submit">
          <h3>{{ content.newTaskLabel }}</h3>
          <BsField v-slot="field" :label="content.assigneeLabel"><BsSelect v-model="assignee" :input-id="field.id" :options="options" option-label="label" option-value="id" option-disabled="disabled" :label="content.assigneeLabel" :disabled="blocked" append-to="self" /></BsField>
          <BsField v-slot="field" :label="content.titleLabel" :hint="`${title.length} / 180`" required><BsInput :id="field.id" :model-value="title" :maxlength="180" :disabled="blocked" :aria-describedby="field.describedby" dir="auto" required @update:model-value="title = String($event)" /></BsField>
          <BsField v-slot="field" :label="content.briefLabel" :hint="`${brief.length} / 12000`" required><BsTextarea :id="field.id" v-model="brief" :rows="4" :maxlength="12000" :disabled="blocked" :aria-describedby="field.describedby" dir="auto" required /></BsField>
          <BsField v-slot="field" :label="content.acceptanceLabel" :hint="`${acceptance.length} / 6000`" required><BsTextarea :id="field.id" v-model="acceptance" :rows="3" :maxlength="6000" :disabled="blocked" :aria-describedby="field.describedby" dir="auto" required /></BsField>
          <BsButton type="submit" variant="primary" :pending="presentation.submittingTask || dispatching" :disabled="!canSubmit">{{ presentation.submittingTask || dispatching ? content.creatingLabel : content.createLabel }}</BsButton>
        </form></BsDisclosure>
      </template>
    </template>

    <template v-else-if="section === 'team'">
      <p v-if="!presentation.agents.length" class="bs-hq-workforce__muted" role="status">{{ content.emptyTeamLabel }}</p>
      <ul v-else class="bs-hq-workforce__list"><li v-for="agent in presentation.agents" :key="agent.id" class="bs-hq-workforce__employee"><header><strong dir="auto">{{ agent.name }}</strong><span>{{ agent.roleLabel }}</span></header><code>{{ agent.id }}</code><dl><div v-if="agent.departmentName"><dt>{{ content.departmentLabel }}</dt><dd dir="auto">{{ agent.departmentName }}</dd></div><div><dt>{{ content.lifecycleLabel }}</dt><dd>{{ agent.lifecycleLabel }}</dd></div><div><dt>{{ content.connectionLabel }}</dt><dd>{{ agent.connectionLabel ?? agent.activityLabel }}</dd></div></dl></li></ul>
    </template>

    <template v-else>
      <p v-if="!visibleLessons.length" class="bs-hq-workforce__muted" role="status">{{ selectedLessonId ? content.unavailableLabel : content.emptyLessonsLabel }}</p>
      <ul v-else class="bs-hq-workforce__list"><li v-for="lesson in visibleLessons" :key="lesson.id" class="bs-hq-workforce__detail"><header><h3 dir="auto">{{ lesson.title }}</h3><p class="bs-hq-workforce__muted">{{ lesson.agentName }} · {{ lesson.statusLabel }} · <time :datetime="lesson.createdAt">{{ date(lesson.createdAt) }}</time></p></header><p class="bs-hq-workforce__prose" dir="auto">{{ lesson.text }}</p><p v-if="lesson.taskId" class="bs-hq-workforce__muted">{{ content.sourceTaskLabel }}: <bdi>{{ lesson.taskId }}</bdi></p><p v-if="lesson.reviewedAt" class="bs-hq-workforce__muted">{{ content.reviewedLabel }}: <time :datetime="lesson.reviewedAt">{{ date(lesson.reviewedAt) }}</time></p><p v-if="lesson.publishedAt" class="bs-hq-workforce__muted">{{ content.publishedLabel }}: <time :datetime="lesson.publishedAt">{{ date(lesson.publishedAt) }}</time></p><p v-if="lesson.publicationReference" class="bs-hq-workforce__muted">{{ content.receiptLabel }}: <bdi>{{ lesson.publicationReference }}</bdi></p><BsLink v-if="sourceUrl(lesson.sourceUrl)" :to="sourceUrl(lesson.sourceUrl) ?? ''" external target="_blank">{{ content.lessonSourceLabel }}</BsLink></li></ul>
    </template>
  </section>
</template>

<style scoped>
.bs-hq-workforce { display: grid; gap: var(--bs-space-4); min-width: 0; color: var(--bs-text); }
.bs-hq-workforce h3, .bs-hq-workforce h4, .bs-hq-workforce p { margin: 0; }
.bs-hq-workforce h3 { font-size: .95rem; font-weight: var(--bs-weight-bold); line-height: 1.6; }
.bs-hq-workforce h4 { font-size: .8rem; font-weight: var(--bs-weight-bold); line-height: 1.6; }
.bs-hq-workforce__toolbar { display: flex; align-items: start; justify-content: space-between; gap: var(--bs-space-2); }
.bs-hq-workforce__form, .bs-hq-workforce__detail, .bs-hq-workforce__detail section { display: grid; gap: var(--bs-space-3); min-width: 0; }
.bs-hq-workforce__form { padding-block-end: var(--bs-space-4); border-block-end: 1px solid var(--bs-border); }
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
.bs-hq-workforce__next { padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-component-hq-glass-card); }
.bs-hq-workforce__actions { display: flex; flex-wrap: wrap; gap: var(--bs-space-2); }
.bs-hq-workforce :deep(textarea) { resize: vertical; max-height: 20rem; }
.bs-hq-workforce :deep(.ls-input) { background: var(--bs-surface); color: var(--bs-text); border-color: var(--bs-border); }
</style>
