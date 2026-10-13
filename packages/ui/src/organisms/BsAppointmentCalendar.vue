<script setup lang="ts">
import type { BsAppointmentsCopy, BsAppointmentsView } from '../types/appointmentsPresentation'
defineProps<{ days: BsAppointmentsView['days']; view: string; copy: Pick<BsAppointmentsCopy, 'title' | 'empty' | 'actions' | 'edit' | 'reschedule' | 'saving' | 'history'>; transitioning: boolean }>()
const emit = defineEmits<{ edit: [id: string]; transition: [id: string, status: string]; day: [date: string] }>()
</script>
<template>
  <section class="bs-appointment-calendar" :class="[`bs-appointment-calendar--${view}`]" :aria-label="copy.title">
    <p v-if="view === 'month' && !days.some(day => day.appointments.length)" class="bs-appointment-calendar__mobile-empty">{{ copy.empty }}</p>
    <section v-for="day in days" :key="day.id" class="bs-appointment-calendar__day" :class="{ 'bs-appointment-calendar__day--empty': !day.appointments.length, 'bs-appointment-calendar__day--outside': day.outside }">
      <h2 class="bs-appointment-calendar__heading"><BsButton variant="text" :aria-label="day.label" :aria-current="day.today ? 'date' : undefined" :class="{ 'bs-appointment-calendar__today': day.today }" @click="emit('day', day.id)">{{ day.label }}</BsButton></h2>
      <p v-if="!day.appointments.length" class="bs-appointment-calendar__empty">{{ copy.empty }}</p>
      <ol v-else class="bs-appointment-calendar__events">
        <li v-for="appointment in day.appointments" :key="appointment.id" class="bs-appointment-event" :data-tone="appointment.tone">
          <div class="bs-appointment-event__summary"><strong class="bs-appointment-event__time">{{ appointment.time }}</strong><BsStatusBadge :status="appointment.status" :label="appointment.statusLabel" :tone="appointment.tone" /></div>
          <p class="bs-appointment-event__name">{{ appointment.customerName }}</p><p class="bs-appointment-event__detail">{{ appointment.detail }}</p>
          <BsDisclosure v-if="appointment.canEdit || appointment.actions.length || appointment.history.length || appointment.link" :summary="copy.actions || copy.edit" density="compact">
            <BsInline v-if="appointment.canEdit || appointment.actions.length" :aria-busy="appointment.pending"><BsButton v-if="appointment.canEdit" variant="link" :disabled="transitioning" @click="emit('edit', appointment.id)">{{ copy.reschedule }}</BsButton><BsButton v-for="action in appointment.actions" :key="action.id" :variant="action.text ? 'text' : 'link'" :disabled="transitioning" @click="emit('transition', appointment.id, action.id)">{{ action.label }}</BsButton><BsText v-if="appointment.pending" role="status" size="xs">{{ copy.saving }}</BsText></BsInline>
            <BsDisclosure v-if="appointment.history.length" :summary="copy.history"><BsList ordered><BsListItem v-for="event in appointment.history" :key="event.id">{{ event.label }}</BsListItem></BsList></BsDisclosure>
            <BsLink v-if="appointment.link" :to="appointment.link.to">{{ appointment.link.label }}</BsLink>
          </BsDisclosure>
        </li>
      </ol>
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
</style>
