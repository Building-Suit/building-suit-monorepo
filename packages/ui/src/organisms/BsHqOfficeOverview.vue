<script setup lang="ts">
import { computed } from 'vue'
import type { HqAgentPresentation, HqOfficeCopy, HqOfficeObservations, HqTaskPresentation } from '../types/hqAgentsPresentation'
import { hqOfficeSummary, hqSparkline } from '../utils/hqOfficePresentation'

const props = defineProps<{ agents: readonly HqAgentPresentation[]; observations?: HqOfficeObservations; copy: HqOfficeCopy; locale?: string; detail?: boolean; tasks?: readonly HqTaskPresentation[] }>()
const emit = defineEmits<{ selectAgent: [id: string] }>()
const summary = computed(() => hqOfficeSummary(props.agents,props.observations))
const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat(props.locale ?? 'en', { maximumFractionDigits: 1 }).format(value)
const percent = (value: number | null) => value === null ? '—' : value > 0 && value < .1 ? `<${number(.1)}%` : `${number(value)}%`
const initial = (agent: HqAgentPresentation) => Array.from(agent.name.trim())[0] ?? ''
const activeCount = computed(() => summary.value.tools.filter(tool => tool.active).length)
const recentTasks = computed(() => (props.tasks ?? []).filter(task => props.agents.some(agent => agent.id === task.assigneeId)))
const metrics = computed(() => [
  { label: props.copy.tasksToday, value: number(summary.value.today), trend: summary.value.complete ? hqSparkline(summary.value.daily) : null },
  { label: props.copy.running, value: number(summary.value.running), trend: null },
  { label: props.copy.turnaround, value: summary.value.turnaroundMinutes === null ? '—' : `${number(summary.value.turnaroundMinutes)} ${props.copy.minutes}`, trend: null },
])
</script>

<template>
  <div class="bs-hq-office">
    <section class="bs-hq-office__metrics" :aria-label="copy.metrics">
      <article v-for="metric in metrics" :key="metric.label" class="bs-hq-office__metric">
        <h3>{{ metric.label }}</h3><strong>{{ metric.value }}</strong>
        <svg v-if="metric.trend" viewBox="0 0 120 32" aria-hidden="true" focusable="false"><polyline :points="metric.trend" /></svg>
      </article>
    </section>
    <p v-if="!summary.complete" class="bs-hq-office__muted" role="status">{{ copy.unavailable }}</p>
    <p v-else class="bs-hq-office__scope">{{ copy.scope }}</p>
    <dl v-if="detail" class="bs-hq-office__identity">
      <template v-for="agent in agents" :key="agent.id">
        <div><dt>{{ copy.activity }}</dt><dd>{{ agent.activityLabel ?? copy.unavailable }}<span v-if="agent.connectionLabel"> · {{ agent.connectionLabel }}</span></dd></div>
        <div v-if="agent.lifecycleLabel"><dt>{{ copy.lifecycle }}</dt><dd>{{ agent.lifecycleLabel }}</dd></div>
        <div v-if="agent.departmentName"><dt>{{ copy.department }}</dt><dd dir="auto">{{ agent.departmentName }}</dd></div>
        <div><dt>{{ copy.model }}</dt><dd><bdi>{{ agent.model ?? '—' }}<span v-if="agent.effort"> · {{ agent.effort }}</span></bdi></dd></div>
        <div><dt>{{ copy.manager }}</dt><dd><bdi>{{ agent.managerName ?? agent.managerId ?? '—' }}</bdi></dd></div>
        <div v-if="agent.profileUrl"><dt>{{ copy.profile }}</dt><dd><BsLink :to="agent.profileUrl" external target="_blank">{{ agent.name }}</BsLink></dd></div>
      </template>
    </dl>
    <section class="bs-hq-office__section">
      <header><h3>{{ copy.connectedTools }}</h3><span>{{ summary.complete ? number(activeCount) : '—' }} · {{ copy.active }}</span></header>
      <ul v-if="summary.tools.length" class="bs-hq-office__tools">
        <li v-for="tool in summary.tools" :key="tool.id" class="bs-hq-office__tool">
          <span class="bs-hq-office__tool-icon" aria-hidden="true">
            <svg v-if="tool.icon === 'drive'" viewBox="0 0 24 24" focusable="false"><path d="M9 3h6l7 12-3 6H5l-3-6Zm1.1 3L6 13h4l4-7Zm5.5 2L13 13h6.5ZM5 16l1 2h12l1-2Z" fill="currentColor" /></svg>
            <svg v-else-if="tool.icon === 'web'" viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></svg>
            <BsIcon v-else name="settings" :size="22" />
          </span>
          <span><strong dir="auto">{{ tool.name }}</strong><small><i :data-active="tool.active" />{{ tool.active ? copy.active : copy.inactive }} · <bdi>{{ tool.kind === 'mcp' ? 'MCP' : tool.kind === 'api' ? 'API' : 'Native' }}</bdi></small></span>
        </li>
      </ul>
      <p v-else class="bs-hq-office__muted">{{ summary.complete ? copy.toolsEmpty : copy.unavailable }}</p>
    </section>
    <section class="bs-hq-office__section">
      <header><h3>{{ copy.skills }}</h3><span>{{ summary.complete ? number(summary.skills.filter(skill => skill.running).length) : '—' }} · {{ copy.running }}</span></header>
      <p v-if="observations" class="bs-hq-office__muted">{{ copy.skillBasis }} <time v-if="observations" :datetime="observations.since">{{ new Intl.DateTimeFormat(locale ?? 'en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(observations.since)) }}</time></p>
      <ul v-if="summary.skills.length" class="bs-hq-office__skills" :aria-label="copy.skillUsage">
        <li v-for="skill in summary.skills" :key="skill.id">
          <i :data-active="skill.running" :title="skill.running ? copy.running : copy.inactive" />
          <span class="bs-hq-office__skill-name" dir="auto">{{ skill.name }}<small v-if="skill.running">{{ copy.running }}</small></span>
          <progress v-if="skill.percentage !== null" :value="skill.percentage" max="100" :aria-label="`${skill.name}: ${percent(skill.percentage)}`" />
          <span v-else class="bs-hq-office__unknown-track" />
          <span class="bs-hq-office__percentage" :title="skill.loads === 0 ? copy.neverUsed : skill.loads === null ? copy.unavailable : String(skill.loads)">{{ percent(skill.percentage) }}</span>
        </li>
      </ul>
      <p v-else class="bs-hq-office__muted">{{ summary.complete ? copy.skillsEmpty : copy.unavailable }}</p>
    </section>
    <section v-if="!detail" class="bs-hq-office__section">
      <header><h3>{{ copy.agents }}</h3><span>{{ number(agents.length) }}</span></header>
      <ul v-if="agents.length" class="bs-hq-office__agents">
        <li v-for="agent in agents" :key="agent.id"><BsButton variant="tile" align="start" class="bs-hq-office__agent" :aria-label="`${copy.agentDetails}: ${agent.name}`" @click="emit('selectAgent',agent.id)">
          <span class="bs-hq-office__avatar" aria-hidden="true">{{ initial(agent) }}</span>
          <span class="bs-hq-office__agent-text"><strong dir="auto">{{ agent.name }}</strong><small>{{ agent.roleLabel ?? agent.departmentName }}</small></span>
          <span class="bs-hq-office__agent-state"><i :data-active="agent.connected" />{{ agent.activityLabel ?? agent.connectionLabel ?? copy.inactive }}</span>
          <BsIcon name="arrowRight" :size="15" />
        </BsButton></li>
      </ul>
      <p v-else class="bs-hq-office__muted">{{ summary.complete ? copy.agentsEmpty : copy.unavailable }}</p>
    </section>
    <section class="bs-hq-office__section">
      <header><h3>{{ copy.recentTasks }}</h3></header>
      <article v-for="task in recentTasks" :key="task.id" class="bs-hq-office__task"><h4 dir="auto">{{ task.title }}</h4><p>{{ task.assigneeName }} · {{ task.statusLabel }}</p><time :datetime="task.createdAt">{{ new Intl.DateTimeFormat(locale ?? 'en', { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(task.createdAt)) }}</time><p dir="auto">{{ task.brief }}</p></article>
      <p v-if="!recentTasks.length" class="bs-hq-office__muted">{{ observations ? copy.noRecentTasks : copy.unavailable }}</p>
    </section>
  </div>
</template>

<style scoped>
.bs-hq-office { display: grid; gap: var(--bs-space-5); min-width: 0; }
.bs-hq-office p,.bs-hq-office h3,.bs-hq-office h4 { margin: 0; }
.bs-hq-office__metrics { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: var(--bs-space-2); }
.bs-hq-office__metric { display: flex; flex-direction: column; gap: var(--bs-space-2); min-width: 0; min-height: 106px; padding: var(--bs-space-3); border: 1px solid var(--bs-component-hq-glass-border); border-radius: var(--bs-radius-card); background: var(--bs-component-hq-glass-card); }
.bs-hq-office__metric h3 { color: var(--bs-soft-silver); font-size: .68rem; font-weight: 500; line-height: 1.5; }
.bs-hq-office__metric strong { font-size: clamp(1.1rem,1.5vw,1.6rem); font-weight: 600; font-variant-numeric: tabular-nums; }
.bs-hq-office__metric svg { width: 100%; height: 28px; margin-top: auto; overflow: visible; }
.bs-hq-office__metric polyline { fill: none; stroke: var(--bs-premium-gold); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.bs-hq-office__scope,.bs-hq-office__muted { color: var(--bs-soft-silver); font-size: .72rem; line-height: 1.75; }
.bs-hq-office__scope { margin-top: calc(-1 * var(--bs-space-3)) !important; }
.bs-hq-office__section { display: grid; gap: var(--bs-space-3); }
.bs-hq-office__section > header { display: flex; justify-content: space-between; align-items: baseline; gap: var(--bs-space-2); }
.bs-hq-office__section > header h3 { font-size: .72rem; font-weight: 600; letter-spacing: .06em; }
.bs-hq-office__section > header > span { color: var(--bs-soft-silver); font-size: .68rem; }
.bs-hq-office ul { list-style: none; margin: 0; padding: 0; }
.bs-hq-office__tools { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: var(--bs-space-2); }
.bs-hq-office__tool { display: flex; gap: var(--bs-space-2); align-items: center; min-width: 0; border: 1px solid var(--bs-component-hq-glass-border); border-radius: var(--bs-radius-control); padding: var(--bs-space-3); background: var(--bs-component-hq-glass-card); }
.bs-hq-office__tool > span:last-child { min-width: 0; }
.bs-hq-office__tool strong { display: block; font-size: .76rem; font-weight: 600; overflow-wrap: anywhere; }
.bs-hq-office__tool small { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 4px; color: var(--bs-soft-silver); font-size: .62rem; }
.bs-hq-office__tool-icon { flex: none; width: 28px; height: 28px; color: var(--bs-soft-silver); }
.bs-hq-office__tool-icon svg { width: 100%; height: 100%; }
.bs-hq-office i { display: inline-block; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--bs-color-neutral-steel-gray); }
.bs-hq-office i[data-active='true'] { background: var(--bs-color-semantic-success-dark); }
.bs-hq-office__skills { display: grid; gap: var(--bs-space-4); }
.bs-hq-office__skills li { display: grid; grid-template-columns: 6px minmax(0,1.5fr) minmax(48px,1fr) 44px; align-items: center; gap: var(--bs-space-2); }
.bs-hq-office__skill-name { min-width: 0; overflow-wrap: anywhere; font-size: .75rem; }
.bs-hq-office__skill-name small { display: block; color: var(--bs-soft-silver); font-size: .62rem; }
.bs-hq-office progress { appearance: none; width: 100%; height: 5px; border: 0; border-radius: 5px; overflow: hidden; background: var(--bs-component-hq-glass-card); }
.bs-hq-office progress::-webkit-progress-bar { background: var(--bs-component-hq-glass-card); }
.bs-hq-office progress::-webkit-progress-value { background: var(--bs-premium-gold); border-radius: 5px; }
.bs-hq-office progress::-moz-progress-bar { background: var(--bs-premium-gold); border-radius: 5px; }
.bs-hq-office__unknown-track { height: 5px; background: var(--bs-component-hq-glass-card); border-radius: 5px; }
.bs-hq-office__percentage { text-align: end; font-size: .68rem; font-variant-numeric: tabular-nums; }
.bs-hq-office__agents { display: grid; gap: var(--bs-space-2); }
.bs-hq-office .bs-hq-office__agent { display: flex; align-items: center; width: 100%; gap: var(--bs-space-2); padding: var(--bs-space-3); border: 1px solid var(--bs-component-hq-glass-border); border-radius: var(--bs-radius-control); background: var(--bs-component-hq-glass-card); color: inherit; text-align: start; }
.bs-hq-office .bs-hq-office__agent:hover { border-color: var(--bs-premium-gold); background: var(--bs-component-hq-glass-selected); }
.bs-hq-office__avatar { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border: 1px solid var(--bs-component-hq-glass-border); border-radius: 50%; font-size: .85rem; }
.bs-hq-office__agent-text { display: grid; flex: 1; min-width: 0; gap: 3px; }
.bs-hq-office__agent-text strong { font-size: .82rem; font-weight: 600; }
.bs-hq-office__agent-text small,.bs-hq-office__agent-state { color: var(--bs-soft-silver); font-size: .65rem; line-height: 1.6; }
.bs-hq-office__agent-state { display: flex; gap: 4px; align-items: center; }
.bs-hq-office__identity { display: grid; gap: var(--bs-space-3); margin: 0; }
.bs-hq-office__identity > div { display: grid; grid-template-columns: minmax(90px,.6fr) minmax(0,1fr); gap: var(--bs-space-2); font-size: .75rem; }
.bs-hq-office__identity dt { color: var(--bs-soft-silver); }.bs-hq-office__identity dd { margin: 0; overflow-wrap: anywhere; }
.bs-hq-office__task { padding: var(--bs-space-3); border: 1px solid var(--bs-component-hq-glass-border); border-radius: var(--bs-radius-control); background: var(--bs-component-hq-glass-card); font-size: .8rem; line-height: 1.8; }
.bs-hq-office__task p { white-space: pre-wrap; overflow-wrap: anywhere; }
:global([dir='rtl']) .bs-hq-office__section > header h3 { letter-spacing: normal; }
:global([dir='rtl'] .bs-hq-office__agent > :last-child) { transform: rotate(180deg); }
@media(max-width:400px) { .bs-hq-office__tools { grid-template-columns: 1fr; }.bs-hq-office__metric { padding: var(--bs-space-2); }.bs-hq-office__skills li { grid-template-columns: 6px minmax(0,1fr) 54px 38px; } }
</style>
