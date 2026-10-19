import test from 'node:test'
import { doctorReturnPath } from '../../app/utils/authConfiguration.ts'
import assert from 'node:assert/strict'
import { doctorSchedule,doctorAvailability,doctorScheduleInput,validDoctorSchedule,doctorScheduleDate,doctorClockMinute,doctorMinuteClock,doctorAvailabilityToday } from '../../app/utils/availability.ts'
import { createDoctorAvailabilityController,doctorAvailabilityState } from '../../app/utils/availabilityController.ts'
const id = n => `a2000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const raw = () => ({ practice_id: id(1),location_id: id(2),timezone: 'Africa/Cairo',location_version: 1,version: 1,slot_minutes: 20,weekly: [{ weekday: 1,start: 540,end: 1020 }],exceptions: [],can_manage: true,existing_commitments: 2,override_policy: 'deny' })
const configuration = () => doctorSchedule(raw(),id(1),id(2))
const deferred = () => { let resolve; let reject; const promise = new Promise((yes,no) => { resolve = yes; reject = no }); return { promise,resolve,reject } }
function fixture() {
  let scope = { environment: 'local',portal: 'doctor',userId: id(3),sessionId: id(4),practiceId: id(1),locationId: id(2),locationVersion: 1,timezone: 'Africa/Cairo',grantsVersion: 1,capabilities: ['availability.manage','appointments.read'] }
  let serial = 0; const calls = []; const state = doctorAvailabilityState()
  const repository = { load: async () => configuration(),slots: async () => ({ practiceId: id(1),locationId: id(2),locationVersion: 1,scheduleVersion: 1,timezone: 'Africa/Cairo',date: '2026-10-20',slotMinutes: 20,slots: [],overridePolicy: 'deny' }),write: async (...args) => { calls.push(args); return { ...configuration(),version: 2 } } }
  const controller = createDoctorAvailabilityController(repository,state,() => scope,() => id(100+(++serial)))
  return { repository,state,calls,controller,scope: () => scope,setScope(value) { scope = value } }
}
test('DOS-M1-013-C02: clock/day parsing handles midnight and rejects impossible local input',() => {
  assert.equal(doctorClockMinute('24:00'),null); assert.equal(doctorClockMinute('24:00',true),1440); assert.equal(doctorMinuteClock(1440),'24:00'); assert.equal(doctorClockMinute('23:59'),1439)
  for (const value of ['25:00','12:60','9:00','01:00Z','10:00+03:00']) assert.equal(doctorClockMinute(value),null)
  assert.equal(doctorScheduleDate('2024-02-29'),true); assert.equal(doctorScheduleDate('2025-02-29'),false)
  assert.equal(doctorAvailabilityToday('Africa/Cairo',new Date('2026-01-01T23:30:00Z')),'2026-01-02')
})
test('DOS-M1-013-C04: strict rule projections reject override policy and preserve mutable input isolation',() => {
  assert.throws(() => doctorSchedule({ ...raw(),override_policy: 'allow' },id(1),id(2)))
  assert.throws(() => doctorSchedule(raw(),id(1),id(99)))
  const data = configuration(); const form = doctorScheduleInput(data); form.weekly[0].end = 1000; assert.equal(data.weekly[0].end,1020)
  assert.equal(validDoctorSchedule({ ...form,weekly: [{ weekday: 1,start: 540,end: 600 },{ weekday: 1,start: 580,end: 620 }] }),false)
  assert.equal(validDoctorSchedule({ ...form,weekly: [{ weekday: 1,start: 540,end: 600 },{ weekday: 1,start: 600,end: 620 }] }),true)
  assert.equal(validDoctorSchedule({ ...form,exceptions: [{ date: '2026-10-20',closed: true,windows: [{ start: 540,end: 600 }],reason: 'Synthetic closure' }] }),false)
  assert.equal(validDoctorSchedule({ ...form,exceptions: [{ date: '2026-10-20',closed: true,windows: [],reason: '' }] }),false)
})
test('availability decoder rejects foreign scope, repeated slots and unsupported conflict claims',() => {
  const data = { practice_id: id(1),location_id: id(2),timezone: 'Africa/Cairo',location_version: 1,schedule_version: 1,slot_minutes: 20,date: '2026-10-20',override_policy: 'deny',slots: [{ minute: 540,starts_at: '2026-10-20T06:00:00Z',ends_at: '2026-10-20T06:20:00Z',available: true,reason: null }] }
  assert.equal(doctorAvailability(data,id(1),id(2),data.date).slots[0].available,true)
  assert.throws(() => doctorAvailability({ ...data,slots: [...data.slots,...data.slots] },id(1),id(2),data.date))
  assert.throws(() => doctorAvailability({ ...data,slots: [{ ...data.slots[0],available: false,reason: 'override_approved' }] },id(1),id(2),data.date))
  assert.throws(() => doctorAvailability(data,id(1),id(99),data.date))
})
test('uncertain rule save retains exact input/key and prevents duplicate submissions',async () => {
  const f = fixture(); await f.controller.load(); const form = doctorScheduleInput(f.state.config)
  f.repository.write = async (...args) => { f.calls.push(args); throw new Error('lost response') }
  assert.equal(await f.controller.write(form,1),false); assert.equal(await f.controller.write(form,1),false); assert.equal(f.calls[0][5],f.calls[1][5]); assert.deepEqual(f.calls[0][4],f.calls[1][4])
  const waiting = deferred(); f.repository.write = async (...args) => { f.calls.push(args); return waiting.promise }
  const save = f.controller.write(form,1); assert.equal(await f.controller.write(form,1),false); waiting.resolve({ ...configuration(),version: 2 }); assert.equal(await save,true); assert.equal(f.state.config.version,2); assert.equal(f.state.pending,false)
})
test('a stale dialog cannot save against a refreshed rule version',async () => {
  const f = fixture(); await f.controller.load(); const form = doctorScheduleInput(f.state.config); f.state.config.version = 2
  assert.equal(await f.controller.write(form,1),false); assert.equal(f.state.actionError,'conflict'); assert.equal(f.calls.length,0)
})
test('location timezone/version changes require context reconciliation before showing mixed availability',async () => {
  const f = fixture(); f.repository.load = async () => ({ ...configuration(),timezone: 'Etc/UTC',locationVersion: 2 })
  assert.equal(await f.controller.load(),false); assert.equal(f.state.error,'conflict'); assert.equal(f.state.config,null)
  const g = fixture(); await g.controller.load(); g.repository.slots = async () => ({ locationVersion: 1,scheduleVersion: 2,timezone: 'Africa/Cairo',slots: [] })
  assert.equal(await g.controller.slots('2026-10-20'),false); assert.equal(g.state.slots,null); assert.equal(g.state.slotsError,'conflict')
})
test('scope loss aborts requests, invalidates late results and clears working-hour drafts',async () => {
  const f = fixture(); const loaded = deferred(); f.repository.load = () => loaded.promise
  const request = f.controller.load(); f.controller.clear(); f.setScope(null); loaded.resolve(configuration()); assert.equal(await request,false); assert.equal(f.state.config,null)
  const g = fixture(); await g.controller.load(); const pending = deferred(); let signal; g.repository.write = async (...args) => { signal = args[6]; return pending.promise }
  const save = g.controller.write(doctorScheduleInput(g.state.config),1); g.controller.clear(); assert.equal(signal.aborted,true); pending.reject(new Error('late error')); assert.equal(await save,false); assert.equal(g.state.actionError,null); assert.equal(g.state.config,null)
})
test('known authorization denial clears previously loaded private rules and cannot become a local override',async () => {
  const f = fixture(); await f.controller.load(); f.repository.slots = async () => { throw { code: '42501' } }
  assert.equal(await f.controller.slots('2026-10-20'),false); assert.equal(f.state.config,null); assert.equal(f.state.slots,null)
  const g = fixture(); await g.controller.load(); g.setScope({ ...g.scope(),capabilities: ['appointments.read'] }); assert.equal(await g.controller.write(doctorScheduleInput(g.state.config),1),false); assert.equal(g.calls.length,0)
})

test('registered availability route retains authenticated admission without broadening external redirects',() => {
  assert.equal(doctorReturnPath('/availability?private=synthetic#fragment'),'/availability')
  for (const path of ['//external.test/availability','https://external.test/availability','/availability/unknown','/availability/../../external']) assert.equal(doctorReturnPath(path),'/workspace')
})

test('stale location timezone context is refused before calling the write adapter',async () => {
  const f = fixture();await f.controller.load();const form = doctorScheduleInput(f.state.config)
  f.setScope({ ...f.scope(),locationVersion: 2,timezone: 'Etc/UTC' })
  assert.equal(await f.controller.write(form,1),false);assert.equal(f.state.actionError,'conflict');assert.equal(f.calls.length,0)
})
test('schedule write carries the configuration location version before server mutation',async () => {
  const f = fixture();await f.controller.load();assert.equal(await f.controller.write(doctorScheduleInput(f.state.config),1),true);assert.equal(f.calls[0][3],1)
})
