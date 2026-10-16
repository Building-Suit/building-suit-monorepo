// Disposable protocol fixture, NOT Supabase Auth acceptance. Loopback and synthetic inputs only.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
const userId = '11111111-1111-4111-8111-111111111111'
let state
const tokens = new Set()
function reset() { tokens.clear(); state = { confirmed: true, active: false, sessionId: randomUUID(), marker: 'doctor-suit', logoutFails: false, outbox: [], calls: [], pkceExchanges: 0 } }
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
    if (req.method === 'POST') { if (input.reset) reset(); else Object.assign(state, input) }
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
  if (url.pathname === '/rest/v1/rpc/doctor_session_context') { send({ product: 'doctor-suit', user_id: userId, session_id: state.sessionId, practice_id: null }); return }
  send({}, 404)
})
server.listen(4338, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
