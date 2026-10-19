import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { calendarAddDays, calendarDateKey, calendarLocalDate, calendarWindow, validCalendarDate } from './useCalendarNavigation.ts'

/** Browsing a mini calendar never changes the selected operational date until activation. */
export function useCalendarDatePicker(selected: MaybeRefOrGetter<string>, root: Ref<HTMLElement | null>, rtl: MaybeRefOrGetter<boolean>) {
  const initial = validCalendarDate(toValue(selected)) ? toValue(selected) : calendarDateKey(new Date())
  const month = ref(initial)
  const focused = ref(initial)
  const days = computed(() => calendarWindow(month.value, 'month').days)
  watch(() => toValue(selected), value => {
    if (validCalendarDate(value)) { month.value = value; focused.value = value }
  })
  function move(amount: number) {
    const current = calendarLocalDate(month.value)
    month.value = calendarDateKey(new Date(current.getFullYear(), current.getMonth() + amount, 1))
    focused.value = month.value
  }
  async function keydown(event: KeyboardEvent, key: string) {
    const current = calendarLocalDate(key)
    let next: Date
    if (event.key === 'ArrowLeft') next = calendarAddDays(current, toValue(rtl) ? 1 : -1)
    else if (event.key === 'ArrowRight') next = calendarAddDays(current, toValue(rtl) ? -1 : 1)
    else if (event.key === 'ArrowUp') next = calendarAddDays(current, -7)
    else if (event.key === 'ArrowDown') next = calendarAddDays(current, 7)
    else if (event.key === 'Home') next = calendarAddDays(current, -current.getDay())
    else if (event.key === 'End') next = calendarAddDays(current, 6 - current.getDay())
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const target = current.getMonth() + (event.key === 'PageUp' ? -1 : 1)
      next = new Date(current.getFullYear(), target, Math.min(current.getDate(), new Date(current.getFullYear(), target + 1, 0).getDate()))
    } else return
    event.preventDefault()
    month.value = focused.value = calendarDateKey(next)
    await nextTick()
    root.value?.querySelector<HTMLButtonElement>(`[data-calendar-date="${focused.value}"]`)?.focus()
  }
  return { month, focused, days, move, keydown }
}
