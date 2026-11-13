/** Existing BFF contract with synthetic Auth only, never a hosted cancellation. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'h3') return { url: 'data:text/javascript,' + encodeURIComponent(`export const createError=x=>Object.assign(new Error(x.statusMessage),x);export const getRouterParam=e=>e.id;export const setResponseHeader=(e,k,v)=>e.headers[k]=v`), shortCircuit: true }
  if (decodeURI(context.parentURL ?? '').includes('/tasks/[id]/cancel.post.ts') && specifier.endsWith('/hqAccess')) return { url: 'data:text/javascript,' + encodeURIComponent(`export async function requireHqFounder(){if(!globalThis.__cancelBff.authorized)throw Object.assign(new Error('denied'),{statusCode:403});return{accessToken:'synthetic-founder-token'}};export async function hqRpc(config,token,name,args){globalThis.__cancelBff.calls.push({token,name,args});return{version:2}}`), shortCircuit: true }
  if (decodeURI(context.parentURL ?? '').includes('/tasks/[id]/cancel.post.ts') && specifier.endsWith('/hqAgents')) return { url: 'data:text/javascript,export const hqAgentSnapshot=value=>value', shortCircuit: true }
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context)
  return next(specifier, context)
} })
globalThis.defineEventHandler = fn => fn
globalThis.useRuntimeConfig = () => ({})
const { default: cancel } = await import('../../server/api/hq/tasks/[id]/cancel.post.ts')
test('only the fresh founder token and exact validated ID reach the existing RPC', async () => {
  const id = '20000000-0000-4000-8000-000000000001', event = id => ({ id, headers: {} })
  globalThis.__cancelBff = { authorized: false, calls: [] }
  try {
    await assert.rejects(cancel(event(id)), { statusCode: 403 }); assert.equal(globalThis.__cancelBff.calls.length, 0)
    globalThis.__cancelBff.authorized = true
    for (const invalid of [undefined, 'wrong', '../cancel']) await assert.rejects(cancel(event(invalid)), { statusCode: 400 })
    assert.equal(globalThis.__cancelBff.calls.length, 0)
    const request = event(id); await cancel(request)
    assert.equal(request.headers['Cache-Control'], 'private, no-store')
    assert.deepEqual(globalThis.__cancelBff.calls, [{ token: 'synthetic-founder-token', name: 'hq_cancel_task', args: { p_task_id: id } }])
  } finally { delete globalThis.__cancelBff }
})
