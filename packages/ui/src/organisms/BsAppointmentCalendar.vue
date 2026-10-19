<script setup lang="ts">
import { layoutCalendarIntervals, useCalendarSlotNavigation } from '@building-suit/ux'
import type { BsAppointmentBlockView, BsAppointmentCard, BsAppointmentsCopy, BsAppointmentsView } from '../types/appointmentsPresentation'
/** Calendar is an opt-in workspace; agenda retains existing Doctor rendering and actions. */
const props = withDefaults(defineProps<{ days: BsAppointmentsView['days']; view: string; copy: Pick<BsAppointmentsCopy, 'title' | 'empty' | 'actions' | 'edit' | 'reschedule' | 'saving' | 'history'> & Partial<BsAppointmentsCopy>; transitioning: boolean; variant?: 'agenda' | 'calendar'; canCreate?: boolean }>(), { variant: 'agenda', canCreate: false })
const emit = defineEmits<{ access: [id:string]; edit: [id: string]; transition: [id: string, status: string]; day: [date: string]; block: [id: string]; appointment: [id: string]; create: [date: string, time: string] }>()
const { locale } = useI18n()
const root = ref<HTMLElement | null>(null)
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const slotTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const hourLabel = (minute: number) => new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60))
type TimedItem = { startMinute: number; endMinute: number } & ({ kind: 'appointment'; appointment: BsAppointmentCard } | { kind: 'block'; block: BsAppointmentBlockView })
const timedDays = computed(() => props.days.map(day => {
  const items: TimedItem[] = []
  for (const appointment of day.appointments) if (appointment.startMinute !== undefined && appointment.endMinute !== undefined) items.push({ kind: 'appointment', appointment, startMinute: appointment.startMinute, endMinute: appointment.endMinute })
  const allDayBlocks = (day.blocks ?? []).filter(block => block.startMinute === 0 && block.endMinute === 1440)
  for (const block of day.blocks ?? []) if (block.startMinute !== undefined && block.endMinute !== undefined && !allDayBlocks.includes(block)) items.push({ kind: 'block', block, startMinute: block.startMinute, endMinute: block.endMinute })
  return { day, allDayBlocks, events: layoutCalendarIntervals(items) }
}))
const hourRange = computed(() => {
  const intervals = timedDays.value.flatMap(day => day.events.map(event => event.item))
  return { start: Math.max(0, Math.min(8, ...intervals.map(item => Math.floor(item.startMinute / 60)))), end: Math.min(24, Math.max(20, ...intervals.map(item => Math.ceil(item.endMinute / 60)))) }
})
const hours = computed(() => Array.from({ length: hourRange.value.end - hourRange.value.start }, (_, index) => (hourRange.value.start + index) * 60))
const slots = computed(() => hours.value.flatMap(hour => [hour, hour + 30]))
const { focused: focusedSlot, keydown: slotKeydown } = useCalendarSlotNavigation(root, () => ({ days: props.days.length, start: hourRange.value.start * 60, end: hourRange.value.end * 60 }), () => locale.value === 'ar')
function eventStyle(event: ReturnType<typeof layoutCalendarIntervals<TimedItem>>[number]) {
  return { '--event-top': event.item.startMinute - hourRange.value.start * 60, '--event-duration': Math.min(Math.max(40, event.item.endMinute - event.item.startMinute), hourRange.value.end * 60 - event.item.startMinute), '--event-lane': event.lane, '--event-lanes': event.lanes }
}
function selectTimedItem(item: TimedItem) { if (item.kind === 'appointment') emit('appointment', item.appointment.id); else emit('block', item.block.id) }
function appointmentLabel(appointment: BsAppointmentCard) { return `${appointment.time} · ${appointment.customerName} · ${appointment.detail} · ${appointment.statusLabel}` }
</script>
<template>
  <section v-if="variant === 'calendar'" ref="root" class="bs-calendar" :class="`bs-calendar--${view}`" :aria-label="copy.title">
    <template v-if="view === 'month'">
      <div class="bs-calendar__weekdays" aria-hidden="true"><span v-for="day in days.slice(0, 7)" :key="day.id">{{ day.weekday || day.label }}</span></div>
      <div class="bs-calendar__month">
        <section v-for="day in days" :key="day.id" class="bs-calendar__month-day" :class="{ 'is-outside': day.outside, 'is-selected': day.selected, 'is-today': day.today }" :aria-label="day.label">
          <div class="bs-calendar__date-heading">
            <button type="button" class="bs-calendar__date" :aria-label="day.label" :aria-current="day.today ? 'date' : undefined" @click="emit('day', day.id)">{{ day.dayNumber || day.label }}</button>
            <BsButton v-if="canCreate" variant="icon" class="bs-calendar__day-add" :aria-label="`${copy.add} · ${day.label}`" @click="emit('create', day.id, '09:00')"><BsIcon name="add" :size="14" /></BsButton>
          </div>
          <ol class="bs-calendar__month-events">
            <li v-for="appointment in day.appointments.slice(0, 3)" :key="appointment.id">
              <button type="button" class="bs-calendar__event bs-calendar__event--month" :data-status="appointment.status" :title="appointmentLabel(appointment)" :aria-label="appointmentLabel(appointment)" @click="emit('appointment', appointment.id)"><span class="bs-calendar__event-time">{{ appointment.queueTime }}</span><span class="bs-calendar__event-name">{{ appointment.customerName }}</span></button>
            </li>
          </ol>
          <button v-if="day.appointments.length > 3" type="button" class="bs-calendar__more" :aria-label="`${day.label} · ${formatNumber(day.appointments.length - 3)} ${copy.more || copy.actions}`" @click="emit('day', day.id)">+{{ formatNumber(day.appointments.length - 3) }} {{ copy.more || copy.actions }}</button>
          <button v-for="block in (day.blocks ?? []).slice(0, 2)" :key="block.id" type="button" class="bs-calendar__month-block" :title="`${block.kindLabel} · ${block.staff} · ${block.time}`" @click="emit('block', block.id)"><span aria-hidden="true">⏤</span> {{ block.kindLabel }} · {{ block.staff }}</button>
          <button v-if="(day.blocks?.length ?? 0) > 2" type="button" class="bs-calendar__more" @click="emit('day', day.id)">+{{ formatNumber((day.blocks?.length ?? 0) - 2) }} {{ copy.more || copy.actions }}</button>
        </section>
      </div>
    </template>
    <div v-else class="bs-calendar__time-scroll" tabindex="0" :aria-label="copy.title">
      <div class="bs-calendar__time-grid" :style="{ '--day-count': days.length, '--grid-minutes': (hourRange.end - hourRange.start) * 60 }">
        <div class="bs-calendar__time-corner" aria-hidden="true" />
        <div v-for="{ day, allDayBlocks } in timedDays" :key="`header:${day.id}`" class="bs-calendar__time-heading" :class="{ 'is-today': day.today }"><button type="button" :aria-label="day.label" :aria-current="day.today ? 'date' : undefined" @click="emit('day', day.id)"><span>{{ day.weekday || day.label }}</span><strong>{{ day.dayNumber }}</strong></button><div v-if="allDayBlocks.length" class="bs-calendar__all-day-list" :aria-label="copy.blockDetails || copy.title"><button v-for="block in allDayBlocks" :key="block.id" type="button" class="bs-calendar__all-day-block" :title="`${block.kindLabel} · ${block.staff}`" @click="emit('block', block.id)">{{ block.kindLabel }} · {{ block.staff }}</button></div></div>
        <div class="bs-calendar__hours" aria-hidden="true"><span v-for="hour in hours" :key="hour" :style="{ top: `calc(${hour - hourRange.start * 60} * var(--calendar-minute))` }">{{ hourLabel(hour) }}</span></div>
        <div v-for="({ day, events }, dayIndex) in timedDays" :key="day.id" class="bs-calendar__time-day" :class="{ 'is-today': day.today }">
          <template v-if="canCreate"><button v-for="minute in slots" :key="minute" type="button" class="bs-calendar__slot" :data-calendar-slot="`${dayIndex}:${minute}`" :tabindex="focusedSlot === `${dayIndex}:${minute}` ? 0 : -1" :style="{ top: `calc(${minute - hourRange.start * 60} * var(--calendar-minute))` }" :aria-label="`${copy.add} · ${day.label} · ${hourLabel(minute)}`" @focus="focusedSlot = `${dayIndex}:${minute}`" @keydown="slotKeydown($event, `${dayIndex}:${minute}`)" @click="emit('create', day.id, slotTime(minute))"><span>+ {{ hourLabel(minute) }}</span></button></template>
          <template v-for="event in events" :key="event.item.kind === 'appointment' ? event.item.appointment.id : event.item.block.id">
            <button v-if="event.item.kind === 'appointment'" type="button" class="bs-calendar__event bs-calendar__event--timed" :style="eventStyle(event)" :data-status="event.item.appointment.status" :aria-label="appointmentLabel(event.item.appointment)" :title="appointmentLabel(event.item.appointment)" @click="selectTimedItem(event.item)"><span class="bs-calendar__event-time">{{ event.item.appointment.time }}</span><strong class="bs-calendar__event-name">{{ event.item.appointment.customerName }}</strong><span class="bs-calendar__event-detail">{{ event.item.appointment.detail }}</span></button>
            <button v-else type="button" class="bs-calendar__event bs-calendar__event--block" :style="eventStyle(event)" :aria-label="`${event.item.block.kindLabel} · ${event.item.block.staff} · ${event.item.block.time}`" @click="selectTimedItem(event.item)"><strong>{{ event.item.block.kindLabel }}</strong><span>{{ event.item.block.staff }}</span><span>{{ event.item.block.time }}</span></button>
          </template>
        </div>
      </div>
    </div>
  </section>
  <section v-else class="bs-appointment-calendar" :class="[`bs-appointment-calendar--${view}`]" :aria-label="copy.title">
    <p v-if="view === 'month' && !days.some(day => day.appointments.length || day.blocks?.length)" class="bs-appointment-calendar__mobile-empty">{{ copy.empty }}</p>
    <section v-for="day in days" :key="day.id" class="bs-appointment-calendar__day" :class="{ 'bs-appointment-calendar__day--empty': !day.appointments.length && !day.blocks?.length, 'bs-appointment-calendar__day--outside': day.outside }">
      <h2 class="bs-appointment-calendar__heading"><BsButton variant="text" :aria-label="day.label" :aria-current="day.today ? 'date' : undefined" :class="{ 'bs-appointment-calendar__today': day.today }" @click="emit('day', day.id)">{{ day.label }}</BsButton></h2>
      <p v-if="!day.appointments.length && !day.blocks?.length" class="bs-appointment-calendar__empty">{{ copy.empty }}</p>
      <ol v-if="day.appointments.length" class="bs-appointment-calendar__events">
        <li v-for="appointment in day.appointments" :key="appointment.id" class="bs-appointment-event" :data-tone="appointment.tone">
          <div class="bs-appointment-event__summary"><strong class="bs-appointment-event__time">{{ appointment.time }}</strong><BsStatusBadge :status="appointment.status" :label="appointment.statusLabel" :tone="appointment.tone" /></div>
          <p class="bs-appointment-event__name">{{ appointment.customerName }}</p><p class="bs-appointment-event__detail">{{ appointment.detail }}</p>
          <BsDisclosure v-if="appointment.access || appointment.canEdit || appointment.actions.length || appointment.history.length || appointment.link" :summary="copy.actions || copy.edit" density="compact">
            <BsInline v-if="appointment.canEdit || appointment.actions.length" :aria-busy="appointment.pending"><BsButton v-if="appointment.canEdit" variant="link" :disabled="transitioning" @click="emit('edit', appointment.id)">{{ copy.reschedule }}</BsButton><BsButton v-for="action in appointment.actions" :key="action.id" :variant="action.text ? 'text' : 'link'" :disabled="transitioning" @click="emit('transition', appointment.id, action.id)">{{ action.label }}</BsButton><BsText v-if="appointment.pending" role="status" size="xs">{{ copy.saving }}</BsText></BsInline>
            <BsButton v-if="appointment.access" variant="link" :disabled="transitioning" @click="emit('access',appointment.id)">{{appointment.access.label}}</BsButton>
            <BsDisclosure v-if="appointment.history.length" :summary="copy.history"><BsList ordered><BsListItem v-for="event in appointment.history" :key="event.id">{{ event.label }}</BsListItem></BsList></BsDisclosure>
            <BsLink v-if="appointment.link" :to="appointment.link.to">{{ appointment.link.label }}</BsLink>
          </BsDisclosure>
        </li>
      </ol>
      <BsStack v-if="day.blocks?.length" gap="sm">
        <BsButton v-for="block in day.blocks" :key="block.id" variant="tile" block align="start" :aria-label="`${block.kindLabel} · ${block.staff} · ${block.time}`" @click="emit('block', block.id)">
          <span class="bs-appointment-calendar__block"><BsText as="span" size="sm" emphasis="semibold">{{ block.kindLabel }}</BsText><BsText as="span" size="xs">{{ block.staff }}</BsText><BsText as="span" size="xs" tone="muted">{{ block.time }}</BsText></span>
        </BsButton>
      </BsStack>
    </section>
  </section>
</template>
<style scoped>
.bs-appointment-calendar { display: grid; min-inline-size: 0; grid-template-columns: minmax(0, 1fr); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); overflow: hidden; }
.bs-appointment-calendar__mobile-empty { display: none; }
@media (max-width: 1199px) { .bs-appointment-calendar--month .bs-appointment-calendar__day--empty { display: none; } .bs-appointment-calendar__mobile-empty { display: block; padding: 1.5rem; color: var(--bs-text-muted); } }
.bs-appointment-calendar__day { min-inline-size: 0; padding: .75rem; border-inline-end: 1px solid var(--bs-border); border-block-end: 1px solid var(--bs-border); }
.bs-appointment-calendar__day--outside { background: var(--bs-surface-muted); }
.bs-appointment-calendar__heading { margin-block-end: .75rem; font-size: .75rem; }
.bs-appointment-calendar__heading :deep(button) { font-size: inherit; min-block-size: 2.75rem; text-align: start; }
.bs-appointment-calendar__today { background: var(--bs-primary); color: var(--bs-text-on-primary); border-radius: var(--bs-radius-control); }
.bs-appointment-calendar__empty { padding-block: 1.5rem; font-size: .75rem; color: var(--bs-text-muted); }
.bs-appointment-calendar__block { display: grid; gap: var(--bs-space-1); }
.bs-appointment-calendar__events { display: grid; gap: .75rem; list-style: none; padding: 0; }
.bs-appointment-event { min-inline-size: 0; padding: .75rem; border: 1px solid var(--bs-border); border-inline-start-width: 3px; border-radius: var(--bs-radius-control); overflow-wrap: anywhere; }
.bs-appointment-event[data-tone='success'] { border-inline-start-color: var(--bs-status-success); }
.bs-appointment-event[data-tone='danger'] { border-inline-start-color: var(--bs-status-error); }
.bs-appointment-event[data-tone='info'] { border-inline-start-color: var(--bs-status-info); }
.bs-appointment-event__summary { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; justify-content: space-between; }
.bs-appointment-event__time { font-size: .75rem; font-variant-numeric: tabular-nums; }
.bs-appointment-event__name { margin-block-start: .5rem; font-size: .875rem; font-weight: 700; }
.bs-appointment-event__detail { margin-block: .3rem .6rem; font-size: .75rem; color: var(--bs-text-muted); }
@media (min-width: 768px) { .bs-appointment-calendar--week { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .bs-appointment-calendar--week, .bs-appointment-calendar--month { grid-template-columns: repeat(7, minmax(0, 1fr)); } .bs-appointment-calendar--month .bs-appointment-calendar__mobile-empty { display: none; }
@media (max-width: 1199px) { .bs-appointment-calendar--month .bs-appointment-calendar__day--empty { display: none; } .bs-appointment-calendar__mobile-empty { display: block; padding: 1.5rem; color: var(--bs-text-muted); } }
.bs-appointment-calendar__day { min-block-size: 11rem; padding: .5rem; } .bs-appointment-calendar--month .bs-appointment-event { padding: .5rem; } }
.bs-calendar { --calendar-minute: 1.2px; min-inline-size: 0; background: var(--bs-surface); }
.bs-calendar button { font-family: inherit; cursor: pointer; }
.bs-calendar button:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: -2px; z-index: 5; }
.bs-calendar__weekdays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block: 1px solid var(--bs-border); background: var(--bs-surface-muted); }
.bs-calendar__weekdays span { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: var(--bs-space-3); text-align: center; color: var(--bs-text-muted); font-size: .75rem; font-weight: 500; }
.bs-calendar__month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.bs-calendar__month-day { min-inline-size: 0; min-block-size: 10.5rem; padding: var(--bs-space-2); border-inline-end: 1px solid var(--bs-border); border-block-end: 1px solid var(--bs-border); }
.bs-calendar__month-day:nth-child(7n) { border-inline-end: 0; }
.bs-calendar__month-day.is-outside { background: color-mix(in oklab, var(--bs-surface-muted) 55%, var(--bs-surface)); }
.bs-calendar__month-day.is-outside .bs-calendar__date { color: var(--bs-text-muted); }
.bs-calendar__month-day.is-selected { box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--bs-primary) 45%, transparent); }
.bs-calendar__date-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-1); margin-block-end: var(--bs-space-2); }
.bs-calendar__date { min-inline-size: 2rem; min-block-size: 2rem; padding: var(--bs-space-1); border: 0; border-radius: var(--bs-radius-full); background: transparent; color: var(--bs-text); font-size: .8125rem; font-weight: 600; }
.is-today .bs-calendar__date { background: var(--bs-primary); color: var(--bs-text-on-primary); }
.bs-calendar__day-add { opacity: 0; }
.bs-calendar__date-heading :deep(.bs-calendar__day-add) { min-inline-size: 1.75rem; min-block-size: 1.75rem; }
.bs-calendar__month-day:hover .bs-calendar__day-add, .bs-calendar__month-day:focus-within .bs-calendar__day-add { opacity: 1; }
.bs-calendar__month-events { display: grid; gap: var(--bs-space-1); margin: 0; padding: 0; list-style: none; }
.bs-calendar__month-events li { min-inline-size: 0; }
.bs-calendar__event { --event-color: var(--bs-status-info); --event-surface: color-mix(in oklab, var(--bs-status-info) 12%, var(--bs-surface)); display: flex; min-inline-size: 0; border: 1px solid color-mix(in oklab, var(--event-color) 18%, var(--bs-border)); border-inline-start: 3px solid var(--event-color); border-radius: var(--bs-radius-chip); background: var(--event-surface); color: var(--bs-text); text-align: start; overflow: hidden; }
.bs-calendar__event[data-status='waiting'], .bs-calendar__event[data-status='arrived'] { --event-color: var(--bs-status-warning); --event-surface: var(--bs-status-warning-bg); }
.bs-calendar__event[data-status='completed'] { --event-color: var(--bs-status-success); --event-surface: var(--bs-status-success-bg); }
.bs-calendar__event[data-status='cancelled'], .bs-calendar__event[data-status='no_show'] { --event-color: var(--bs-status-error); --event-surface: var(--bs-status-error-bg); }
.bs-calendar__event[data-status='in_service'] { --event-surface: color-mix(in oklab, var(--bs-status-info) 22%, var(--bs-surface)); }
.bs-calendar__event:hover { border-color: var(--event-color); filter: brightness(.98); }
.bs-calendar__event--month { align-items: center; gap: var(--bs-space-1); inline-size: 100%; min-block-size: 2rem; padding: var(--bs-space-1); font-size: .6875rem; }
.bs-calendar__event-time { font-size: .6875rem; font-weight: 500; font-variant-numeric: tabular-nums; }
.bs-calendar__event--month .bs-calendar__event-time { flex-shrink: 0; }
.bs-calendar__event-name { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bs-calendar__more { display: block; margin-block-start: var(--bs-space-1); padding: var(--bs-space-1); border: 0; border-radius: var(--bs-radius-chip); background: transparent; color: var(--bs-text-muted); font-size: .6875rem; text-align: start; }
.bs-calendar__more:hover { color: var(--bs-text); background: var(--bs-surface-muted); }
.bs-calendar__month-block { display: block; max-inline-size: 100%; margin-block-start: var(--bs-space-1); padding: var(--bs-space-1); border: 0; background: transparent; color: var(--bs-text-muted); font-size: .6875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bs-calendar__time-scroll { max-block-size: 72dvh; min-block-size: min(28rem, 72dvh); overflow: auto; overscroll-behavior: contain; border-block-start: 1px solid var(--bs-border); }
.bs-calendar__time-grid { display: grid; grid-template-columns: 4rem repeat(var(--day-count), minmax(8.5rem, 1fr)); min-inline-size: calc(4rem + var(--day-count) * 8.5rem); }
.bs-calendar__time-corner, .bs-calendar__time-heading { position: sticky; inset-block-start: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: var(--bs-space-1); padding: var(--bs-space-2); border-block-end: 1px solid var(--bs-border); border-inline-end: 1px solid var(--bs-border); background: var(--bs-surface); }
.bs-calendar__time-corner { inset-inline-start: 0; z-index: 4; }
.bs-calendar__time-heading button { display: grid; justify-items: center; gap: var(--bs-space-1); border: 0; background: transparent; color: var(--bs-text-muted); font-size: .75rem; }
.bs-calendar__time-heading strong { display: grid; place-items: center; min-inline-size: 2rem; min-block-size: 2rem; border-radius: var(--bs-radius-full); color: var(--bs-text); font-size: 1rem; }
.bs-calendar__all-day-list { display: grid; gap: var(--bs-space-1); inline-size: 100%; max-block-size: 7rem; overflow: auto; }
.bs-calendar__time-heading .bs-calendar__all-day-block { display: block; inline-size: 100%; padding: var(--bs-space-1); border: 1px dashed var(--bs-border-strong); border-radius: var(--bs-radius-chip); font-size: .6875rem; text-align: start; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--bs-surface-muted); }
.bs-calendar__time-heading.is-today strong { background: var(--bs-primary); color: var(--bs-text-on-primary); }
.bs-calendar__hours, .bs-calendar__time-day { position: relative; block-size: calc(var(--grid-minutes) * var(--calendar-minute)); }
.bs-calendar__hours { position: sticky; inset-inline-start: 0; z-index: 2; background: var(--bs-surface); border-inline-end: 1px solid var(--bs-border); }
.bs-calendar__hours span { position: absolute; inset-inline: var(--bs-space-1); transform: translateY(-50%); font-size: .625rem; text-align: center; color: var(--bs-text-muted); white-space: nowrap; }
.bs-calendar__hours span:first-child { transform: translateY(25%); }
.bs-calendar__time-day { border-inline-end: 1px solid var(--bs-border); background-image: linear-gradient(to bottom, var(--bs-border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--bs-border) 45%, transparent) 1px, transparent 1px); background-size: 100% calc(60 * var(--calendar-minute)), 100% calc(30 * var(--calendar-minute)); }
.bs-calendar__time-day.is-today { background-color: color-mix(in oklab, var(--bs-primary) 2%, var(--bs-surface)); }
.bs-calendar__slot { position: absolute; inset-inline: 0; inline-size: 100%; block-size: calc(30 * var(--calendar-minute)); padding: var(--bs-space-1); border: 0; background: transparent; color: var(--bs-text-muted); text-align: start; font-size: .6875rem; }
.bs-calendar__slot span { opacity: 0; }
.bs-calendar__slot:hover, .bs-calendar__slot:focus-visible { background: color-mix(in oklab, var(--bs-primary) 8%, var(--bs-surface)); }
.bs-calendar__slot:hover span, .bs-calendar__slot:focus-visible span { opacity: 1; }
.bs-calendar__event--timed, .bs-calendar__event--block { position: absolute; z-index: 1; inset-block-start: calc(var(--event-top) * var(--calendar-minute)); inset-inline-start: calc(100% / var(--event-lanes) * var(--event-lane) + 2px); inline-size: calc(100% / var(--event-lanes) - 4px); block-size: calc(var(--event-duration) * var(--calendar-minute) - 2px); min-block-size: 2.75rem; flex-direction: column; gap: 2px; padding: var(--bs-space-1) var(--bs-space-2); font-size: .75rem; }
.bs-calendar__event--timed:focus-visible, .bs-calendar__event--block:focus-visible { position: absolute; }
.bs-calendar__event-detail { font-size: .6875rem; color: var(--bs-text-muted); }
.bs-calendar__event--block { border: 1px dashed var(--bs-border-strong); background: repeating-linear-gradient(135deg, var(--bs-surface-muted), var(--bs-surface-muted) 4px, var(--bs-surface) 4px, var(--bs-surface) 8px); color: var(--bs-text-muted); }
.bs-calendar__event--block span { font-size: .6875rem; }
@media (hover: none) { .bs-calendar__day-add { opacity: 1; } }
@media (max-width: 640px) {
  .bs-calendar__weekdays span { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: var(--bs-space-2) 0; font-size: .625rem; }
  .bs-calendar__month-day { min-block-size: 8rem; padding: 2px; }
  .bs-calendar__date-heading { justify-content: center; margin-block-end: var(--bs-space-1); }
  .bs-calendar__day-add, .bs-calendar__event--month .bs-calendar__event-time { display: none; }
  .bs-calendar__event--month { min-block-size: 1.75rem; padding: 2px; font-size: .625rem; }
  .bs-calendar__more, .bs-calendar__month-block { padding: 2px; font-size: .625rem; }
  .bs-calendar__time-scroll { min-block-size: min(24rem, 65dvh); max-block-size: 65dvh; }
}
</style>
