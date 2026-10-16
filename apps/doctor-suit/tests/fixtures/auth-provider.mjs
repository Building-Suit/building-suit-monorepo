// Disposable protocol fixture, NOT Supabase Auth acceptance. Loopback and synthetic inputs only.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
const userId = '11111111-1111-4111-8111-111111111111'
let state
const tokens = new Set()
function reset() { tokens.clear(); state = { confirmed: true, active: false, sessionId: randomUUID(), marker: 'doctor-suit', logoutFails: false, outbox: [], calls: [], pkceExchanges: 0, enrollment: 'owner', profile: null, practice: null, location: null, draft: null, completeCalls: 0, profileCalls: 0 } }
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
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') { res.end(); return }
  let body = ''
  for await (const chunk of req) { body += chunk; if (body.length > 16384) { res.writeHead(413).end('{}'); return } }
  let input
  try { input = body ? JSON.parse(body) : {} } catch { res.writeHead(400).end('{}'); return }
  const url = new URL(req.url, 'http://127.0.0.1:4338')
  const send = (value, status = 200) => { res.writeHead(status).end(JSON.stringify(value)) }
  const deny = (code = 'session_not_found') => send({ code, error_code: code, msg: 'Synthetic request rejected' }, 400)
  if (url.pathname === '/__fixture') {
    if (req.method === 'POST') {
      if (input.reset) reset()
      else if (input.bumpProfile && state.practice) state.practice.version++
      else Object.assign(state, input)
    }
    send({ ...state, calls: [...state.calls] }); return
  }
  // Never retain credential bodies or verification material in fixture telemetry.
  state.calls.push(`${req.method} ${url.pathname}`)
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
  if (url.pathname === '/rest/v1/rpc/doctor_practice_setup') {
    send({ enrollment: state.enrollment, profile: state.profile, practice: state.practice, location: state.location, draft: state.draft }); return
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
    state.completedKey = input.p_key; state.draft = null
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
