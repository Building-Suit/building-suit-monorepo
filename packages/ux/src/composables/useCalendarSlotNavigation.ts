import { nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

/** One tab stop for the time grid; arrow keys browse dates and half-hour cells. */
export function useCalendarSlotNavigation(root: Ref<HTMLElement | null>, bounds: MaybeRefOrGetter<{ days: number; start: number; end: number }>, rtl: MaybeRefOrGetter<boolean>) {
  const focused = ref('')
  watch([() => toValue(bounds).days, () => toValue(bounds).start, () => toValue(bounds).end], ([, start]) => { focused.value = `0:${start}` }, { immediate: true })
  async function keydown(event: KeyboardEvent, key: string) {
    const { days, start, end } = toValue(bounds)
    let [day = 0, minute = start] = key.split(':').map(Number)
    if (event.key === 'ArrowLeft') day += toValue(rtl) ? 1 : -1
    else if (event.key === 'ArrowRight') day += toValue(rtl) ? -1 : 1
    else if (event.key === 'ArrowUp') minute -= 30
    else if (event.key === 'ArrowDown') minute += 30
    else if (event.key === 'Home') minute = start
    else if (event.key === 'End') minute = end - 30
    else if (event.key === 'PageUp') minute -= 180
    else if (event.key === 'PageDown') minute += 180
    else return
    event.preventDefault()
    focused.value = `${Math.max(0, Math.min(days - 1, day))}:${Math.max(start, Math.min(end - 30, minute))}`
    await nextTick()
    root.value?.querySelector<HTMLButtonElement>(`[data-calendar-slot="${focused.value}"]`)?.focus()
  }
  return { focused, keydown }
}
