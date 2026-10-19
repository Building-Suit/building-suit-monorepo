<script setup lang="ts">
import { calendarDateKey, calendarLocalDate, useCalendarDatePicker } from '@building-suit/ux'
const props = defineProps<{ modelValue: string; label: string; previousLabel: string; nextLabel: string }>()
const emit = defineEmits<{ 'update:modelValue': [date: string] }>()
const { locale } = useI18n()
const root = ref<HTMLElement | null>(null)
const rtl = computed(() => locale.value === 'ar')
const { month, days, focused, move, keydown } = useCalendarDatePicker(() => props.modelValue, root, rtl)
const caption = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(calendarLocalDate(month.value)))
const weekdays = computed(() => days.value.slice(0, 7).map(day => new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' }).format(day)))
const number = (day: Date) => new Intl.NumberFormat(locale.value).format(day.getDate())
const dayLabel = (day: Date) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'full' }).format(day)
</script>
<template>
  <div ref="root" class="bs-mini-calendar" role="group" :aria-label="label">
    <div class="bs-mini-calendar__header">
      <strong aria-live="polite">{{ caption }}</strong>
      <div class="bs-mini-calendar__navigation">
        <BsButton variant="icon" :aria-label="previousLabel" @click="move(-1)"><span aria-hidden="true">{{ rtl ? '›' : '‹' }}</span></BsButton>
        <BsButton variant="icon" :aria-label="nextLabel" @click="move(1)"><span aria-hidden="true">{{ rtl ? '‹' : '›' }}</span></BsButton>
      </div>
    </div>
    <div class="bs-mini-calendar__days">
      <span v-for="(day, index) in weekdays" :key="index" class="bs-mini-calendar__weekday" aria-hidden="true">{{ day }}</span>
      <button v-for="day in days" :key="calendarDateKey(day)" type="button" class="bs-mini-calendar__day" :class="{ 'is-outside': day.getMonth() !== calendarLocalDate(month).getMonth(), 'is-selected': calendarDateKey(day) === modelValue, 'is-today': calendarDateKey(day) === calendarDateKey(new Date()) }" :data-calendar-date="calendarDateKey(day)" :tabindex="calendarDateKey(day) === focused ? 0 : -1" :aria-label="dayLabel(day)" :aria-pressed="calendarDateKey(day) === modelValue" :aria-current="calendarDateKey(day) === calendarDateKey(new Date()) ? 'date' : undefined" @focus="focused = calendarDateKey(day)" @keydown="keydown($event, calendarDateKey(day))" @click="emit('update:modelValue', calendarDateKey(day))">{{ number(day) }}</button>
    </div>
  </div>
</template>
<style scoped>
.bs-mini-calendar { min-inline-size: 0; }
.bs-mini-calendar__header { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-2); margin-block-end: var(--bs-space-3); font-size: .8125rem; }
.bs-mini-calendar__navigation { display: flex; }
.bs-mini-calendar__navigation :deep(button) { min-inline-size: 2rem; min-block-size: 2rem; font-size: 1.25rem; }
.bs-mini-calendar__days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--bs-space-1); }
.bs-mini-calendar__weekday { padding-block: var(--bs-space-1); text-align: center; font-size: .6875rem; color: var(--bs-text-muted); }
.bs-mini-calendar__day { min-inline-size: 0; min-block-size: 1.875rem; border: 1px solid transparent; border-radius: var(--bs-radius-chip); background: transparent; color: var(--bs-text); font-size: .75rem; font-variant-numeric: tabular-nums; cursor: pointer; }
.bs-mini-calendar__day:hover { background: var(--bs-surface-muted); }
.bs-mini-calendar__day.is-outside { color: var(--bs-text-muted); opacity: .6; }
.bs-mini-calendar__day.is-today { border-color: var(--bs-primary); }
.bs-mini-calendar__day.is-selected { background: var(--bs-primary); color: var(--bs-text-on-primary); border-color: var(--bs-primary); opacity: 1; }
.bs-mini-calendar__day:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
</style>
