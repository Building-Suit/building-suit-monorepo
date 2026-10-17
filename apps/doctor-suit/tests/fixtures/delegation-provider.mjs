// In-memory multi-account browser protocol fixture. Actual authority is verified in SQL suites.
import { createHash, randomUUID } from 'node:crypto'
import { seedPatientProtocol, patientProtocol } from './patients-provider.mjs'
import { seedDocumentProtocol,documentProtocol,documentFunction } from './documents-provider.mjs'
import { seedAppointmentProtocol,appointmentProtocol } from './appointments-provider.mjs'
import { seedAvailabilityProtocol,availabilityProtocol } from './availability-provider.mjs'
import { doctorAdministrativeCapabilities } from '../../app/utils/locationContext.ts'
const sessions = new Map(); const refreshes = new Map()
export function resetDelegationProtocol() { sessions.clear(); refreshes.clear() }
const uuid = (prefix,n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const digest = value => createHash('sha256').update(Buffer.from(value,'hex')).digest('hex')
function model(state) {
  if (state.delegation!==true) return state.delegation
  state.delegation = {
    users: ['doctor-a','doctor-b','secretary','outsider'].map((name,index) => ({ id: uuid('a1',index+1),email: `synthetic-${name}@example.test`,name: `Synthetic ${name}` })),
    practices: [1,2].map(n => ({ id: uuid('a3',n),owner_user_id: uuid('a1',n),name: `Synthetic practice ${n===1 ? 'A' : 'B'}`,version: 1 })),
    locations: [1,2,3].map(n => ({ id: uuid('a4',n),practice_id: uuid('a3',n===3 ? 2 : 1),name: n===3 ? 'Clinic B1' : `Clinic A${n}`,timezone: n===2 ? 'Europe/London' : 'Africa/Cairo',version: 1,contact_phone: `Synthetic phone ${n}`,contact_address: `Synthetic address ${n}`,archived_at: null })),
    memberships: [],invitations: [],receipts: {},events: [],
  }
  return state.delegation
}
export function applyDelegationFixtureInput(state,input) {
  const data = model(state); const action = input.delegationAction
  if (action.kind==='expire') { const item = data.invitations.find(item => item.id===action.id); if (item) item.expires_at='2020-01-01T00:00:00Z' }
  if (action.kind==='status') { const item = data.memberships.find(item => item.id===action.id); if (item) { item.status=action.status; item.version++ } }
  if (action.kind==='grants') { const item = data.memberships.find(item => item.id===action.id); if (item) { item.grants=action.grants; item.version++ } }
}
export function delegationProtocol({ state,req,res,url,input,rawBytes,send,deny }) {
  if (!state.delegation) return false
  const data = model(state)
  if (state.patients) seedPatientProtocol(data)
  if (state.documents) seedDocumentProtocol(data)
  if (state.availability) seedAvailabilityProtocol(data)
  if (state.appointments) seedAppointmentProtocol(data)
  const userView = actor => ({ id: actor.id,aud: 'authenticated',role: 'authenticated',email: actor.email,email_confirmed_at: '2026-01-01T00:00:00Z',app_metadata: { provider: 'email',providers: ['email'] },user_metadata: { role: 'owner',clinical_signer: true },identities: [],created_at: '2026-01-01T00:00:00Z' })
  function issue(actor,sessionId = randomUUID()) {
    const access_token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: actor.id,role: 'authenticated',aud: 'authenticated',session_id: sessionId,exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.synthetic-signature`
    const refresh_token = `synthetic-delegation-refresh-${sessionId}`
    sessions.set(`Bearer ${access_token}`,{ actor,sessionId }); refreshes.set(refresh_token,{ actor,sessionId })
    return { access_token,token_type: 'bearer',expires_in: 3600,expires_at: Math.floor(Date.now()/1000)+3600,refresh_token,user: userView(actor) }
  }
  if (url.pathname==='/rest/v1/rpc/doctor_runtime_contract') { send({ product: state.marker,version: 1,data_mode: 'synthetic' }); return true }
  if (url.pathname==='/auth/v1/token') {
    const remembered = refreshes.get(input.refresh_token)
    const actor = data.users.find(item => item.email===input.email)
    if (url.searchParams.get('grant_type')==='password' && actor && input.password==='synthetic-password-only') send(issue(actor))
    else if (url.searchParams.get('grant_type')==='refresh_token' && remembered) send(issue(remembered.actor,remembered.sessionId))
    else deny('invalid_credentials')
    return true
  }
  const session = sessions.get(req.headers.authorization)
  if (!session) { deny(); return true }
  const actor = session.actor
  if (url.pathname==='/auth/v1/logout') { sessions.delete(req.headers.authorization); for (const [key,value] of refreshes) if (value.sessionId===session.sessionId) refreshes.delete(key); send({}); return true }
  if (url.pathname==='/auth/v1/user') { send(userView(actor)); return true }
  const ownPractice = data.practices.find(item => item.owner_user_id===actor.id)
  const memberFor = practice => data.memberships.find(item => item.practice_id===practice && item.user_id===actor.id && item.status==='active')
  const owner = practice => data.practices.some(item => item.id===practice && item.owner_user_id===actor.id)
  const capability = (practice,location,key) => owner(practice) || Boolean(memberFor(practice)?.grants.some(item => (!location || item.location_id===location) && item.capabilities.includes(key)))
  const contexts = () => data.locations.filter(item => !item.archived_at).flatMap(location => {
    const practice = data.practices.find(item => item.id===location.practice_id)
    const membership = memberFor(practice.id)
    const capabilities = owner(practice.id) ? [...doctorAdministrativeCapabilities] : membership?.grants.find(item => item.location_id===location.id)?.capabilities || []
    if (!capabilities.length) return []
    return [{ practice_id: practice.id,practice_name: practice.name,doctor_name: data.users.find(item => item.id===practice.owner_user_id).name,location_id: location.id,location_name: location.name,timezone: location.timezone,portal: owner(practice.id) ? 'doctor' : 'secretary',grants_version: owner(practice.id) ? practice.version : membership.version,location_version: location.version,capabilities }]
  })
  const rpc = url.pathname.replace('/rest/v1/rpc/','')
  if (state.documents && url.pathname==='/functions/v1/doctor-documents') { void documentFunction({ data,actor,sessionId: session.sessionId,capability,valid: () => sessions.get(req.headers.authorization)===session },req,url,rawBytes,res).catch(() => send({ error: 'unavailable' },503)); return true }
  if (state.documents && documentProtocol({ data,actor,capability },rpc,input,send)) return true
  if (state.appointments && appointmentProtocol({ data,actor,sessionId: session.sessionId,rpc,input,send,capability })) return true
  if (state.availability && availabilityProtocol({ data,actor,rpc,input,send,capability })) return true
  if (state.patients && patientProtocol({ data, actor, sessionId: session.sessionId, rpc, input, send, capability })) return true
  const reject = (code='42501') => { deny(code); return true }
  if (rpc==='doctor_session_context') { send({ product: 'doctor-suit',user_id: actor.id,session_id: session.sessionId,practice_id: ownPractice?.id || null }); return true }
  if (rpc==='doctor_contexts') { send(contexts()); return true }
  if (rpc==='doctor_resolve_context') {
    const item = contexts().find(item => item.practice_id===input.p_practice && item.location_id===input.p_location)
    if (!item) return reject()
    if (input.p_expected_version!==item.grants_version) return reject('40001')
    send(item); return true
  }
  if (rpc==='doctor_practice_setup') {
    const location = ownPractice && data.locations.find(item => item.practice_id===ownPractice.id && !item.archived_at)
    send({ enrollment: ownPractice || !data.memberships.some(item => item.user_id===actor.id) ? 'owner' : 'delegated-only',profile: ownPractice ? { display_name: actor.name,professional_verification: 'unverified' } : null,practice: ownPractice ? { id: ownPractice.id,name: ownPractice.name,version: ownPractice.version } : null,location: location || null,draft: null }); return true
  }
  if (rpc==='doctor_locations') {
    if (!capability(input.p_practice,null,'locations.read') && !capability(input.p_practice,null,'locations.manage')) return reject()
    const rows = data.locations.filter(item => item.practice_id===input.p_practice && (capability(item.practice_id,item.id,'locations.read') || capability(item.practice_id,item.id,'locations.manage')) && item.name.toLowerCase().includes((input.p_search || '').toLowerCase()))
    const size = input.p_size || 25; const start = (input.p_page || 0)*size
    send({ practice_name: data.practices.find(item => item.id===input.p_practice).name,rows: rows.slice(start,start+size).map(item => ({ ...item,can_manage: capability(item.practice_id,item.id,'locations.manage') })),total: rows.length,can_create: owner(input.p_practice) }); return true
  }
  if (rpc==='doctor_team') {
    if (!owner(input.p_practice)) return reject()
    const search = (input.p_search || '').toLowerCase(); const size = input.p_size || 20; const start = (input.p_page || 0)*size
    const members = data.memberships.filter(item => item.practice_id===input.p_practice && data.users.find(user => user.id===item.user_id).email.includes(search)).map(item => ({ id: item.id,email: data.users.find(user => user.id===item.user_id).email,status: item.status,version: item.version,created_at: item.created_at,grants: item.grants.map(grant => ({ ...grant,location_name: data.locations.find(item => item.id===grant.location_id).name,archived: false })) }))
    const invitations = data.invitations.filter(item => item.practice_id===input.p_practice && item.recipient_email.includes(search)).map(item => ({ id: item.id,recipient_email: item.recipient_email,status: item.status==='pending' && Date.parse(item.expires_at)<=Date.now() ? 'expired' : item.status,version: item.version,expires_at: item.expires_at,created_at: item.created_at,grants: item.grants }))
    const locations = data.locations.filter(item => item.practice_id===input.p_practice).map(item => ({ id: item.id,name: item.name,timezone: item.timezone,archived: Boolean(item.archived_at) }))
    send({ practice_id: input.p_practice,practice_name: data.practices.find(item => item.id===input.p_practice).name,members: members.slice(start,start+size),invitations: invitations.slice(start,start+size),locations,member_total: members.length,invitation_total: invitations.length,location_total: locations.length }); return true
  }
  function validGrants(grants,practice,empty=false) { return Array.isArray(grants) && (empty || grants.length) && grants.every(grant => data.locations.some(item => item.id===grant.location_id && item.practice_id===practice) && grant.capabilities?.length && grant.capabilities.every(key => doctorAdministrativeCapabilities.includes(key))) }
  const receipt = `${actor.id}:${input.p_key}`
  const fingerprint = JSON.stringify({ ...input,...(input.p_token ? { p_token: undefined,p_token_hash: digest(input.p_token) } : {}) })
  function replay() { const previous = data.receipts[receipt]; if (!previous) return false; if (previous.fingerprint!==fingerprint) deny('22023'); else send(previous.result); return true }
  function finish(result) { data.receipts[receipt]={ fingerprint,result }; send(result); return true }
  if (rpc==='doctor_invite_secretary') {
    if (!owner(input.p_practice)) return reject()
    if (replay()) return true
    if (!validGrants(input.p_grants,input.p_practice)) return reject('22023')
    if (data.invitations.some(item => item.practice_id===input.p_practice && item.recipient_email===input.p_email && item.status==='pending' && Date.parse(item.expires_at)>Date.now())) return reject('23505')
    const item = { id: randomUUID(),practice_id: input.p_practice,recipient_email: input.p_email,token_hash: input.p_token_hash,grants: input.p_grants,status: 'pending',version: 1,created_at: new Date().toISOString(),expires_at: new Date(Date.now()+48*3600000).toISOString() }
    data.invitations.push(item); data.events.push({ actor: actor.id,practice: item.practice_id,event: 'secretary.invited' })
    return finish({ invitation_id: item.id,expires_at: item.expires_at,version: 1 })
  }
  if (rpc==='doctor_invitation_details' || rpc==='doctor_accept_secretary_invitation') {
    const item = data.invitations.find(item => item.id===input.p_invitation)
    const member = item?.membership_id && data.memberships.find(member => member.id===item.membership_id)
    if (!item || !/^[a-f0-9]{64}$/.test(input.p_token || '') || digest(input.p_token)!==item.token_hash || item.recipient_email!==actor.email || !['pending','accepted'].includes(item.status) || (item.status==='pending' && Date.parse(item.expires_at)<=Date.now()) || (item.status==='accepted' && member?.status!=='active')) return reject()
    if (rpc==='doctor_invitation_details') { const practice = data.practices.find(practice => practice.id===item.practice_id); send({ invitation_id: item.id,practice_id: practice.id,practice_name: practice.name,doctor_name: data.users.find(user => user.id===practice.owner_user_id).name,expires_at: item.expires_at,status: item.status,grants: item.grants.map(grant => ({ ...grant,location_name: data.locations.find(location => location.id===grant.location_id).name,timezone: data.locations.find(location => location.id===grant.location_id).timezone })) }); return true }
    if (replay()) return true
    if (item.status!=='pending' || data.memberships.some(member => member.practice_id===item.practice_id && member.user_id===actor.id)) return reject()
    const membership = { id: randomUUID(),practice_id: item.practice_id,user_id: actor.id,status: 'active',version: 1,created_at: new Date().toISOString(),grants: item.grants.map(grant => ({ ...grant,capabilities: [...grant.capabilities] })) }
    data.memberships.push(membership); item.status='accepted'; item.version++; item.membership_id=membership.id
    data.events.push({ actor: actor.id,practice: item.practice_id,event: 'secretary.accepted' })
    return finish({ membership_id: membership.id })
  }
  if (['doctor_set_membership_status','doctor_set_membership_grants','doctor_cancel_secretary_invitation'].includes(rpc)) {
    if (!owner(input.p_practice)) return reject()
    if (replay()) return true
    const item = rpc==='doctor_cancel_secretary_invitation' ? data.invitations.find(item => item.id===input.p_invitation && item.practice_id===input.p_practice) : data.memberships.find(item => item.id===input.p_membership && item.practice_id===input.p_practice)
    if (!item) return reject()
    if (item.version!==input.p_version) return reject('40001')
    if (rpc==='doctor_set_membership_grants') { if (!validGrants(input.p_grants,input.p_practice,true)) return reject('22023'); item.grants=input.p_grants }
    else item.status=rpc==='doctor_cancel_secretary_invitation' ? 'cancelled' : input.p_status
    item.version++; data.events.push({ actor: actor.id,practice: input.p_practice,event: rpc })
    return finish(rpc==='doctor_cancel_secretary_invitation' ? { invitation_id: item.id,version: item.version } : { membership_id: item.id,version: item.version })
  }
  send({},404); return true
}
