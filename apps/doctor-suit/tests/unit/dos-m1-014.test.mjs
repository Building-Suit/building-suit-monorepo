import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorAppointmentTransitions,doctorAppointmentBoard,doctorAppointmentHistory,validDoctorAppointmentCommand,doctorAppointmentStates } from '../../app/utils/appointments.ts'
import { createDoctorAppointmentsController,doctorAppointmentsState } from '../../app/utils/appointmentsController.ts'
const id = n => `a1000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const query = { date: '2026-10-20',page: 0,queuePage: 0 }
const row = () => ({ id: id(9),practice_id: id(1),location_id: id(2),patient_id: id(8),patient_name: 'Synthetic patient',starts_at: '2026-10-20T09:00:00Z',ends_at: '2026-10-20T09:20:00Z',timezone: 'Etc/UTC',location_name: 'Synthetic clinic',state: 'booked',version: 1,checked_in_at: null,started_at: null,completed_at: null })
const rawBoard = () => ({ practice_id: id(1),location_id: id(2),date: query.date,timezone: 'Etc/UTC',location_version: 1,items: [row()],queue: [],page: 0,total: 1,queue_page: 0,queue_total: 0,revision: 1,can_write: true,can_queue: true,can_read_patients: true,external_notifications: 'disabled' })
const book = () => ({ kind: 'book',patientId: id(8),destinationId: id(2),date: query.date,minute: 540,scheduleVersion: 1,locationVersion: 1 })
function deferred() { let resolve,reject;const promise = new Promise((a,b) => { resolve = a;reject = b });return { promise,resolve,reject } }
function fixture() {
  let scope = { environment: 'local',portal: 'doctor',userId: id(3),sessionId: id(4),practiceId: id(1),locationId: id(2),grantsVersion: 1,locationVersion: 1,timezone: 'Etc/UTC',capabilities: ['appointments.read','appointments.write','patients.read','queue.manage'] }
  const state = doctorAppointmentsState();const calls = [];let serial = 0
  const repository = { board: async () => doctorAppointmentBoard(rawBoard(),id(1),id(2),query),command: async (...args) => { calls.push(args);return { appointmentId: id(9),version: 2 } },history: async () => null,offers: async () => null,patients: async () => ({ rows: [],total: 0,canWrite: false }) }
  const controller = createDoctorAppointmentsController(repository,state,() => scope,() => id(100+(++serial)))
  return { repository,state,calls,controller,scope: () => scope,setScope(value) { scope = value } }
}
test('DOS-M1-014-C01: explicit lifecycle has six allowed edges and no terminal exits',() => {
  const allowed = { booked: ['checked_in','cancelled','no_show'],checked_in: ['in_progress','cancelled'],in_progress: ['completed'],completed: [],cancelled: [],no_show: [] }
  for(const state of doctorAppointmentStates)assert.deepEqual(doctorAppointmentTransitions(state),allowed[state])
})
test('strict appointment boards reject foreign scope, unsafe lifecycle and duplicate identities',() => {
  assert.equal(doctorAppointmentBoard(rawBoard(),id(1),id(2),query).items.length,1)
  for(const change of [{ practice_id: id(6) },{ location_id: id(7) },{ external_notifications: 'delivered' },{ items: [row(),row()],total: 2 },{ items: [{ ...row(),state: 'in_progress' }] },{ queue: [row()],queue_total: 1 }])assert.throws(() => doctorAppointmentBoard({ ...rawBoard(),...change },id(1),id(2),query))
})
test('appointment-only read must not include patient name',() => { assert.throws(() => doctorAppointmentBoard({ ...rawBoard(),can_read_patients: false },id(1),id(2),query));assert.equal(doctorAppointmentBoard({ ...rawBoard(),can_read_patients: false,items: [{ ...row(),patient_name: null }] },id(1),id(2),query).items[0].patientName,null) })
test('commands reject unexpected states, missing reasons, foreign clocks and unknown operations',() => {
  assert.equal(validDoctorAppointmentCommand(book()),true)
  for(const change of [{ kind: 'deliver' },{ minute: 1440 },{ date: '2026-02-30' },{ locationVersion: 0 }])assert.equal(validDoctorAppointmentCommand({ ...book(),...change }),false)
  assert.equal(validDoctorAppointmentCommand({ kind: 'transition',appointmentId: id(9),version: 1,state: 'cancelled',reason: '' }),false)
  assert.equal(validDoctorAppointmentCommand({ kind: 'transition',appointmentId: id(9),version: 1,state: 'booked',reason: '' }),false)
  assert.equal(validDoctorAppointmentCommand({ kind: 'transition',appointmentId: id(9),version: 1,state: 'cancelled',reason: 'Synthetic cancellation' }),true)
})
test('DOS-M1-014-C02: uncertain command retries one key and refuses simultaneous submit',async () => {
  const f = fixture();f.repository.command = async (...args) => { f.calls.push(args);throw new Error('lost synthetic response') }
  assert.equal(await f.controller.command(book()),false);assert.equal(await f.controller.command(book()),false);assert.equal(f.calls[0][3],f.calls[1][3]);assert.deepEqual(f.calls[0][2],f.calls[1][2])
  const waiting = deferred();f.repository.command = async (...args) => { f.calls.push(args);return waiting.promise };const save = f.controller.command(book());assert.equal(await f.controller.command(book()),false);waiting.resolve({ appointmentId: id(9),version: 2 });assert.equal(await save,true)
})
test('scope and SID loss abort pending commands and invalidate late replies',async () => {
  const f = fixture();const pending = deferred();let signal;f.repository.command = async (...args) => { signal = args[4];return pending.promise };const save = f.controller.command(book());f.controller.clear();assert.equal(signal.aborted,true);f.setScope({ ...f.scope(),sessionId: id(5) });pending.resolve({ appointmentId: id(9),version: 2 });assert.equal(await save,false);assert.equal(f.state.board,null);assert.equal(f.state.pending,false)
})
test('known denial clears data and rejects a previously in-flight private result',async () => {
  const f = fixture();await f.controller.load(query);const pending = deferred();f.repository.history = async () => pending.promise;const history = f.controller.history(id(9));f.repository.command = async () => { throw { code: '42501' } };assert.equal(await f.controller.command(book()),false);assert.equal(f.state.board,null);assert.equal(f.state.actionError,'denied');pending.resolve({ appointmentId: id(9),events: [] });assert.equal(await history,false);assert.equal(f.state.history,null)
})
test('read refresh queued during command reconciles once after settlement',async () => {
  const f = fixture();const pending = deferred();f.repository.command = async () => pending.promise;let reads = 0;f.repository.board = async () => { reads++;return doctorAppointmentBoard(rawBoard(),id(1),id(2),query) };const save = f.controller.command(book());assert.equal(await f.controller.load(query),false);pending.resolve({ appointmentId: id(9),version: 2 });await save;await Promise.resolve();assert.equal(reads,1);assert.equal(f.state.board.items.length,1)
})
test('DOS-M1-014-C03: disconnect discards stale board, history and offered slots',async () => { const f = fixture();await f.controller.load(query);f.state.history = { events: [] };f.state.offers = { slots: [] };f.controller.disconnected();assert.equal(f.state.live,'reconnecting');assert.equal(f.state.board,null);assert.equal(f.state.history,null);assert.equal(f.state.offers,null);await f.controller.load(query);assert.equal(f.state.board.items.length,1) })
test('stale location context cannot commit a board from another timezone revision',async () => { const f = fixture();f.setScope({ ...f.scope(),locationVersion: 2,timezone: 'Africa/Cairo' });assert.equal(await f.controller.load(query),false);assert.equal(f.state.board,null);assert.equal(f.state.error,'conflict') })
test('DOS-M1-014-C04: no delivery command or misleading notification result exists',() => { assert.equal(validDoctorAppointmentCommand({ ...book(),kind: 'sms' }),false);assert.throws(() => doctorAppointmentBoard({ ...rawBoard(),external_notifications: 'sent' },id(1),id(2),query)) })
test('reschedule history rejects unbounded or malformed snapshots',() => {
 const raw = { practice_id: id(1),location_id: id(2),appointment_id: id(9),version: 2,page: 0,total: 1,events: [{ id: '1',type: 'appointment.rescheduled',version: 2,at: '2026-10-17T00:00:00Z',actor_user_id: id(3),location_id: id(2),details: { reason: 'Synthetic move',from: { location_id: id(2),location_name: 'Original',timezone: 'Etc/UTC',starts_at: row().starts_at,ends_at: row().ends_at },to: { location_id: id(2),location_name: 'New',timezone: 'Etc/UTC',starts_at: row().starts_at,ends_at: row().ends_at } } }] }
 assert.equal(doctorAppointmentHistory(raw,id(1),id(2),id(9),0).events[0].from.locationName,'Original');assert.throws(() => doctorAppointmentHistory({ ...raw,location_id: id(7) },id(1),id(2),id(9),0));raw.events[0].details.to.timezone = 'Invalid/Zone';assert.throws(() => doctorAppointmentHistory(raw,id(1),id(2),id(9),0))
})
