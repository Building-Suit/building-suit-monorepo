/** Generated transport projections; no Auth provider, DB, model or Drive. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { parseHqStaffingSnapshot } from '../../shared/types/staffing.ts'

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'h3') return { url: 'data:text/javascript,' + encodeURIComponent(`export const createError=x=>Object.assign(new Error(x.statusMessage),x);export const getHeader=(e,k)=>e.node.req.headers[k];export const setResponseHeader=(e,k,v)=>e.node.res.setHeader(k,v)`), shortCircuit: true }
  if (context.parentURL?.includes('/server/api/hq/staffing.') && specifier === '../../utils/hqAccess') return {
    url: 'data:text/javascript,' + encodeURIComponent(`export async function requireHqFounder(){if(!globalThis.__staffingFixture.authorized)throw Object.assign(new Error('denied'),{statusCode:403});return{accessToken:'synthetic-token'}};export async function hqRpc(c,t,name,args){globalThis.__staffingFixture.calls.push({name,args});return globalThis.__staffingFixture.snapshot}`), shortCircuit: true,
  }
  if (specifier === '#shared/types/staffing') return next(new URL('../../shared/types/staffing.ts', import.meta.url).href, context)
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return next(specifier + '.ts', context)
  return next(specifier, context)
} })
globalThis.defineEventHandler = fn => fn
globalThis.useRuntimeConfig = () => ({})
const { default: post } = await import('../../server/api/hq/staffing.post.ts')
const { default: get } = await import('../../server/api/hq/staffing.get.ts')
function event(body, headers = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.headers = { 'content-type': 'application/json', ...headers }
  return { node: { req, res: { setHeader() {} } } }
}
test('staffing BFF authenticates before dispatch, bounds exact decisions and strips unexpected private fields', async () => {
  const fixture = globalThis.__staffingFixture = { authorized: false, calls: [], snapshot: { version: 1, canonicalWriter: 'unavailable', workflows: [], privateWorker: 'must-not-cross-bff' } }
  const command = { planId: randomUUID(), digest: 'a'.repeat(64), decision: 'approved', resumeOriginal: true, requestKey: randomUUID() }
  await assert.rejects(() => post(event(command)), error => error.statusCode === 403)
  await assert.rejects(() => get(event(null)), error => error.statusCode === 403)
  assert.deepEqual(fixture.calls, [])
  fixture.authorized = true
  assert.deepEqual(await post(event(command)), { version: 1, canonicalWriter: 'unavailable', totalCount: 0, workflows: [] })
  assert.deepEqual(fixture.calls[0], { name: 'hq_decide_staffing_plan', args: { p_plan_id: command.planId, p_digest: command.digest,
    p_decision: command.decision, p_resume_original: true, p_request_key: command.requestKey } })
  for (const body of [{ ...command, tools: ['shell'] }, { ...command, decision: 'active' }, { ...command, decision: 'rejected' },
    { ...command, digest: 'invalid' }, { ...command, resumeOriginal: 'true' }, { ...command, requestKey: null }]) {
    await assert.rejects(() => post(event(body)), error => error.statusCode === 400)
  }
  await assert.rejects(() => post(event(command, { 'content-length': '99999' })), error => error.statusCode === 400)
  await assert.rejects(() => post(event(command, { 'content-encoding': 'gzip' })), error => error.statusCode === 400)
  assert.equal(fixture.calls.length, 1)
  await get(event(null)); assert.equal(fixture.calls[1].name, 'hq_staffing_snapshot')
  fixture.snapshot = { version: 1, canonicalWriter: 'configured', workflows: [] }
  await assert.rejects(() => get(event(null)), error => error.statusCode === 503)
  assert.equal(parseHqStaffingSnapshot({ version: 1, canonicalWriter: 'unavailable', workflows: [], totalCount: -1 }), null)
  delete globalThis.__staffingFixture
})
