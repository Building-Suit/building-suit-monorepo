import { computed, ref } from 'vue'
export type CalendarView = 'day' | 'week' | 'month'
export function calendarDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function calendarAddDays(date: Date, amount: number): Date { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
export function calendarLocalDate(key: string): Date { return new Date(`${key}T00:00:00`) }
export function validCalendarDate(key: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(key) && calendarDateKey(calendarLocalDate(key)) === key }
export function calendarWindow(key: string, view: CalendarView) {
  const selected = calendarLocalDate(key)
  let start = selected, count = 1
  if (view === 'week') { start = calendarAddDays(selected, -selected.getDay()); count = 7 }
  if (view === 'month') {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1)
    const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
    start = calendarAddDays(first, -first.getDay())
    count = Math.ceil((first.getDay() + last.getDate()) / 7) * 7
  }
  const days = Array.from({ length: count }, (_, index) => calendarAddDays(start, index))
  return { days, from: start.toISOString(), to: calendarAddDays(start, count).toISOString() }
}
/** Local calendar navigation keeps existing input/time semantics and never makes business writes. */
export function useCalendarNavigation(initialDate: string, initialView: CalendarView = 'day') {
  const selectedDate = ref(validCalendarDate(initialDate) ? initialDate : calendarDateKey(new Date()))
  const view = ref<CalendarView>(initialView)
  const window = computed(() => calendarWindow(selectedDate.value, view.value))
  const days = computed(() => window.value.days)
  const range = computed(() => ({ from: window.value.from, to: window.value.to }))
  function move(amount: number) {
    const date = calendarLocalDate(selectedDate.value)
    selectedDate.value = calendarDateKey(view.value === 'month' ? new Date(date.getFullYear(), date.getMonth() + amount, 1) : calendarAddDays(date, amount * (view.value === 'week' ? 7 : 1)))
  }
  function selectDate(value: string) { if (validCalendarDate(value)) selectedDate.value = value }
  function today() { selectedDate.value = calendarDateKey(new Date()) }
  return { selectedDate, view, days, range, move, selectDate, today }
}
