import { createServer } from 'node:http'

const port = Number(process.env.PORT || 64321)
const user = { id: '00000000-0000-4000-8000-000000000101', email: 'owner@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { display_name: 'OTP owner', pending_shop: { name: 'OTP shop', business_mode: 'mixed' } }, identities: [{ id: 'identity-1' }] }
const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', email: user.email })).toString('base64url')}.test`
const state = { signupCalls: 0, resendCalls: 0, verifyCalls: 0, createCalls: 0, created: false, failFirstCreate: true, signupPayload: null, createPayload: null, shopName: null, locations: [] }

const plan = { id: 'plan-team', name: 'Team', slug: 'team', price_amount: 699, currency: 'EGP', billing_interval: 'monthly', trial_days: 14, features: {}, resource_limits: {}, is_purchasable: true, is_coming_soon: false }

function send(response, status, value, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', ...headers })
  response.end(JSON.stringify(value))
}

async function body(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { return {} }
}

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { send(response, 200, {}); return }
  const url = new URL(request.url, `http://127.0.0.1:${port}`)
  if (url.pathname === '/__state') { send(response, 200, state); return }
  if (url.pathname === '/__reset') { Object.assign(state, { signupCalls: 0, resendCalls: 0, verifyCalls: 0, createCalls: 0, created: false, failFirstCreate: true, signupPayload: null, createPayload: null, shopName: null, locations: [] }); send(response, 200, state); return }

  if (url.pathname === '/auth/v1/signup') {
    state.signupCalls += 1
    const input = await body(request)
    state.signupPayload = input
    if (String(input.email).startsWith('existing')) { send(response, 422, { code: 'user_already_exists', message: 'User already registered' }); return }
    send(response, 200, { user: { ...user, email: input.email }, session: null })
    return
  }
  if (url.pathname === '/auth/v1/resend') { state.resendCalls += 1; send(response, 200, {}); return }
  if (url.pathname === '/auth/v1/verify') {
    state.verifyCalls += 1
    const input = await body(request)
    if (input.token !== '654321') { send(response, 403, { code: 'otp_expired', message: 'Token has expired or is invalid' }); return }
    send(response, 200, { access_token: jwt, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user })
    return
  }
  if (url.pathname === '/auth/v1/user') {
    if (!request.headers.authorization?.startsWith('Bearer ')) { send(response, 401, { message: 'missing session' }); return }
    send(response, 200, user)
    return
  }
  if (url.pathname === '/auth/v1/token') { send(response, 200, { access_token: jwt, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user }); return }

  if (url.pathname.endsWith('/rpc/shop_public_plan_catalog')) { send(response, 200, [plan]); return }
  if (url.pathname.endsWith('/rpc/create_owner_shop')) {
    state.createPayload = await body(request)
    if (!state.created) {
      state.created = true; state.createCalls += 1
      state.shopName = state.createPayload.p_shop_name
      state.locations = [{
        id: 'location-1', shop_id: 'shop-1', name: state.createPayload.p_main_location_name,
        code: state.createPayload.p_main_location_code, address: state.createPayload.p_main_location_address,
        phone: state.createPayload.p_main_location_phone, status: 'active', is_default: true, archived_at: null,
      }]
    }
    if (state.failFirstCreate) { state.failFirstCreate = false; send(response, 500, { code: 'fixture_retry', message: 'Synthetic response loss after commit' }); return }
    send(response, 200, 'shop-1')
    return
  }
  if (url.pathname.endsWith('/rpc/list_shop_locations')) { send(response, 200, state.locations); return }
  if (url.pathname.endsWith('/rpc/shop_permission_access')) { send(response, 200, { 'settings.manage': true }); return }
  if (url.pathname.endsWith('/rpc/save_shop_profile')) {
    const input = await body(request); state.shopName = input.p_display_name
    send(response, 200, state.shopName); return
  }
  if (url.pathname.endsWith('/rpc/shop_plan_usage')) {
    const used = state.locations.filter(location => location.status === 'active').length
    send(response, 200, { resources: [{ resource: 'active_locations', used, limit: 2, remaining: Math.max(0, 2 - used), unlimited: false, atLimit: used >= 2, overLimit: used > 2 }] }); return
  }
  if (url.pathname.endsWith('/rpc/receipt_settings')) { send(response, 200, { displayName: state.shopName || 'OTP shop', address: null, phone: null, footer: null, paperSize: 'thermal_80', canManage: true }); return }
  if (url.pathname.endsWith('/rpc/save_shop_location')) {
    const input = await body(request)
    if (input.p_location_id) {
      const location = state.locations.find(item => item.id === input.p_location_id)
      if (location) Object.assign(location, { name: input.p_name, code: input.p_code, address: input.p_address, phone: input.p_phone })
    } else state.locations.push({ id: `location-${state.locations.length + 1}`, shop_id: 'shop-1', name: input.p_name, code: input.p_code, address: input.p_address, phone: input.p_phone, status: 'active', is_default: false, archived_at: null })
    send(response, 200, input.p_location_id || state.locations.at(-1).id); return
  }
  if (url.pathname.endsWith('/rpc/archive_shop_location')) {
    const input = await body(request); const location = state.locations.find(item => item.id === input.p_location_id)
    if (location) { location.status = 'archived'; location.archived_at = new Date().toISOString() }
    send(response, 200, null); return
  }
  if (url.pathname.endsWith('/rpc/restore_shop_location')) {
    const input = await body(request); const location = state.locations.find(item => item.id === input.p_location_id)
    if (location) { location.status = 'active'; location.archived_at = null }
    send(response, 200, null); return
  }
  if (url.pathname.endsWith('/portals')) { send(response, 200, { id: 'portal-1' }); return }
  if (url.pathname.endsWith('/profiles')) { send(response, 200, { id: 'profile-1', display_name: 'OTP owner', email_snapshot: user.email, status: 'active' }); return }
  if (url.pathname.endsWith('/shop_memberships')) { send(response, 200, state.created ? [{ id: 'membership-1', shop_id: 'shop-1', profile_id: 'profile-1', role: 'owner', status: 'active' }] : []); return }
  if (url.pathname.endsWith('/shops')) { send(response, 200, state.created ? [{ id: 'shop-1', name: state.shopName, business_mode: state.createPayload?.p_business_mode || 'mixed', status: 'active', created_at: '2026-09-30T10:00:00Z' }] : []); return }
  send(response, 200, [])
}).listen(port, '127.0.0.1', () => process.stdout.write(`auth otp fixture listening on ${port}\n`))
