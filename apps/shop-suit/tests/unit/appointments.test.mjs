import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928220000_staff_appointments_calendar_queue.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_appointments.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/appointments/index.vue', import.meta.url), 'utf8')
const shell = await readFile(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8')

test('appointment commands enforce tenant, availability, conflict and audit boundaries', () => {
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /APPOINTMENT_STAFF_CONFLICT/)
  assert.match(migration, /APPOINTMENT_OUTSIDE_WORKING_HOURS/)
  assert.match(migration, /APPOINTMENT_STAFF_UNAVAILABLE/)
  assert.match(migration, /appointment_events/)
  assert.match(migration, /appointment_schedule_events/)
  assert.match(migration, /revoke insert, update, delete on public\.appointments from authenticated/)
  assert.match(migration, /appointments\.manage/)
  assert.match(migration, /appointments\.schedule\.manage/)
  assert.match(migration, /IDEMPOTENCY_KEY_REUSED/)
  assert.match(migration, /APPOINTMENT_SALE_IMMUTABLE/)
})

test('database regression covers concurrency, permissions, transitions and immutable history', () => {
  for (const evidence of [
    'overlapping appointment was accepted',
    'appointment outside working hours was accepted',
    'appointment during time off was accepted',
    'idempotent retry created another appointment',
    'invalid status transition was accepted',
    'appointment audit history is incomplete',
    'linked sale was not preserved',
    'delegated staff could not read appointments',
    'suspended staff retained appointment access',
    'outsider accessed another shop calendar',
    'cross-shop customer was accepted',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('calendar exposes bilingual responsive day/week and pointer-free queue workflows', () => {
  assert.match(page, /تقويم الفريق/)
  assert.match(page, /Team calendar/)
  assert.match(page, /view === 'week'/)
  assert.match(page, /appointment_calendar/)
  assert.match(page, /save_appointment/)
  assert.match(page, /transition_appointment/)
  assert.match(page, /save_staff_schedule/)
  assert.match(page, /walk_in/)
  assert.match(page, /md:grid-cols-2 xl:grid-cols-7/)
  assert.match(page, /role="status"/)
  assert.match(page, /role="alert"/)
  assert.doesNotMatch(page, /draggable|dragstart|drop=/)
  assert.match(shell, /to: '\/appointments'/)
})
