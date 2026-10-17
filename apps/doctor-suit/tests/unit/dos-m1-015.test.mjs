import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorDashboardController,doctorDashboardState } from '../../app/utils/dashboardController.ts'
const id = n => `d1500000-0000-0000-0000-${String(n).padStart(12,'0')}`
const owner = { userId: id(1),sessionId: id(2),practiceId: id(3) }
const scope = (n,changes = {}) => ({ environment: 'local',portal: 'doctor',userId: owner.userId,sessionId: owner.sessionId,practiceId: owner.practiceId,locationId: id(n),grantsVersion: 1,locationVersion: 1,practiceName: 'Synthetic practice',doctorName: 'Synthetic doctor',locationName: `Synthetic clinic ${n}`,timezone: 'Etc/UTC',capabilities: ['dashboard.read','appointments.read'],...changes })
function fixture(options = [scope(4)]) {
  let actor = owner;const state = doctorDashboardState();const calls = []
  const repository = { contexts: async () => options,board: async (practiceId,locationId,query,signal) => { calls.push({ practiceId,locationId,query,signal });const context = options.find(item => item.locationId===locationId);return { practiceId,locationId,date: query.date,timezone: context.timezone,locationVersion: context.locationVersion,total: 45,queueTotal: 22,items: [],queue: [],page: query.page,queuePage: query.queuePage } } }
  const controller = createDoctorDashboardController(repository,state,() => actor,() => new Date('2026-10-17T00:30:00Z'))
  return { state,repository,calls,controller,setActor(value) { actor = value } }
}
test('DOS-M1-015-C01: Today totals retain authoritative full counts with independently paged source rows',async () => {
  const f = fixture();assert.equal(await f.controller.load({ [`${id(3)}:${id(4)}`]: { page: 2,queuePage: 1 } }),true)
  assert.equal(f.state.sections[0].board.total,45);assert.equal(f.state.sections[0].board.queueTotal,22);assert.equal(f.state.sections[0].board.items.length,0)
  assert.deepEqual(f.calls[0].query,{ date: '2026-10-17',page: 2,queuePage: 1 });assert.equal(f.state.refreshedAt,'2026-10-17T00:30:00.000Z')
})
test('each clinic uses the same captured instant and its own local date across midnight',async () => {
  const f = fixture([scope(4,{ timezone: 'Pacific/Kiritimati' }),scope(5,{ timezone: 'Etc/GMT+12' })]);await f.controller.load()
  assert.deepEqual(f.calls.map(item => item.query.date),['2026-10-17','2026-10-16'])
})
test('DOS-M1-015-C02: all doctor clinics and only exact dashboard/appointment grants are requested',async () => {
  const f = fixture([scope(4),scope(5),scope(6,{ portal: 'secretary',capabilities: ['appointments.read'] }),scope(7,{ portal: 'secretary',capabilities: ['dashboard.read'] }),scope(8,{ portal: 'secretary' })]);await f.controller.load()
  assert.deepEqual(f.calls.map(item => item.locationId),[id(4),id(5),id(8)])
  assert.deepEqual(f.state.sections.map(item => item.context.locationId),[id(4),id(5),id(8)])
})
test('known denial aborts sibling reads and discards all private sections',async () => {
  const f = fixture([scope(4),scope(5)]);let signal;f.repository.board = async (_practice,location,_query,value) => { signal = value;if(location===id(4))throw { code: '42501' };return new Promise(resolve => value.addEventListener('abort',() => resolve({}))) }
  assert.equal(await f.controller.load(),false);assert.equal(signal.aborted,true);assert.deepEqual(f.state.sections,[]);assert.equal(f.state.error,'denied');assert.equal(f.state.loading,false)
})
test('scope cleanup prevents old private reads from repopulating the dashboard',async () => {
  const f = fixture();let resolve;f.repository.board = () => new Promise(value => { resolve = value });const pending = f.controller.load();await Promise.resolve();f.controller.clear();resolve({ locationVersion: 1,timezone: 'Etc/UTC' });assert.equal(await pending,false);assert.deepEqual(f.state.sections,[]);assert.equal(f.state.refreshedAt,null)
})
test('changed clinic timezone or location version fails closed',async () => {
  const f = fixture();f.repository.board = async () => ({ locationVersion: 2,timezone: 'Africa/Cairo' });assert.equal(await f.controller.load(),false);assert.equal(f.state.error,'conflict');assert.deepEqual(f.state.sections,[])
})
test('DOS-M1-015-C04: zero granted clinics produces an empty authoritative result',async () => {
  const f = fixture([]);assert.equal(await f.controller.load(),true);assert.equal(f.calls.length,0);assert.deepEqual(f.state.sections,[]);assert.equal(f.state.error,null)
})
test('malformed pagination cannot issue a source request',async () => {
  const f = fixture();assert.equal(await f.controller.load({ [`${id(3)}:${id(4)}`]: { page: -1,queuePage: 0 } }),false);assert.equal(f.calls.length,0);assert.deepEqual(f.state.sections,[])
})


test('DOS-M1-015-C03: source URLs require exact current practice/clinic and a valid record identity',async () => {
  const { doctorDashboardSource } = await import('../../app/utils/dashboardSource.ts')
  const selected = { practiceId: id(3),locationId: id(4) };const query = { appointment: id(20),day: '2026-10-17',practice: selected.practiceId,location: selected.locationId }
  assert.deepEqual(doctorDashboardSource(query,selected),{ appointmentId: id(20),date: '2026-10-17',page: 0,queuePage: 0 });assert.equal(doctorDashboardSource({},selected),null)
  for(const change of [{ practice: id(99) },{ location: id(99) },{ appointment: [id(20)] },{ day: '2026-02-30' },{ page: ['2'] },{ queuePage: '-1' },{ page: '100001' }])assert.equal(doctorDashboardSource({ ...query,...change },selected),'denied')
  assert.equal(doctorDashboardSource(query,null),'denied');assert.deepEqual(doctorDashboardSource({ ...query,page: '2',queuePage: '1' },selected),{ appointmentId: id(20),date: '2026-10-17',page: 2,queuePage: 1 })
})
