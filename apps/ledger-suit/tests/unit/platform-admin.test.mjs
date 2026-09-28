import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { ref, shallowRef, watch } from 'vue'

const source = await readFile(new URL('../../app/composables/usePlatformAdmin.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function harness(rpc) {
  const user = ref({ id: 'operator-a' })
  const stops = []
  let dispose
  const sandbox = {
    exports: {}, ref, shallowRef,
    watch(...args) { stops.push(watch(...args)) },
    onBeforeUnmount(fn) { dispose = fn },
    useSupabaseClient: () => ({ rpc }), useSupabaseUser: () => user,
    useI18n: () => ({ t: key => key }),
  }
  vm.runInNewContext(compiled, sandbox)
  const admin = sandbox.exports.usePlatformAdmin()
  return { admin, user, stop() { dispose(); stops.forEach(stop => stop()) } }
}
const identity = { data: { ok: true, data: [{ role: 'billing_operator' }] }, error: null }

test('operator state and late global responses are discarded on account switch', async () => {
  let resolveRows
  const h = harness(async (_name, args) => args.p_resource === 'identity' ? identity : new Promise(resolve => { resolveRows = resolve }))
  const loading = h.admin.load('users')
  await new Promise(setImmediate)
  assert.equal(typeof resolveRows, 'function')
  h.user.value = { id: 'tenant-b' }
  resolveRows({ data: { ok: true, data: [{ id: 'sensitive-user', email: 'private@example.test' }] }, error: null })
  await loading
  assert.equal(h.admin.rows.value.length, 0)
  assert.equal(h.admin.role.value, null)
  assert.equal(h.admin.pending.value, false)
  h.stop()
})

test('revocation clears existing global rows and fails closed', async () => {
  let denied = false
  const h = harness(async (_name, args) => denied ? { data: { ok: false, error: 'OPERATOR_REQUIRED' }, error: null }
    : args.p_resource === 'identity' ? identity : { data: { ok: true, data: [{ id: 'private-row' }] }, error: null })
  await h.admin.load('users')
  assert.equal(h.admin.rows.value.length, 1)
  denied = true
  await h.admin.load('users')
  assert.equal(h.admin.rows.value.length, 0)
  assert.equal(h.admin.role.value, null)
  assert.equal(h.admin.denied.value, true)
  h.stop()
})

test('command rejection envelope is a failure, never a success notification', async () => {
  const h = harness(async () => ({ data: { ok: false, error: 'MANUAL_PAYMENT_STALE_EVIDENCE' }, error: null }))
  assert.equal(await h.admin.review({ id: 'command', requestId: 'payment', evidenceId: 'stale', action: 'approved', reason: 'Verified', context: 'Case' }), undefined)
  assert.equal(h.admin.error.value, 'admin.failed')
  h.stop()
})

test('unmounted operator state cannot be repopulated by a late request', async () => {
  let resolveIdentity
  const h = harness(() => new Promise(resolve => { resolveIdentity = resolve }))
  const loading = h.admin.load('users')
  h.stop()
  // The second request also resolves, but its data must not be applied.
  const first = resolveIdentity
  first(identity)
  await new Promise(setImmediate)
  resolveIdentity({ data: { ok: true, data: [{ id: 'secret' }] }, error: null })
  await loading
  assert.equal(h.admin.rows.value.length, 0)
  assert.equal(h.admin.role.value, null)
})

test('search, filter, pagination and membership scope stay inside the audited read contract', async () => {
  const calls = []
  const h = harness(async (name, args) => {
    calls.push({ name, args })
    return args.p_resource === 'identity' ? identity : { data: { ok: true, data: [] }, error: null }
  })
  await h.admin.load('memberships', { offset: 50, search: ' Alpha ', status: 'active', targetId: 'organization-id' })
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), {
    name: 'platform_admin_read',
    args: { p_resource: 'memberships', p_offset: 50, p_limit: 50, p_search: 'Alpha', p_status: 'active', p_target_id: 'organization-id' },
  })
  h.stop()
})

test('bounded admin commands use only their dedicated RPCs and reasoned payloads', async () => {
  const calls = []
  const h = harness(async (name, args) => {
    calls.push({ name, args })
    return { data: { ok: true, data: { id: args.p_organization_id ?? args.p_request_id } }, error: null }
  })
  const base = { id: 'command-id', targetId: 'target-id', reason: 'Approved reason', context: 'Case 42' }
  assert.equal(await h.admin.setAccess({ ...base, action: 'suspend' }), true)
  assert.equal(await h.admin.correctSubscription({ ...base, targetPlanKey: 'starter' }), true)
  assert.equal(await h.admin.updateSupport({ ...base, action: 'close' }), true)
  assert.deepEqual(calls.map(call => call.name), [
    'platform_admin_set_access', 'platform_admin_correct_subscription', 'platform_admin_update_support',
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)), {
    p_command_id: 'command-id', p_organization_id: 'target-id', p_action: 'suspend', p_reason: 'Approved reason', p_context: 'Case 42',
  })
  h.stop()
})
