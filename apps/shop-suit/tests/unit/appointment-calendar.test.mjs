import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarWindow } from '../../../../packages/ux/src/composables/useCalendarNavigation.ts'
import { readAppointmentCalendar, appointmentsForCalendarDay } from '../../app/utils/appointmentCalendar.ts'
test('month reservations use bounded existing API reads and deduplicate overlapping appointments/hours/blocks', async () => {
  const month = calendarWindow('2026-08-15', 'month'), calls = []
  const result = await readAppointmentCalendar(month.days, month.to, async (from, to) => {
    calls.push({ from, to })
    return { data: { appointments: [{ id: 'overnight', customerName: 'Actual reservation' }], workingHours: [{ membershipId: 'staff', weekday: 1 }], blocks: [{ id: 'break', kind: 'break', startsAt: from, endsAt: to }] }, error: null }
  })
  assert.equal(calls.length, 6)
  for (const call of calls) assert.ok(new Date(call.to) - new Date(call.from) <= 8 * 86400000)
  assert.equal(calls[0].from, month.from); assert.equal(calls.at(-1).to, month.to)
  assert.equal(result.appointments.length, 1); assert.equal(result.workingHours.length, 1); assert.equal(result.blocks.length, 1)
  assert.equal(result.appointments[0].customerName, 'Actual reservation')
})
test('day and week still read one window, while any denial rejects the entire calendar', async () => {
  for (const view of ['day', 'week']) {
    const window = calendarWindow('2026-10-12', view); let count = 0
    await readAppointmentCalendar(window.days, window.to, async () => { count++; return { data: { appointments: [], workingHours: [], blocks: [] }, error: null } })
    assert.equal(count, 1)
  }
  const month = calendarWindow('2026-10-12', 'month'), denial = new Error('SHOP_PERMISSION_DENIED')
  await assert.rejects(readAppointmentCalendar(month.days, month.to, async () => ({ data: null, error: denial })), denial)
})

test('overnight reservations appear on overlapping days and midnight-ending records do not leak into the next day', () => {
  const day = new Date('2026-10-12T00:00:00'), next = new Date('2026-10-13T00:00:00')
  const iso = hour => new Date(2026, 9, 12, hour).toISOString()
  const items = [{ id: 'overnight', startsAt: iso(23), endsAt: iso(25) }, { id: 'midnight', startsAt: iso(22), endsAt: iso(24) }]
  assert.deepEqual(appointmentsForCalendarDay(items, day).map(item => item.id), ['midnight', 'overnight'])
  assert.deepEqual(appointmentsForCalendarDay(items, next).map(item => item.id), ['overnight'])
})
