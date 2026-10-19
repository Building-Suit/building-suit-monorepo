import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorContextController, doctorContextState } from '../../app/utils/contextController.ts'
import { doctorContextId, doctorContextPreference, doctorLocationContext } from '../../app/utils/locationContext.ts'
import { doctorScopeKey } from '../../app/utils/contextScope.ts'
import { validDoctorSetupForm } from '../../app/utils/practiceSetup.ts'
import { doctorLocationDirectory, validDoctorLocationForm } from '../../app/utils/locations.ts'
import { createDoctorLocationsController, doctorLocationsState } from '../../app/utils/locationsController.ts'
const actor = { userId: '91000000-0000-0000-0000-000000000001', sessionId: '92000000-0000-0000-0000-000000000001', practiceId: '93000000-0000-0000-0000-000000000001' }
const dto = (n, extra = {}) => ({ practice_id: `93000000-0000-0000-0000-00000000000${n}`, practice_name: `Synthetic practice ${n}`, doctor_name: `Synthetic doctor ${n}`, location_id: `94000000-0000-0000-0000-00000000000${n}`, location_name: `Synthetic location ${n}`, timezone: n === 1 ? 'Africa/Cairo' : 'Europe/London', portal: 'secretary', grants_version: 1, location_version: 1, capabilities: ['locations.read'], ...extra })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture(options = [dto(1)], overrides = {}) {
  let currentActor = actor; let preference = null
  const repository = { load: async () => options, resolve: async (practice, location) => options.find(item => item.practice_id === practice && item.location_id === location), ...overrides }
  const state = doctorContextState()
  const controller = createDoctorContextController(repository, state, () => currentActor, 'local', { read: () => preference, write: value => { preference = value } })
  return { controller, state, repository, preference: value => { preference = value }, actor: value => { currentActor = value } }
}
test('DOS-M1-008: context projections reject clinical authority and location revisions isolate query keys', () => {
  const value = doctorLocationContext(dto(1), actor, 'local')
  assert.equal(value.portal, 'secretary')
  assert.notEqual(doctorScopeKey(value, 'patients'), doctorScopeKey({ ...value, locationVersion: 2 }, 'patients'))
  assert.throws(() => doctorLocationContext(dto(1, { capabilities: ['clinical.sign'] }), actor, 'local'), /RESPONSE_INVALID/)
  assert.throws(() => doctorLocationContext(dto(1, { portal: 'owner' }), actor, 'local'), /RESPONSE_INVALID/)
})
test('DOS-M1-008: cookie preferences are untrusted and bound to both verified user and session', () => {
  const value = { userId: actor.userId, sessionId: actor.sessionId, practiceId: dto(1).practice_id, locationId: dto(1).location_id }
  assert.deepEqual(doctorContextPreference(value, actor), value)
  assert.equal(doctorContextPreference(value, { ...actor, sessionId: 'other-session' }), null)
  assert.equal(doctorContextPreference({ ...value, userId: 'another-user' }, actor), null)
  assert.equal(doctorContextPreference({ ...value, locationId: '//attacker' }, actor), null)
})
test('DOS-M1-008: multiple doctor contexts require an explicit selection', async () => {
  const { controller, state } = fixture([dto(1), dto(2)])
  assert.equal(await controller.refresh(), false)
  assert.equal(state.phase, 'choosing'); assert.equal(state.current, null)
  assert.throws(() => controller.capture('patients'), /CONTEXT_REQUIRED/)
  assert.equal(await controller.choose(doctorContextId(doctorLocationContext(dto(2), actor, 'local'))), true)
  assert.equal(state.current.practiceId, dto(2).practice_id)
})
test('DOS-M1-008: switching aborts stale reads and clears private rows/drafts before server resolution', async () => {
  const wait = deferred()
  const { controller, state, repository } = fixture([dto(1), dto(2)])
  await controller.refresh(); await controller.choose(`${dto(1).practice_id}:${dto(1).location_id}`)
  const old = controller.capture('patients', { search: 'synthetic' })
  const privateState = { rows: ['synthetic-row'], draft: 'synthetic-draft' }
  controller.registerClear(() => { privateState.rows = []; privateState.draft = '' })
  repository.resolve = () => wait.promise
  const switching = controller.choose(`${dto(2).practice_id}:${dto(2).location_id}`)
  assert.equal(state.current, null)
  assert.equal(old.signal.aborted, true)
  assert.equal(old.accepts(), false)
  assert.deepEqual(privateState, { rows: [], draft: '' })
  wait.resolve(dto(2))
  assert.equal(await switching, true)
  assert.equal(state.current.practiceId, dto(2).practice_id)
})
test('DOS-M1-008: slow earlier selections cannot restore a previous practice', async () => {
  const first = deferred(); const second = deferred()
  const { controller, state, repository } = fixture([dto(1), dto(2)])
  await controller.refresh()
  repository.resolve = async practice => practice === dto(1).practice_id ? first.promise : second.promise
  const a = controller.choose(`${dto(1).practice_id}:${dto(1).location_id}`)
  await new Promise(resolve => setImmediate(resolve))
  const b = controller.choose(`${dto(2).practice_id}:${dto(2).location_id}`)
  await new Promise(resolve => setImmediate(resolve))
  second.resolve(dto(2)); assert.equal(await b, true)
  first.resolve(dto(1)); assert.equal(await a, false)
  assert.equal(state.current.practiceId, dto(2).practice_id)
})
test('DOS-M1-008: revoked or archived context clears private state without silently selecting another doctor', async () => {
  const { controller, state, repository } = fixture([dto(1), dto(2)])
  await controller.refresh(); await controller.choose(`${dto(1).practice_id}:${dto(1).location_id}`)
  const old = controller.capture('documents')
  repository.load = async () => [dto(2)]
  assert.equal(await controller.refresh(), false)
  assert.equal(old.accepts(), false)
  assert.equal(state.phase, 'choosing'); assert.equal(state.current, null)
  assert.equal(state.options.length, 1)
})
test('DOS-M1-008: cleanup failure blocks selection and permits no protected capture', async () => {
  const { controller, state } = fixture()
  controller.registerClear(() => { throw new Error('Synthetic cleanup failure') })
  assert.equal(await controller.refresh(), false)
  assert.equal(state.current, null)
  assert.equal(state.error, 'cleanup')
  assert.throws(() => controller.capture('patients'), /CONTEXT_REQUIRED/)
})
test('DOS-M1-008: logout and a new session reject in-flight context responses', async () => {
  const wait = deferred()
  const { controller, state, actor: setActor, repository } = fixture([dto(1)], { load: () => wait.promise })
  const old = controller.refresh()
  await controller.clear(); setActor({ ...actor, sessionId: 'new-session' })
  repository.load = async () => [dto(1)]
  assert.equal(await controller.refresh(), true)
  wait.resolve([dto(2)])
  assert.equal(await old, false)
  assert.equal(state.current.sessionId, 'new-session')
  assert.equal(state.current.practiceId, dto(1).practice_id)
})

test('DOS-M1-008: a syntactically valid forged context preference never creates authority', async () => {
  const { controller, state, preference } = fixture([dto(1), dto(2)])
  preference({ userId: actor.userId, sessionId: actor.sessionId, practiceId: dto(3).practice_id, locationId: dto(3).location_id })
  assert.equal(await controller.refresh(), false)
  assert.equal(state.current, null)
  assert.equal(await controller.choose(`${dto(3).practice_id}:${dto(3).location_id}`), false)
})

const query = { page: 0, size: 20, search: '' }
const form = { name: 'Synthetic clinic', timezone: 'Europe/London', phone: '', address: '' }
const directory = { practiceName: 'Synthetic practice', rows: [], total: 0, canCreate: true }
function locationFixture(overrides = {}) {
  let selected = doctorLocationContext(dto(1), actor, 'local'); let nextKey = 0
  const repository = { load: async () => directory, write: async () => {}, archive: async () => {}, ...overrides }
  const state = doctorLocationsState()
  const controller = createDoctorLocationsController(repository, state, () => selected, () => `synthetic-key-${++nextKey}`)
  return { controller, state, repository, select: value => { selected = value } }
}
test('DOS-M1-008: location DTOs cannot mix practices and configurable IANA zones observe offset changes', () => {
  const row = { id: dto(1).location_id, practice_id: dto(2).practice_id, name: form.name, timezone: form.timezone, contact_phone: '', contact_address: '', archived_at: null, version: 1, can_manage: true }
  assert.throws(() => doctorLocationDirectory({ practice_name: 'Synthetic', rows: [row], total: 1, can_create: true }, dto(1).practice_id), /RESPONSE_INVALID/)
  assert.equal(validDoctorLocationForm(form), true)
  assert.equal(validDoctorLocationForm({ ...form, timezone: '+02:00' }), false)
  assert.equal(validDoctorSetupForm({ displayName: 'Synthetic', practiceName: 'Synthetic', locationName: 'Synthetic', timezone: '+02:00' }, true), false)
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: form.timezone, hour: '2-digit', hourCycle: 'h23' })
  assert.equal(formatter.format(new Date('2026-01-15T12:00:00Z')), '12')
  assert.equal(formatter.format(new Date('2026-07-15T12:00:00Z')), '13')
})
test('DOS-M1-008: late location reads cannot restore rows after context clearing', async () => {
  const wait = deferred(); let oldSignal
  const { controller, state, repository } = locationFixture({ load: (_practice, _query, signal) => { oldSignal = signal; return wait.promise } })
  const old = controller.load(query)
  controller.clear()
  assert.equal(oldSignal.aborted, true)
  repository.load = async () => ({ ...directory, practiceName: 'New scope' })
  assert.equal(await controller.load(query), true)
  wait.resolve(directory)
  assert.equal(await old, false)
  assert.equal(state.directory.practiceName, 'New scope')
})
test('DOS-M1-008: uncertain command retries reuse their key, new successful intent receives a new key', async () => {
  const keys = []; let fail = true
  const { controller, repository } = locationFixture({ write: async (_practice, _row, _form, key) => { keys.push(key); if (fail) throw new Error('Synthetic uncertain outcome') } })
  await controller.load(query)
  assert.equal(await controller.write(null, form), false)
  fail = false
  assert.equal(await controller.write(null, form), true)
  assert.equal(keys[0], keys[1])
  assert.equal(await controller.write(null, form), true)
  assert.notEqual(keys[1], keys[2])
  repository.write = async () => { throw { code: '42501', message: 'Private database detail' } }
  assert.equal(await controller.write(null, form), false)
  assert.equal(controller.state.error, 'denied')
})
test('DOS-M1-008: double submission and read refresh cannot interrupt a pending write; cleared commands cannot commit UI state', async () => {
  const wait = deferred(); let writes = 0; let reads = 0
  const { controller, state } = locationFixture({ load: async () => { reads++; return directory }, write: async () => { writes++; await wait.promise } })
  await controller.load(query)
  const pending = controller.write(null, form)
  assert.equal(state.pending, true)
  assert.equal(await controller.write(null, form), false)
  assert.equal(await controller.load(query), false)
  assert.equal(writes, 1); assert.equal(reads, 1)
  controller.clear(); wait.resolve()
  assert.equal(await pending, false)
  assert.equal(state.pending, false); assert.equal(state.directory, null)
})
