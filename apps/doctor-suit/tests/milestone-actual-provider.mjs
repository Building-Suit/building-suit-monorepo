// Complete synthetic administrative slice against owned actual GoTrue/PostgREST.
// No provider credentials, mail, identifiers or raw responses enter logs/artifacts.
import { randomUUID,randomBytes,createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { doctorAvailabilityToday } from '../app/utils/availability.ts'
export async function verifyDoctorMilestoneProvider({ api,origin,publicKey,mail,options,setStage }) {
  const expect = (value,label) => { if(!value)throw new Error(label) }
  const rpc = async (client,name,args) => { const result = await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000));expect(!result.error,`Milestone ${name} rejected`);return result.data }
  const denied = async (client,name,args,code='42501') => expect((await client.rpc(name,args)).error?.code===code,`Milestone ${name} denial missing`)
  const clients = []
  async function account(label) {
    const client = createClient(api,publicKey,options);clients.push(client)
    const email = `synthetic-milestone-${label}-${randomUUID()}@example.test`.toLowerCase();const password = `Synthetic-${randomUUID()}!9`
    const result = await client.auth.signUp({ email,password,options: { emailRedirectTo: `${origin}/verify`,data: { role: 'owner',clinical_signer: true } } })
    expect(!result.error && !result.data.session,'Milestone unconfirmed signup admitted')
    const link = await mail(email);expect(['127.0.0.1','localhost'].includes(link.hostname),'Milestone mail target invalid');const confirmation = await fetch(link,{ redirect: 'manual' });expect(confirmation.status>=300 && confirmation.status<400,'Milestone confirmation failed')
    const signin = await client.auth.signInWithPassword({ email,password });expect(!signin.error && signin.data.session,'Milestone confirmed signin failed')
    const identity = await rpc(client,'doctor_session_context');expect(identity.user_id===signin.data.user.id && identity.session_id && identity.practice_id===null,'Milestone metadata forged an owner')
    return { client,email,userId: identity.user_id,session: signin.data.session }
  }
  async function owner(label,zone) {
    const actor = await account(label);const key = randomUUID()
    const draft = await rpc(actor.client,'doctor_save_onboarding_draft',{ p_key: key,p_expected_version: 0,p_display_name: `Synthetic ${label}`,p_practice_name: `Synthetic milestone ${label}`,p_location_name: `Synthetic ${label}1`,p_timezone: zone })
    const complete = await rpc(actor.client,'doctor_complete_onboarding',{ p_key: key,p_draft_version: draft.version });const replay = await rpc(actor.client,'doctor_complete_onboarding',{ p_key: key,p_draft_version: draft.version })
    expect(complete.practice_id===replay.practice_id && complete.location_id===replay.location_id,'Milestone onboarding duplicated')
    return { ...actor,practiceId: complete.practice_id,locationId: complete.location_id }
  }
  const base = actor => ({ p_practice: actor.practiceId,p_location: actor.locationId })
  async function book(actor,name,zone) {
    const patientKey = randomUUID();const input = { ...base(actor),p_input: { name,phone: '',email: '',date_of_birth: null },p_key: patientKey }
    const patient = await rpc(actor.client,'doctor_write_patient',input);const retry = await rpc(actor.client,'doctor_write_patient',input);expect(patient.patient_id===retry.patient_id,'Milestone patient duplicated')
    const config = await rpc(actor.client,'doctor_schedule',base(actor));const schedule = await rpc(actor.client,'doctor_write_schedule',{ ...base(actor),p_expected_version: 0,p_location_version: config.location_version,p_input: { slot_minutes: 20,weekly: Array.from({ length: 7 },(_,weekday) => ({ weekday,start: 540,end: 1020 })),exceptions: [] },p_key: randomUUID() })
    const day = doctorAvailabilityToday(zone);const offers = await rpc(actor.client,'doctor_availability',{ ...base(actor),p_day: day });const slot = offers.slots.find(item => item.available && Date.parse(item.starts_at)>Date.now()+60000);expect(slot,'Milestone current-day slot absent')
    const command = { ...base(actor),p_patient: patient.patient_id,p_day: day,p_minute: slot.minute,p_schedule_version: schedule.version,p_location_version: schedule.location_version,p_key: randomUUID() }
    const appointment = await rpc(actor.client,'doctor_book_appointment',command);const again = await rpc(actor.client,'doctor_book_appointment',command);expect(appointment.appointment_id===again.appointment_id,'Milestone booking duplicated')
    return { patientId: patient.patient_id,appointmentId: appointment.appointment_id,day }
  }
  async function invite(actor,recipient,capabilities) {
    const token = randomBytes(32).toString('hex');const hash = createHash('sha256').update(Buffer.from(token,'hex')).digest('hex')
    const invitation = await rpc(actor.client,'doctor_invite_secretary',{ p_practice: actor.practiceId,p_email: recipient.email,p_grants: [{ location_id: actor.locationId,capabilities }],p_token_hash: hash,p_key: randomUUID() })
    const acceptance = { p_invitation: invitation.invitation_id,p_token: token,p_key: randomUUID() };await rpc(recipient.client,'doctor_accept_secretary_invitation',acceptance)
    return acceptance
  }
  try {
    setStage('actual M1 combined identity and doctor-alone onboarding')
    const offset = 12-new Date().getUTCHours();const zone = offset===0 ? 'Etc/UTC' : `Etc/GMT${offset>0 ? '-' : '+'}${Math.abs(offset)}`
    const a = await owner('A',zone);const b = await owner('B',zone);const secretary = await account('secretary');const outsider = await account('outsider')
    const second = await rpc(a.client,'doctor_write_location',{ p_practice: a.practiceId,p_name: 'Synthetic A2',p_timezone: 'Europe/London',p_phone: '',p_address: '',p_key: randomUUID() })
    const contexts = await rpc(a.client,'doctor_contexts');expect(contexts.length===2 && contexts.every(item => item.practice_id===a.practiceId && item.portal==='doctor'),'Milestone two-clinic owner context invalid')
    const aRecord = await book(a,'Synthetic milestone A patient',zone);const bRecord = await book(b,'Synthetic milestone B patient',zone)
    const transition = { ...base(a),p_appointment: aRecord.appointmentId,p_expected_version: 1,p_state: 'checked_in',p_reason: '',p_key: randomUUID() };await rpc(a.client,'doctor_transition_appointment',transition);await rpc(a.client,'doctor_transition_appointment',transition)
    const board = await rpc(a.client,'doctor_appointment_board',{ ...base(a),p_day: aRecord.day });expect(board.queue_total===1 && board.queue.length===1 && board.queue[0].patient_id===aRecord.patientId,'Milestone queue incorrect')
    const profile = await rpc(a.client,'doctor_patient_profile',{ ...base(a),p_patient: aRecord.patientId });expect(profile.patient.id===aRecord.patientId && profile.patient.practice_id===a.practiceId,'Milestone profile incorrect')
    const setup = await rpc(a.client,'doctor_practice_setup');expect(setup.profile.professional_verification==='unverified','Milestone professional authority inferred')
    setStage('actual M1 combined manual invitation and exact grants')
    const acceptedA = await invite(a,secretary,['patients.read','appointments.read','queue.manage']);await invite(b,secretary,['patients.read','appointments.read'])
    const staffContexts = await rpc(secretary.client,'doctor_contexts');expect(staffContexts.length===2 && staffContexts.every(item => item.portal==='secretary') && !staffContexts.some(item => item.location_id===second.location_id),'Milestone grants were widened')
    expect((await rpc(secretary.client,'doctor_session_context')).practice_id===null,'Milestone staff forged ownership')
    const started = await rpc(secretary.client,'doctor_transition_appointment',{ ...base(a),p_appointment: aRecord.appointmentId,p_expected_version: 2,p_state: 'in_progress',p_reason: '',p_key: randomUUID() });expect(started.state==='in_progress','Milestone permitted queue command failed')
    expect((await rpc(secretary.client,'doctor_patient_profile',{ ...base(b),p_patient: bRecord.patientId })).patient.id===bRecord.patientId,'Milestone independent B read failed')
    await denied(secretary.client,'doctor_transition_appointment',{ ...base(b),p_appointment: bRecord.appointmentId,p_expected_version: 1,p_state: 'checked_in',p_reason: '',p_key: randomUUID() })
    await denied(secretary.client,'doctor_write_patient',{ ...base(a),p_input: { name: 'Synthetic denied',phone: '',email: '',date_of_birth: null },p_key: randomUUID() })
    await denied(secretary.client,'doctor_patient_profile',{ ...base(a),p_location: second.location_id,p_patient: aRecord.patientId })
    await denied(secretary.client,'doctor_patient_profile',{ ...base(a),p_patient: bRecord.patientId })
    await denied(outsider.client,'doctor_appointment_board',{ ...base(a),p_day: aRecord.day })
    await denied(a.client,'doctor_patient_profile',{ ...base(b),p_patient: bRecord.patientId })
    await denied(a.client,'doctor_invite_secretary',{ p_practice: a.practiceId,p_email: outsider.email,p_grants: [{ location_id: a.locationId,capabilities: ['clinical.sign'] }],p_token_hash: 'a'.repeat(64),p_key: randomUUID() },'22023')
    setStage('actual M1 combined revocation and retained attribution')
    const directory = await rpc(a.client,'doctor_team',{ p_practice: a.practiceId });const member = directory.members.find(item => item.email===secretary.email);expect(member,'Milestone accepted member absent')
    await rpc(a.client,'doctor_set_membership_status',{ p_practice: a.practiceId,p_membership: member.id,p_version: member.version,p_status: 'revoked',p_key: randomUUID() })
    await denied(secretary.client,'doctor_appointment_board',{ ...base(a),p_day: aRecord.day });await denied(secretary.client,'doctor_accept_secretary_invitation',acceptedA)
    expect((await rpc(secretary.client,'doctor_appointment_board',{ ...base(b),p_day: bRecord.day })).items.length===1,'Milestone A revocation affected B')
    const history = await rpc(a.client,'doctor_appointment_history',{ ...base(a),p_appointment: aRecord.appointmentId });expect(history.total===3 && history.events.some(item => item.type==='appointment.in_progress' && item.actor_user_id===secretary.userId),'Milestone retained history attribution absent')
    const audit = await rpc(a.client,'doctor_administrative_audit',{ p_practice: a.practiceId,p_query: 'appointment.in_progress' });expect(audit.total===1 && audit.items[0].actor_user_id===secretary.userId,'Milestone retained audit attribution absent')
    const frozen = createClient(api,publicKey,{ ...options,global: { headers: { Authorization: `Bearer ${secretary.session.access_token}` } } });clients.push(frozen)
    expect(!(await secretary.client.auth.signOut({ scope: 'local' })).error,'Milestone staff signout failed');await denied(frozen,'doctor_appointment_board',{ ...base(b),p_day: bRecord.day })
    expect((await rpc(b.client,'doctor_appointment_board',{ ...base(b),p_day: bRecord.day })).items.length===1,'Milestone staff SID removal affected B owner')
    console.log('Actual M1 combined slice: doctor-alone two clinics, patient/profile/queue, stable retries, two manual invitations, exact grants, outsider/cross-practice/clinical denial, independent revocation and retained attribution passed')
  } finally { await Promise.allSettled(clients.map(client => client.removeAllChannels())) }
}
