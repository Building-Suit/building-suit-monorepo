import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorAdministrativeReasonCodes, doctorAdministrativeReasonOptions, doctorAdministrativeReasonLabel } from '../../app/utils/administrativeEdition.ts'
import { doctorAdministrativeCapabilities } from '../../app/utils/locationContext.ts'
import { doctorTeamDirectory } from '../../app/utils/delegation.ts'
import { doctorDelegationPreset, doctorFormGrants } from '../../app/utils/delegationForms.ts'
const practice = '53000000-0000-0000-0000-000000000001'
const location = '54000000-0000-0000-0000-000000000001'
const allowed = doctorAdministrativeCapabilities.filter(cap => !cap.startsWith('documents.'))
const directory = () => ({ practice_id: practice, practice_name: 'Synthetic edition', edition: 'administrative_candidate', edition_revision: 2, available_capabilities: [...allowed], members: [], invitations: [], locations: [], member_total: 0, invitation_total: 0, location_total: 0 })
test('candidate team authority works without an active clinic and rejects static/forged document offers', () => {
  const parsed = doctorTeamDirectory(directory(), practice)
  assert.equal(parsed.locations.length, 0)
  assert.equal(parsed.editionRevision, 2)
  assert.deepEqual(parsed.availableCapabilities, allowed)
  for (const key of ['documents.read', 'documents.write', 'clinical.sign']) {
    const value = directory(); value.available_capabilities.push(key)
    assert.throws(() => doctorTeamDirectory(value, practice), /DOCTOR_DELEGATION_RESPONSE_INVALID/)
  }
  for (const key of ['edition', 'edition_revision', 'available_capabilities']) {
    const value = directory(); delete value[key]
    assert.throws(() => doctorTeamDirectory(value, practice), /DOCTOR_DELEGATION_RESPONSE_INVALID/)
  }
})
test('every candidate preset and form rejects excluded capabilities, while preview remains compatible', () => {
  for (const preset of ['all', 'read', 'schedule', 'selected']) {
    assert.ok(doctorDelegationPreset(preset, allowed).every(cap => allowed.includes(cap)))
  }
  assert.equal(doctorDelegationPreset('all', allowed).length, 10)
  assert.equal(doctorDelegationPreset('all').length, 12)
  const form = { name: '', jobTitle: '', email: '', role: 'selected', locationIds: [location], grants: [{ locationId: location, capabilities: ['patients.read', 'documents.read'] }] }
  assert.equal(doctorFormGrants(form, allowed), null)
  assert.ok(doctorFormGrants(form))
  form.grants[0].capabilities = ['patients.read']
  assert.ok(doctorFormGrants(form, allowed))
})
test('both languages expose only coded reasons and do not echo arbitrary history text', () => {
  for (const ar of [false, true]) {
    const options = doctorAdministrativeReasonOptions(ar)
    assert.deepEqual(options.map(row => row.value), [...doctorAdministrativeReasonCodes])
    assert.equal(new Set(options.map(row => row.label)).size, 4)
    for (const row of options) assert.equal(doctorAdministrativeReasonLabel(row.value, ar), row.label)
    assert.equal(doctorAdministrativeReasonLabel('SYNTHETIC_HISTORICAL_NOTE', ar), '')
    assert.equal(doctorAdministrativeReasonLabel(null, ar), '')
  }
})
