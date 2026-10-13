import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarWindow, calendarDateKey, validCalendarDate, useCalendarNavigation } from '../src/composables/useCalendarNavigation.ts'
test('month windows contain every real day with full Sunday-to-Saturday weeks, including leap day', () => {
  for (const key of ['2024-02-14', '2026-02-14', '2026-08-31']) {
    const window = calendarWindow(key, 'month')
    assert.equal(window.days[0].getDay(), 0)
    assert.equal(window.days.at(-1).getDay(), 6)
    assert.equal(window.days.length % 7, 0)
    assert.ok(window.days.length >= 28 && window.days.length <= 42)
    assert.equal(new Set(window.days.map(calendarDateKey)).size, window.days.length)
  }
  assert.ok(calendarWindow('2024-02-14', 'month').days.some(day => calendarDateKey(day) === '2024-02-29'))
  assert.equal(validCalendarDate('2026-02-30'), false)
})
test('month navigation never skips February from January 31, and selection preserves a valid date', () => {
  const nav = useCalendarNavigation('2026-01-31', 'month')
  nav.move(1); assert.equal(nav.selectedDate.value, '2026-02-01')
  nav.move(-1); assert.equal(nav.selectedDate.value, '2026-01-01')
  nav.selectDate('2026-02-30'); assert.equal(nav.selectedDate.value, '2026-01-01')
  nav.selectDate('2026-03-09'); nav.view.value = 'week'; nav.move(1); assert.equal(nav.selectedDate.value, '2026-03-16')
})
