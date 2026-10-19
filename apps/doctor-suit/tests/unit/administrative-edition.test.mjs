import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorAdministrativeReasonCodes, doctorAdministrativeReason, doctorEditionMode } from '../../app/utils/administrativeEdition.ts'
import { doctorScopeKey } from '../../app/utils/contextScope.ts'
import { doctorLocationContext } from '../../app/utils/locationContext.ts'
import { createDoctorContextController, doctorContextState } from '../../app/utils/contextController.ts'
import { createDoctorAppointmentsController, doctorAppointmentsState } from '../../app/utils/appointmentsController.ts'

const id = n => `ae020000-0000-0000-0000-${String(n).padStart(12, '0')}`
const actor = { userId: id(1), sessionId: id(2), practiceId: id(3) }
const context = () => ({ practice_id: id(3), location_id: id(4), practice_name: 'Synthetic edition practice', doctor_name: 'Synthetic doctor', location_name: 'Synthetic clinic', timezone: 'Etc/UTC', portal: 'doctor', grants_version: 1, location_version: 1, capabilities: ['patients.read', 'appointments.read', 'documents.read'] })
const entitlement = () => ({ state:'unconfigured',revision:0,writes_allowed:false,can_add_staff:false,can_add_clinic:false,over_limit:false,valid_until:null,observed_at:'2026-10-17T00:00:00Z' })

test('DOS-AE-002: candidate mode does not admit a live or clinical mode', () => {
  assert.equal(doctorEditionMode('synthetic_preview'), true)
  assert.equal(doctorEditionMode('administrative_candidate'), true)
  for (const mode of ['administrative_live', 'clinical', 'production', null, {}, true]) assert.equal(doctorEditionMode(mode), false)
})
test('administrative reasons are fixed intent codes without free-text notes', () => {
  assert.equal(doctorAdministrativeReasonCodes.length, 4)
  doctorAdministrativeReasonCodes.forEach(reason => assert.equal(doctorAdministrativeReason(reason), true))
  for (const reason of ['', 'Synthetic free-text note', 'admin.other: custom text', null, {}]) assert.equal(doctorAdministrativeReason(reason), false)
})
test('legacy synthetic context remains compatible; trusted edition metadata is validated', () => {
  const legacy = doctorLocationContext(context(), actor, 'local')
  assert.equal(Object.hasOwn(legacy, 'editionRevision'), false)
  const candidate = doctorLocationContext({ ...context(), capabilities: ['patients.read','appointments.read'], edition: 'administrative_candidate', edition_revision: 2,entitlement:entitlement() }, actor, 'local')
  assert.equal(candidate.edition, 'administrative_candidate')
  assert.equal(candidate.editionRevision, 2)
  assert.throws(() => doctorLocationContext({ ...context(), edition: 'administrative_candidate', edition_revision: 2 }, actor, 'local'), /CONTEXT_RESPONSE_INVALID/)
  for (const change of [{ edition: 'administrative_live', edition_revision: 2 }, { edition: 'administrative_candidate' }, { edition_revision: 2 }, { edition: 'synthetic_preview', edition_revision: 0 }]) {
    assert.throws(() => doctorLocationContext({ ...context(), ...change }, actor, 'local'), /CONTEXT_RESPONSE_INVALID/)
  }
})
test('edition and policy revision are part of protected cache identity', () => {
  const selected = doctorLocationContext(context(), actor, 'local')
  const preview = { ...selected, edition: 'synthetic_preview', editionRevision: 1 }
  const candidate = { ...selected, edition: 'administrative_candidate', editionRevision: 2 }
  assert.notEqual(doctorScopeKey(preview, 'documents'), doctorScopeKey(candidate, 'documents'))
  assert.notEqual(doctorScopeKey(candidate, 'documents'), doctorScopeKey({ ...candidate, editionRevision: 3 }, 'documents'))
  assert.notEqual(doctorScopeKey(candidate, 'documents'), doctorScopeKey({ ...candidate, sessionId: id(5) }, 'documents'))
})
test('same-user edition transition clears private state and rejects an older pending read', async () => {
  let row = { ...context(), edition: 'synthetic_preview', edition_revision: 1 }
  const state = doctorContextState()
  const repository = { load: async () => [row], resolve: async () => row }
  const controller = createDoctorContextController(repository, state, () => actor, 'local', { read: () => null, write: () => {} })
  await controller.refresh()
  let release
  const held = new Promise(resolve => { release = resolve })
  const appointmentState = doctorAppointmentsState()
  const appointments = createDoctorAppointmentsController({ board: () => held }, appointmentState, () => state.current)
  let privateDraft = 'Synthetic private draft'
  controller.registerClear(() => { privateDraft = ''; appointments.clear() })
  const captured = controller.capture('documents')
  const pending = appointments.load({ date: '2026-10-25', page: 0, queuePage: 0 })
  row = { ...row, edition: 'administrative_candidate', edition_revision: 2, capabilities: ['patients.read', 'appointments.read'],entitlement:entitlement() }
  await controller.refresh()
  release({ locationVersion: 1, timezone: 'Etc/UTC', items: [{ patientName: 'SYNTHETIC_STALE_RESPONSE' }] })
  assert.equal(await pending, false)
  assert.equal(captured.signal.aborted, true)
  assert.equal(captured.accepts(), false)
  assert.equal(privateDraft, '')
  assert.equal(appointmentState.board, null)
  assert.equal(state.current.edition, 'administrative_candidate')
  assert.equal(state.current.capabilities.includes('documents.read'), false)
})
