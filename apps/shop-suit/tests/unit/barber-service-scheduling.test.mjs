import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928215000_barber_service_scheduling_foundation.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_barber_service_scheduling.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/services/index.vue', import.meta.url), 'utf8')

test('barber scheduling is opt-in and tenant/location/staff scoped', () => {
  assert.match(migration, /scheduling_enabled boolean not null default false/)
  assert.match(migration, /service_location_availability/)
  assert.match(migration, /service_staff_eligibility/)
  assert.match(migration, /APPOINTMENT_SERVICE_LOCATION_STAFF_MISMATCH/)
  assert.match(migration, /membership\.status = 'active'/)
  assert.match(migration, /service_duration_minutes_snapshot/)
  assert.match(migration, /service_staff_membership_ids_snapshot/)
  assert.doesNotMatch(migration, /inventory_(batches|movements)/)
  assert.doesNotMatch(migration, /job|work_order/)
})

test('database regression covers scheduling safety and historical snapshots', () => {
  for (const evidence of [
    'legacy service was forced into scheduling',
    'server-filtered scheduling catalog read failed',
    'incompatible staff/location assignment accepted',
    'issued service scheduling snapshot changed with catalog edit',
    'appointment accepted incompatible service location and staff',
    'appointment accepted incompatible duration',
    'staff without manage permission changed service scheduling',
    'suspended staff retained service access',
    'suspended staff remained appointment eligible',
    'outsider accessed scheduled service catalog',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('service form is bilingual, responsive, paginated, and stateful', () => {
  assert.match(page, /الحجز بالمواعيد/)
  assert.match(page, /Appointment scheduling/)
  assert.match(page, /list_services/)
  assert.match(page, /p_page: page\.value/)
  assert.match(page, /service_scheduling_options/)
  assert.match(page, /:columns="2"/)
  assert.match(page, /role="status"/)
  assert.match(page, /role="alert"/)
  assert.match(page, /pushToast/)
})
