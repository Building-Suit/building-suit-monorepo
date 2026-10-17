// Actual owned Supabase Realtime, Auth SID and appointment acceptance. No hosted URL.
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createDoctorRealtimeWireProbe } from './realtime-provider-probe.mjs'
import { doctorAvailabilityToday } from '../app/utils/availability.ts'
const wait = ms => new Promise(resolve => setTimeout(resolve,ms))
export async function verifyDoctorAppointmentProvider({ api,key,a,b,rpc,expect,setStage,probe,advanceRevision,independentWire }) {
  const ownerWire = createDoctorRealtimeWireProbe()
  const frozen = createClient(api,key,{ auth: { persistSession: false,autoRefreshToken: false,detectSessionInUrl: false },accessToken: async () => a.session.access_token,realtime: { logger: ownerWire.logger } })
  const channels = [];let revisionA = 0;let revisionB = 0;let forbidden = 0;let invalidPayload = false
  const allowedKeys = new Set(['practice_id','location_id','revision'])
  function observe(practiceId,locationId,accept) { return payload => {
    const row = payload.new
    if(!row || row.practice_id!==practiceId || row.location_id!==locationId || !Number.isSafeInteger(row.revision)
      || Object.keys(row).some(key => !allowedKeys.has(key)) || Object.keys(payload.old || {}).some(key => !allowedKeys.has(key))) { invalidPayload = true;return }
    accept(row.revision)
  } }
  async function until(condition,label) { const deadline = Date.now()+20000;while(!condition()) { expect(!invalidPayload,'Actual Realtime emitted unexpected data');expect(Date.now()<deadline,label);await wait(50) } }
  async function subscribe(client,locationId,callback) {
    const channel = client.channel(`synthetic-queue-${randomUUID()}`,{ config: { postgres_changes_options: { wait: true } } })
    for(const event of ['INSERT','UPDATE'])channel.on('postgres_changes',{ schema: 'public',table: 'appointment_queue_revisions',event,filter: `location_id=eq.${locationId}` },callback)
    channels.push({ client,channel })
    await new Promise((resolve,reject) => {
      let joined = false;let ready = false
      const timer = setTimeout(() => reject(new Error('Actual Realtime join deadline')),20000)
      const finish = () => { if(joined && ready) { clearTimeout(timer);resolve() } }
      channel.on('system',{},payload => { if(payload.extension!=='postgres_changes')return;if(payload.status==='ok') { ready = true;finish() } else if(payload.status==='error') { clearTimeout(timer);reject(new Error('Actual Postgres subscription failed')) } })
      channel.subscribe(status => { if(status==='SUBSCRIBED') { joined = true;finish() } else if(['CHANNEL_ERROR','TIMED_OUT'].includes(status)) { clearTimeout(timer);reject(new Error('Actual Realtime join failed')) } })
    })
    return channel
  }
  async function increment(practiceId,locationId) { await advanceRevision(practiceId,locationId) }
  async function cleanup() {
    await Promise.allSettled(channels.map(({ client,channel }) => client.removeChannel(channel)))
    frozen.realtime.disconnect()
  }
  try {
    setStage('actual queue timezone and hours')
    // Keep the synthetic fixture around local noon so same-day check-in is
    // deterministic even when the runner starts near a UTC date boundary.
    const offset = 12-new Date().getUTCHours();const zone = offset===0 ? 'Etc/UTC' : `Etc/GMT${offset>0 ? '-' : '+'}${Math.abs(offset)}`
    await rpc(a.client,'doctor_write_location',{ p_practice: a.scope.practiceId,p_location: a.scope.locationId,p_expected_version: 1,p_name: 'Synthetic queue acceptance clinic',p_timezone: zone,p_phone: '',p_address: '',p_key: randomUUID() })
    const config = await rpc(a.client,'doctor_schedule',{ p_practice: a.scope.practiceId,p_location: a.scope.locationId })
    const hours = await rpc(a.client,'doctor_write_schedule',{ p_practice: a.scope.practiceId,p_location: a.scope.locationId,p_expected_version: 0,p_location_version: config.location_version,p_input: { slot_minutes: 20,weekly: Array.from({ length: 7 },(_,weekday) => ({ weekday,start: 540,end: 1020 })),exceptions: [] },p_key: randomUUID() })
    await frozen.realtime.setAuth(a.session.access_token)
    setStage('actual Realtime owner A join')
    let channelA = await subscribe(frozen,a.scope.locationId,observe(a.scope.practiceId,a.scope.locationId,value => { revisionA = Math.max(revisionA,value) }))
    setStage('actual Realtime independent B join')
    await subscribe(b.client,b.scope.locationId,observe(b.scope.practiceId,b.scope.locationId,value => { revisionB = Math.max(revisionB,value) }))
    setStage('actual Realtime foreign-scope join')
    await subscribe(b.client,a.scope.locationId,() => { forbidden++ })
    const date = doctorAvailabilityToday(zone);const parts = new Intl.DateTimeFormat('en-GB',{ timeZone: zone,hour: '2-digit',minute: '2-digit',hourCycle: 'h23' }).formatToParts(new Date());const value = type => Number(parts.find(part => part.type===type).value)
    const minute = (Math.floor((value('hour')*60+value('minute'))/20)+2)*20
    const base = { p_practice: a.scope.practiceId,p_location: a.scope.locationId }
    const book = (day,minute,key = randomUUID()) => rpc(a.client,'doctor_book_appointment',{ ...base,p_patient: a.scope.patientId,p_day: day,p_minute: minute,p_schedule_version: hours.version,p_location_version: hours.location_version,p_key: key })
    setStage('actual queue check-in and history')
    const booked = await book(date,minute)
    setStage('actual protected revision row visibility')
    const row = await frozen.from('appointment_queue_revisions').select('revision').eq('location_id',a.scope.locationId).single()
    expect(!row.error && row.data?.revision>=1,'Actual owner cannot read its protected revision')
    setStage('actual Realtime booking revision');await until(() => revisionA>=1,'Actual booking revision missing')
    setStage('actual queue check-in retry')
    const checkKey = randomUUID();const transition = (state,version,key = randomUUID()) => rpc(a.client,'doctor_transition_appointment',{ ...base,p_appointment: booked.appointment_id,p_expected_version: version,p_state: state,p_reason: '',p_key: key })
    expect((await transition('checked_in',1,checkKey)).version===2,'Actual check-in failed')
    expect((await transition('checked_in',1,checkKey)).version===2,'Actual check-in retry duplicated transition')
    setStage('actual queue checked-in projection')
    const checked = await rpc(a.client,'doctor_appointment_board',{ ...base,p_day: date })
    expect(checked.queue.length===1 && checked.queue[0].id===booked.appointment_id,'Actual queue did not retain exactly one entry')
    setStage('actual queue administrative completion');await transition('in_progress',2);await transition('completed',3)
    const completed = await rpc(a.client,'doctor_appointment_board',{ ...base,p_day: date })
    expect(completed.queue.length===0,'Actual completion retained active queue entry')
    const history = await rpc(a.client,'doctor_appointment_history',{ ...base,p_appointment: booked.appointment_id })
    expect(history.total===4 && history.events.every(item => item.actor_user_id===a.user.id),'Actual lifecycle history/attribution failed')
    const future = new Date(`${date}T00:00:00Z`);future.setUTCDate(future.getUTCDate()+7);const day = future.toISOString().slice(0,10)
    setStage('actual Realtime disconnected reschedule')
    const later = await book(day,540);expect((await frozen.removeChannel(channelA))==='ok','Actual Realtime disconnect failed')
    const move = { ...base,p_appointment: later.appointment_id,p_expected_version: 1,p_destination: a.scope.locationId,p_day: day,p_minute: 560,p_schedule_version: hours.version,p_location_version: hours.location_version,p_reason: 'Synthetic reconnect reschedule',p_key: randomUUID() }
    expect((await rpc(a.client,'doctor_reschedule_appointment',move)).version===2,'Actual disconnected reschedule failed')
    expect((await rpc(a.client,'doctor_reschedule_appointment',move)).version===2,'Actual reschedule retry duplicated transition')
    channelA = await subscribe(frozen,a.scope.locationId,observe(a.scope.practiceId,a.scope.locationId,value => { revisionA = Math.max(revisionA,value) }))
    const refreshed = await rpc(frozen,'doctor_appointment_board',{ ...base,p_day: day })
    expect(refreshed.items.length===1 && refreshed.items[0].id===later.appointment_id && refreshed.items[0].version===2,'Actual authoritative reconnect refresh missed or duplicated a change')
    const denied = await b.client.rpc('doctor_appointment_board',{ ...base,p_day: day });expect(denied.error?.code==='42501','Actual Doctor B read reached Doctor A')
    setStage('actual Realtime independent channel barrier')
    await increment(b.scope.practiceId,b.scope.locationId);await until(() => revisionB>=1,'Actual independent Doctor B channel was not functional');await wait(350)
    expect(forbidden===0 && !invalidPayload,'Actual Realtime scope/payload denial failed')
    console.log('Actual appointments/Realtime: one checked-in entry, attributed lifecycle, reschedule retry, disconnect/refetch and isolated revision-only channels passed')
    return {
      async verifyRevocation() {
        setStage('actual Realtime frozen-session revocation')
        const denied = await frozen.rpc('doctor_appointment_board',{ ...base,p_day: day });expect(denied.error?.code==='42501','Frozen Auth SID remained valid for appointment refresh')
        const before = revisionA;const beforeB = revisionB
        await increment(a.scope.practiceId,a.scope.locationId);await increment(b.scope.practiceId,b.scope.locationId);await until(() => revisionB>beforeB,'Independent Doctor B channel stopped after A signout');await wait(750)
        expect(revisionA===before && forbidden===0 && !invalidPayload,'Revoked Auth SID received an actual Realtime revision')
        console.log('Actual Realtime: frozen revoked session receives no revision; independent Doctor B remains current')
      },cleanup,
    }
  } catch(error) {
    const metadata = await probe().catch(() => ({ available: false }))
    console.log(`Owned Realtime failure metadata: ${JSON.stringify(metadata)}`)
    const previousA = revisionA;const previousB = revisionB;let controlAvailable = false
    try { await increment(a.scope.practiceId,a.scope.locationId);await increment(b.scope.practiceId,b.scope.locationId);await wait(1500);controlAvailable = true } catch { /* failure-only control stays unavailable */ }
    console.log(`Owned Realtime failure controls: ${JSON.stringify({ available: controlAvailable,owner_update_seen: revisionA>previousA,independent_insert_seen: revisionB>previousB,foreign_scope_blocked: forbidden===0,unexpected_payload: invalidPayload })}`)
    console.log(`Owned Realtime failure wire: ${JSON.stringify({ owner: ownerWire.summary(),independent: independentWire.summary() })}`)
    await cleanup();throw error
  }
}
