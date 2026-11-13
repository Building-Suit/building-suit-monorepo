import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

const moduleUrl = source => 'data:text/javascript,' + encodeURIComponent(source)
registerHooks({ resolve(specifier, context, next) {
  if (!context.parentURL?.endsWith('/server/api/hq/shop-suit-staff.get.ts')) return next(specifier, context)
  if (specifier === 'h3') return { shortCircuit: true, url: moduleUrl(`
    export const createError = details => Object.assign(new Error(details.statusMessage), details)
    export const getQuery = event => event.query
    export const setResponseHeader = (event, name, value) => event.headers[name] = value
  `) }
  if (specifier === '#shared/shopSuitStaff') return next(new URL('../../shared/shopSuitStaff.ts', import.meta.url).href, context)
  if (specifier === '../../utils/hqAccess') return { shortCircuit: true, url: moduleUrl(`
    export async function requireHqFounder(event) {
      if (!event.founder) throw Object.assign(new Error('Founder required'), { statusCode: 403 })
      return { accessToken: 'fixture-founder-token' }
    }
    export async function hqRpc(config, token, name, body) {
      config.calls.push({ token, name, body })
      return config.response
    }
  `) }
  return next(specifier, context)
} })

const config = { calls: [], response: null }
globalThis.useRuntimeConfig = () => config
globalThis.defineEventHandler = handler => handler
const { default: getStaff } = await import('../../server/api/hq/shop-suit-staff.get.ts')

test('the office staff endpoint uses the founder HQ token and returns only staff metadata', async () => {
  const event = { headers: {}, query: {}, founder: false }
  await assert.rejects(() => getStaff(event), { statusCode: 403 })
  assert.deepEqual(config.calls, [])
  event.founder = true
  event.query = { after: 'arbitrary' }
  await assert.rejects(() => getStaff(event), { statusCode: 400 })
  assert.deepEqual(config.calls, [])

  event.query = { after: '00000000-0000-4000-8000-000000000001' }
  const employee = { employeeId: '00000000-0000-4000-8000-000000000002', shopName: 'Shop', state: 'busy' }
  const observedAt = '2026-11-13T00:00:00+00:00'
  config.response = { status: 'ready', staff: [{ ...employee, privateValue: 'ignored' }], next: null, observedAt }
  assert.deepEqual(await getStaff(event), { status: 'ready', staff: [employee], next: null, observedAt })
  assert.deepEqual(config.calls[0], { token: 'fixture-founder-token', name: 'hq_shop_suit_staff', body: { p_after: event.query.after, p_limit: 100 } })
  assert.equal(event.headers['Cache-Control'], 'private, no-store')

  config.response = { status: 'overflow', staff: [], next: null, observedAt }
  assert.deepEqual(await getStaff(event), config.response)
  config.response = { status: 'ready', staff: [employee], next: employee.employeeId, observedAt }
  await assert.rejects(() => getStaff(event), { statusCode: 503 })
})
