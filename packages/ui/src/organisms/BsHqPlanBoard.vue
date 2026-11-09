<script setup lang="ts">
import { computed, useId } from 'vue'
import type { HqCompanyPlansCopy, HqCompanyPlansPresentation, HqStaffingCopy, HqStaffingPresentation } from '../types/hqLayoutPresentation'

const props = defineProps<{
  copy: HqCompanyPlansCopy
  workspace: HqCompanyPlansPresentation
  staffing?: HqStaffingPresentation
  staffingCopy?: HqStaffingCopy
}>()
const emit = defineEmits<{ open: [kind: 'plan' | 'staffing', id: string] }>()
const boardId = useId()
type Column = 'discussion' | 'preparation' | 'blocked' | 'done'
type Note = {
  id: string
  title: string
  category: string
  status: string
  summary: string
} & ({ kind: 'plan' | 'staffing' } | { kind: 'brain'; sourceUrl?: string })
const columnOrder: readonly Column[] = ['discussion', 'preparation', 'blocked', 'done']
const backlogColumns = { pending: 'discussion', ongoing: 'preparation', done: 'done' } as const
const staffingColumns: Readonly<Partial<Record<string, Column>>> = {
  'approval-required': 'discussion',
  planning: 'preparation',
  'planning-blocked': 'blocked',
  'publication-blocked': 'blocked',
  failed: 'blocked',
  rejected: 'done',
  canceled: 'done',
  'not-required': 'done',
}
const columns = computed(() => {
  const notes: Record<Column, Note[]> = { discussion: [], preparation: [], blocked: [], done: [] }
  const statusLabels = { ready: props.copy.readyLabel, approved: props.copy.approvedLabel, rejected: props.copy.rejectedLabel }
  for (const plan of props.workspace.backlog?.plans ?? []) {
    const column = backlogColumns[plan.status]
    notes[column].push({
      ...plan,
      kind: 'brain',
      category: props.copy.board.brainLabel,
      status: props.copy.board[column],
    })
  }
  for (const plan of props.workspace.plans) {
    notes[plan.status === 'ready' ? 'discussion' : 'done'].push({
      kind: 'plan',
      id: plan.id,
      title: plan.title,
      category: plan.legacy ? props.copy.legacyLabel : props.copy.title,
      status: statusLabels[plan.status],
      summary: plan.summary,
    })
  }
  if (props.staffingCopy) {
    for (const row of props.staffing?.workflows ?? []) {
      notes[staffingColumns[row.status] ?? 'blocked'].push({
        kind: 'staffing',
        id: row.id,
        title: row.plan ? `${row.plan.name} · ${row.plan.agentId}` : row.statusLabel,
        category: props.staffingCopy.title,
        status: row.statusLabel,
        summary: row.plan?.originalTask.title ?? row.blockerLabel,
      })
    }
  }
  return columnOrder.map(id => ({ id, title: props.copy.board[id], notes: notes[id] }))
})
const loading = computed(() => props.workspace.status === 'loading' || props.staffing?.status === 'loading' || props.workspace.backlog?.status === 'loading')
const limitedStaffing = computed(() => (props.staffing?.totalCount ?? 0) > (props.staffing?.workflows.length ?? 0))
function noteId(note: Note) { return `${boardId}-${note.kind}-${note.id}` }
</script>

<template>
  <div class="bs-hq-plan-board" :aria-busy="loading">
    <p class="bs-hq-plan-board__description">{{ copy.board.description }}</p>
    <p v-if="loading" role="status">{{ copy.loading }}</p>
    <p v-if="workspace.message || workspace.status === 'unavailable'" role="status">{{ workspace.message || copy.unavailable }}</p>
    <p v-if="staffingCopy && (staffing?.message || staffing?.status === 'unavailable')" role="status">{{ staffing?.message || staffingCopy.unavailable }}</p>
    <p v-if="workspace.backlog?.status === 'unavailable'" role="status">{{ copy.board.brainUnavailable }}</p>
    <p v-if="limitedStaffing && staffingCopy" role="status">{{ staffingCopy.limited }}</p>
    <div class="bs-hq-plan-board__columns">
      <section v-for="column in columns" :key="column.id" class="bs-hq-plan-board__column" :data-stage="column.id" :aria-labelledby="`${boardId}-${column.id}`">
        <header class="bs-hq-plan-board__column-heading">
          <h3 :id="`${boardId}-${column.id}`">{{ column.title }}</h3>
          <span>{{ column.notes.length }}</span>
        </header>
        <p v-if="!column.notes.length && !loading" class="bs-hq-plan-board__empty">{{ copy.board.empty }}</p>
        <ul v-if="column.notes.length" class="bs-hq-plan-board__notes">
          <li v-for="note in column.notes" :key="noteId(note)">
            <article v-if="note.kind === 'brain'" class="bs-hq-plan-board__note" :aria-labelledby="noteId(note)">
              <span class="bs-hq-plan-board__category">{{ note.category }}</span>
              <strong :id="noteId(note)" dir="auto">{{ note.title }}</strong>
              <span class="bs-hq-plan-board__summary bs-hq-plan-board__summary--full" dir="auto">{{ note.summary }}</span>
              <a v-if="note.sourceUrl" :href="note.sourceUrl" target="_blank" rel="noopener noreferrer">{{ copy.board.sourceLabel }}</a>
            </article>
            <BsButton v-else variant="tile" align="start" class="bs-hq-plan-board__note" :aria-labelledby="noteId(note)" :aria-describedby="`${noteId(note)}-status`" @click="emit('open', note.kind, note.id)">
              <span class="bs-hq-plan-board__category">{{ note.category }}</span>
              <strong :id="noteId(note)" dir="auto">{{ note.title }}</strong>
              <span v-if="note.summary" class="bs-hq-plan-board__summary" dir="auto">{{ note.summary }}</span>
              <span :id="`${noteId(note)}-status`" class="bs-hq-plan-board__status">{{ note.status }}</span>
            </BsButton>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bs-hq-plan-board { display: grid; gap: var(--bs-space-3); padding: var(--bs-space-1); }
.bs-hq-plan-board p, .bs-hq-plan-board h3 { margin: 0; }
.bs-hq-plan-board__description { color: var(--bs-soft-silver); }
.bs-hq-plan-board__columns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; gap: var(--bs-space-4); }
.bs-hq-plan-board__column {
  --note-accent: var(--bs-premium-gold);
  padding: var(--bs-space-3);
  border: 1px solid var(--bs-component-hq-glass-border);
  border-radius: var(--bs-radius-card);
  background: var(--bs-component-hq-glass-card);
}
.bs-hq-plan-board__column[data-stage="preparation"] { --note-accent: var(--bs-soft-silver); }
.bs-hq-plan-board__column[data-stage="blocked"] { --note-accent: var(--bs-status-error); }
.bs-hq-plan-board__column[data-stage="done"] { --note-accent: var(--bs-status-success); }
.bs-hq-plan-board__column-heading { display: flex; justify-content: space-between; align-items: center; gap: var(--bs-space-2); margin-block-end: var(--bs-space-3); }
.bs-hq-plan-board__column-heading h3 { color: var(--bs-pearl-white); font-size: .9rem; overflow-wrap: anywhere; }
.bs-hq-plan-board__column-heading span { padding: var(--bs-space-1) var(--bs-space-2); border-radius: var(--bs-radius-chip); color: var(--bs-pearl-white); background: var(--bs-component-hq-glass-control); font-variant-numeric: tabular-nums; font-size: .75rem; }
.bs-hq-plan-board__empty { border: 1px dashed var(--bs-component-hq-glass-border); border-radius: var(--bs-radius-card); padding: var(--bs-space-3); color: var(--bs-soft-silver); font-size: .8rem; }
.bs-hq-plan-board__notes { display: grid; gap: var(--bs-space-3); margin: 0; padding: 0; list-style: none; }
.bs-hq-plan-board__note.bs-hq-plan-board__note {
  position: relative;
  display: grid;
  justify-items: start;
  align-content: start;
  gap: var(--bs-space-2);
  width: 100%;
  min-height: 8rem;
  padding: var(--bs-space-3);
  padding-block-start: var(--bs-space-4);
  border: 1px solid color-mix(in srgb, var(--note-accent) 60%, var(--bs-soft-silver));
  border-radius: var(--bs-radius-card);
  color: var(--bs-color-neutral-ink);
  background: linear-gradient(155deg, var(--bs-pearl-white), color-mix(in srgb, var(--note-accent) 24%, var(--bs-pearl-white)));
  box-shadow: var(--bs-shadow-elevation3-dark);
  overflow-wrap: anywhere;
  text-align: start;
}
.bs-hq-plan-board__note::before {
  content: "";
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: var(--bs-space-3);
  inline-size: var(--bs-space-8);
  block-size: var(--bs-space-1);
  border-end-start-radius: var(--bs-radius-chip);
  border-end-end-radius: var(--bs-radius-chip);
  background: var(--note-accent);
}
button.bs-hq-plan-board__note:hover:not(:disabled), .bs-hq-plan-board__note:focus-visible { outline: 2px solid var(--bs-premium-gold); outline-offset: 2px; }
.bs-hq-plan-board__category, .bs-hq-plan-board__status, .bs-hq-plan-board__summary { font-size: .75rem; font-weight: 500; }
.bs-hq-plan-board__category { opacity: .82; }
.bs-hq-plan-board__status { padding: var(--bs-space-1) var(--bs-space-2); border-radius: var(--bs-radius-chip); background: color-mix(in srgb, var(--note-accent) 45%, var(--bs-pearl-white)); }
.bs-hq-plan-board__summary { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.bs-hq-plan-board__summary--full { display: block; overflow: visible; }
.bs-hq-plan-board__note a { color: inherit; text-decoration: underline; }
.bs-hq-plan-board__note a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@media (max-width: 1050px) { .bs-hq-plan-board__columns { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .bs-hq-plan-board__columns { grid-template-columns: minmax(0, 1fr); } }
</style>
