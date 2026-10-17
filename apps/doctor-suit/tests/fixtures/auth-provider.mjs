// Disposable protocol fixture, NOT Supabase Auth acceptance. Loopback and synthetic inputs only.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { delegationProtocol, resetDelegationProtocol, applyDelegationFixtureInput } from './delegation-provider.mjs'
const userId = '11111111-1111-4111-8111-111111111111'
let state
const tokens = new Set()
function reset() { resetDelegationProtocol(); tokens.clear(); state = { confirmed: true, active: false, sessionId: randomUUID(), marker: 'doctor-suit', logoutFails: false, outbox: [], calls: [], pkceExchanges: 0, enrollment: 'owner', profile: null, practice: null, location: null, locations: [], locationCommands: {}, draft: null, completeCalls: 0, profileCalls: 0 } }
reset()
const user = () => ({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.test', email_confirmed_at: state.confirmed ? '2026-01-01T00:00:00Z' : null, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { role: 'owner', verified: true }, identities: [], created_at: '2026-01-01T00:00:00Z' })
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', session_id: state.sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.synthetic-signature`
const session = () => {
  const access_token = token()
  tokens.add(`Bearer ${access_token}`)
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'synthetic-refresh-token', user: user() }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4337')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-doctor-document')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') { res.end(); return }
  const url = new URL(req.url, 'http://127.0.0.1:4338')
  if (url.pathname==='/functions/v1/doctor-documents') {
    const chunks = []; let size = 0
    for await (const chunk of req) { size+=chunk.length; if (size>5242880) { res.writeHead(413).end('{}'); return }; chunks.push(chunk) }
    const send = (value,status = 200) => res.writeHead(status).end(JSON.stringify(value))
    if (!delegationProtocol({ state,req,res,url,input: {},rawBytes: Buffer.concat(chunks),send,deny: () => send({ error: 'session' },401) })) send({ error: 'unavailable' },503)
    return
  }
  let body = ''
  for await (const chunk of req) { body += chunk; if (body.length > (state.availability && url.pathname==='/rest/v1/rpc/doctor_write_schedule' ? 32768 : 16384)) { res.writeHead(413).end('{}'); return } }
  let input
  try { input = body ? JSON.parse(body) : {} } catch { res.writeHead(400).end('{}'); return }
  const send = (value, status = 200) => { res.writeHead(status).end(JSON.stringify(value)) }
  const deny = (code = 'session_not_found') => send({ code, error_code: code, msg: 'Synthetic request rejected' }, 400)
  if (url.pathname === '/__fixture') {
    if (req.method === 'POST') {
      if (input.reset) reset()
      else if (input.delegationAction) applyDelegationFixtureInput(state,input)
      else if (input.bumpProfile && state.practice) state.practice.version++
      else Object.assign(state, input)
    }
    send({ ...state, calls: [...state.calls] }); return
  }
  // Never retain credential bodies or verification material in fixture telemetry.
  state.calls.push(`${req.method} ${url.pathname}`)
  if (delegationProtocol({ state, req, url, input, send, deny })) return
  if (input.email && input.email !== 'synthetic@example.test') { deny('invalid_credentials'); return }
  if (url.pathname === '/rest/v1/rpc/doctor_runtime_contract') { send({ product: state.marker, version: 1, data_mode: 'synthetic' }); return }
  if (url.pathname === '/auth/v1/signup') { state.confirmed = false; state.active = false; state.outbox.push('signup'); send({ user: user(), session: null }); return }
  if (url.pathname === '/auth/v1/verify') {
    if (input.token !== '123456') { deny('otp_expired'); return }
    state.confirmed = true; state.active = true; send(session()); return
  }
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'pkce') {
      state.pkceExchanges++
      if (input.auth_code !== 'synthetic-recovery-code' || !input.code_verifier) { deny('flow_state_expired'); return }
    } else if (url.searchParams.get('grant_type') === 'password' && (!state.confirmed || input.password !== 'synthetic-password-only')) { deny('invalid_credentials'); return }
    else if (url.searchParams.get('grant_type') === 'refresh_token' && !state.active) { deny(); return }
    state.active = true; send(session()); return
  }
  if (url.pathname === '/auth/v1/resend' || url.pathname === '/auth/v1/recover') {
    state.outbox.push(url.pathname.endsWith('resend') ? 'signup' : 'recovery')
    state.flowId = new URL(url.searchParams.get('redirect_to') || 'http://127.0.0.1:4337').searchParams.get('sb_flow_id')
    state.pkceChallengeProvided = typeof input.code_challenge === 'string' && input.code_challenge.length >= 43
    send({}); return
  }
  if (url.pathname === '/auth/v1/logout') {
    if (state.logoutFails) { send({ code: 'unexpected_failure', msg: 'Synthetic failure' }, 500); return }
    state.active = false; send({}); return
  }
  if (!state.active || !tokens.has(req.headers.authorization)) { deny(); return }
  if (url.pathname === '/auth/v1/user') { send(user()); return }
  if (url.pathname === '/rest/v1/rpc/doctor_session_context') { send({ product: 'doctor-suit', user_id: userId, session_id: state.sessionId, practice_id: state.practice?.id || null }); return }
  const locationContext = item => ({ practice_id: state.practice.id, practice_name: state.practice.name, doctor_name: state.profile.display_name, location_id: item.id, location_name: item.name, timezone: item.timezone, portal: 'doctor', grants_version: state.practice.version, location_version: item.version, capabilities: ['locations.read', 'locations.manage', 'patients.read','dashboard.read','appointments.read'] })
  if (url.pathname === '/rest/v1/rpc/doctor_contexts') { send(state.practice ? state.locations.filter(item => !item.archived_at).map(locationContext) : []); return }
  if (url.pathname === '/rest/v1/rpc/doctor_resolve_context') {
    const item = state.locations.find(item => !item.archived_at && item.id === input.p_location && item.practice_id === input.p_practice)
    if (!item) { deny('42501'); return }
    if (input.p_expected_version !== state.practice.version) { deny('40001'); return }
    send(locationContext(item)); return
  }
  if(url.pathname==='/rest/v1/rpc/doctor_appointment_board') {
    const item = state.locations.find(item => !item.archived_at && item.id===input.p_location && item.practice_id===input.p_practice)
    if(!item || !state.practice) { deny('42501');return }
    send({ practice_id: item.practice_id,location_id: item.id,date: input.p_day,timezone: item.timezone,location_version: item.version,items: [],queue: [],page: input.p_page || 0,queue_page: input.p_queue_page || 0,total: 0,queue_total: 0,revision: 0,can_write: false,can_queue: false,can_read_patients: true,external_notifications: 'disabled' });return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_locations') {
    if (!state.practice || input.p_practice !== state.practice.id) { deny('42501'); return }
    const matching = state.locations.filter(item => item.name.toLowerCase().includes((input.p_search || '').toLowerCase()))
    const start = (input.p_page || 0) * (input.p_size || 25)
    send({ practice_name: state.practice.name, rows: matching.slice(start, start + (input.p_size || 25)).map(item => ({ ...item, can_manage: true })), total: matching.length, can_create: true }); return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_write_location') {
    if (!state.practice || input.p_practice !== state.practice.id) { deny('42501'); return }
    if (state.locationCommands[input.p_key]) { send(state.locationCommands[input.p_key]); return }
    let item = input.p_location ? state.locations.find(item => item.id === input.p_location) : null
    if (input.p_location && (!item || item.version !== input.p_expected_version || item.archived_at)) { deny('40001'); return }
    if (!item) {
      item = { id: `75000000-0000-0000-0000-${String(state.locations.length + 1).padStart(12, '0')}`, practice_id: state.practice.id, version: 0, archived_at: null }
      state.locations.push(item)
    }
    Object.assign(item, { name: input.p_name, timezone: input.p_timezone, contact_phone: input.p_phone, contact_address: input.p_address, version: item.version + 1 })
    const result = { location_id: item.id, version: item.version }
    state.locationCommands[input.p_key] = result; send(result); return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_archive_location') {
    if (!state.practice || input.p_practice !== state.practice.id) { deny('42501'); return }
    if (state.locationCommands[input.p_key]) { send(state.locationCommands[input.p_key]); return }
    const item = state.locations.find(item => item.id === input.p_location)
    if (!item || item.version !== input.p_expected_version) { deny('40001'); return }
    item.archived_at = '2026-10-16T00:00:00Z'; item.version++
    const result = { location_id: item.id, version: item.version }
    state.locationCommands[input.p_key] = result; send(result); return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_practice_setup') {
    send({ enrollment: state.enrollment, profile: state.profile, practice: state.practice, location: state.locations.find(item => !item.archived_at) || null, draft: state.draft }); return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_save_onboarding_draft') {
    if (state.enrollment !== 'owner') { deny('42501'); return }
    if (state.practice) { deny('23505'); return }
    const values = { command_key: input.p_key, display_name: input.p_display_name, practice_name: input.p_practice_name, location_name: input.p_location_name, timezone: input.p_timezone }
    const unchanged = state.draft && Object.entries(values).every(([name, value]) => state.draft[name] === value)
    if (!unchanged && state.draft && (state.draft.command_key !== input.p_key || state.draft.version !== input.p_expected_version)) { deny('40001'); return }
    state.draft = { ...values, version: unchanged ? state.draft.version : (state.draft?.version || 0) + 1 }
    send(state.draft); return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_complete_onboarding') {
    if (state.enrollment !== 'owner') { deny('42501'); return }
    if (state.completedKey === input.p_key) { send({ practice_id: state.practice.id, location_id: state.location.id, version: 1 }); return }
    if (!state.draft || state.draft.command_key !== input.p_key || state.draft.version !== input.p_draft_version) { deny('40001'); return }
    if (state.completeDelayMs) await new Promise(resolve => setTimeout(resolve, state.completeDelayMs))
    state.completeCalls++
    state.profile = { display_name: state.draft.display_name, professional_verification: 'unverified' }
    state.practice = { id: '73000000-0000-0000-0000-000000000001', name: state.draft.practice_name, version: 1 }
    state.location = { id: '75000000-0000-0000-0000-000000000001', name: state.draft.location_name, timezone: state.draft.timezone, version: 1 }
    state.locations = [{ ...state.location, practice_id: state.practice.id, contact_phone: '', contact_address: '', archived_at: null }]; state.locationCommands = {}; state.completedKey = input.p_key; state.draft = null
    send({ practice_id: state.practice.id, location_id: state.location.id, version: 1 }); return
  }
  if (url.pathname === '/rest/v1/rpc/doctor_update_practice_profile') {
    if (state.enrollment !== 'owner' || !state.practice || input.p_practice !== state.practice.id) { deny('42501'); return }
    if (input.p_expected_version !== state.practice.version) { deny('40001'); return }
    state.profileCalls++
    state.profile.display_name = input.p_display_name; state.practice.name = input.p_practice_name; state.practice.version++
    send({ practice_id: state.practice.id, version: state.practice.version }); return
  }
  send({}, 404)
})
server.listen(4338, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
