import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as vue from 'vue'
import ts from 'typescript'
const require = createRequire(import.meta.url)
test('manual requests reload after workspace changes and ignore an obsolete workspace response', async () => {
  const organization = vue.ref('workspace-old'), user = vue.ref({ id: 'owner' })
  let releaseOld, delayOld = false
  const request = id => ({ id, organization_id: organization.value, status: 'draft' })
  const client = { from(table) {
    let filters = {}, single = false
    const query = {
      select() { return query }, eq(key, value) { filters[key] = value; return query }, order() { return query }, limit() { return query }, single() { single = true; return query },
      async then(resolve, reject) {
        try {
          if (table !== 'manual_payment_requests') return resolve({ data: [], error: null })
          if (single) return resolve({ data: request(filters.id), error: null })
          if (filters.organization_id === 'workspace-old' && delayOld) await new Promise(done => { releaseOld = done })
          return resolve({ data: [request(filters.organization_id + '-request')], error: null })
        } catch (error) { return reject(error) }
      },
    }
    return query
  } }
  const source = readFileSync(new URL('../../app/composables/useManualPayment.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const globals = { ref: vue.ref, watch: vue.watch, onBeforeUnmount: vue.onScopeDispose, useSupabaseClient: () => client, useTenant: () => ({ currentId: organization, can: () => true }), useSupabaseUser: () => user, useErrorMessage: () => String, useI18n: () => ({ t: key => key }) }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name === '@building-suit/ux' ? { downloadBlob() {} } : require(name), module, module.exports, ...Object.values(globals))
  const scope = vue.effectScope()
  const controller = scope.run(() => module.exports.useManualPayment())
  await controller.load()
  assert.equal(controller.selected.value.id, 'workspace-old-request')
  delayOld = true
  const obsolete = controller.load()
  await Promise.resolve()
  organization.value = 'workspace-new'
  await vue.nextTick()
  await controller.load()
  assert.equal(controller.selected.value.id, 'workspace-new-request')
  releaseOld()
  await obsolete
  assert.equal(controller.selected.value.id, 'workspace-new-request')
  assert.equal(controller.pending.value, false)
  scope.stop()
})

test('unconfigured new quotes clear selected beneficiary instructions while retaining historical requests', async () => {
  const approved = { id: 'historical-approved', organization_id: 'workspace', status: 'approved', instructions: 'Historical recipient; not a new quote' }
  const client = {
    from(table) {
      let single = false
      const query = { select() { return query }, eq() { return query }, order() { return query }, limit() { return query }, single() { single = true; return query },
        then(resolve) { return Promise.resolve(resolve({ data: table === 'manual_payment_requests' ? single ? approved : [approved] : [], error: null })) },
      }
      return query
    },
    async rpc(name) { assert.equal(name, 'prepare_manual_payment'); return { data: null, error: { message: 'MANUAL_PAYMENT_NOT_CONFIGURED' } } },
  }
  const source = readFileSync(new URL('../../app/composables/useManualPayment.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const globals = { ref: vue.ref, watch: vue.watch, onBeforeUnmount: vue.onScopeDispose, useSupabaseClient: () => client, useTenant: () => ({ currentId: vue.ref('workspace'), can: () => true }), useSupabaseUser: () => vue.ref({ id: 'owner' }), useErrorMessage: () => error => error.message, useI18n: () => ({ t: key => key }) }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name === '@building-suit/ux' ? { downloadBlob() {} } : require(name), module, module.exports, ...Object.values(globals))
  const scope = vue.effectScope()
  try {
    const controller = scope.run(() => module.exports.useManualPayment())
    await controller.load()
    assert.equal(controller.selected.value.instructions, approved.instructions)
    await controller.load('solo', 'yearly', 'new-quote')
    assert.equal(controller.error.value, 'billing.manual.notConfigured')
    assert.equal(controller.selected.value, null)
    assert.deepEqual(controller.evidence.value, [])
    assert.deepEqual(controller.history.value, [])
    assert.equal(controller.requests.value[0].id, approved.id, 'Historical paid records remain available without becoming the new transfer instructions')
  } finally { scope.stop() }
})
