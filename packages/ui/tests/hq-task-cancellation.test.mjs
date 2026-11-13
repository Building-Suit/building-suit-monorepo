/** Actual SFC setup/reactivity; browser CI separately verifies native focus. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import ts from 'typescript'

const { descriptor } = parse(readFileSync(new URL('../src/organisms/BsHqWorkforce.vue', import.meta.url), 'utf8'))
const code = ts.transpileModule(compileScript(descriptor, { id: 'hq-task-cancellation' }).content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const flush = async () => { for (let n = 0; n < 10; n++) await vue.nextTick() }
async function fixture(t) {
  const task = { id: 'generated-task', title: 'Generated task', canCancel: true, state: 'active', createdAt: '2026-11-08T00:00:00Z' }
  const props = vue.reactive({ selectedTaskId: task.id, section: 'tasks', presentation: { status: 'connected', taskBrowserRevision: 1, tasks: [task], taskCancellationPending: false }, content: { cancellation: { title: 'Cancel?', message: 'Preserve evidence', action: 'Cancel task', keep: 'Keep task' } } })
  const confirmation = deferred(), response = deferred(), disposers = [], scope = vue.effectScope()
  const calls = { detail: 0, cancel: 0, ask: 0 }
  const source = { detail: async () => { calls.detail++; return task }, cancel: async () => { calls.cancel++; props.presentation = { ...props.presentation, taskCancellationPending: true }; await response.promise; props.presentation = { ...props.presentation, taskCancellationPending: false }; return 'unconfirmed' } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'useConfirmation', code)(name => name === 'vue' ? { ...vue, onBeforeUnmount: callback => disposers.push(callback) } : name === '../utils/hqTaskBrowserSource' ? { useHqTaskBrowserSource: () => source } : {}, module, module.exports, () => ({ ask: () => { calls.ask++; return confirmation.promise } }))
  const state = scope.run(() => module.exports.default.setup(props, { expose() {}, emit() {} }))
  t.after(() => { disposers.forEach(dispose => dispose()); scope.stop() })
  await flush()
  return { props, state, calls, confirmation, response, source }
}
test('pending and unrelated projection replacements preserve the selected cancellation result without detail refetch', async t => {
  const f = await fixture(t), action = f.state.cancelSelected(); f.confirmation.resolve(true); await flush()
  assert.equal(f.calls.cancel, 1); assert.equal(f.calls.detail, 1)
  f.props.presentation = { ...f.props.presentation, refreshing: true }; await flush()
  f.response.resolve(); await action; await flush()
  assert.equal(f.state.cancellationFeedback.value, 'unconfirmed'); assert.equal(f.calls.detail, 1)
  f.props.presentation = { ...f.props.presentation, refreshing: false }; await flush()
  assert.equal(f.state.cancellationFeedback.value, 'unconfirmed')
})
test('confirmation guard suppresses duplicate opens without disabling its focus return target', async t => {
  const f = await fixture(t), action = f.state.cancelSelected(); await f.state.cancelSelected()
  assert.equal(f.calls.ask, 1); f.confirmation.resolve(false); await action
  assert.equal(f.calls.cancel, 0); assert.equal(f.state.cancelConfirming.value, false)
  assert.match(descriptor.template.content, /:disabled="presentation\.taskCancellationPending" @click="cancelSelected"/)
})
for (const change of ['selection', 'access']) test(`${change} change invalidates pending confirmation`, async t => {
  const f = await fixture(t), action = f.state.cancelSelected()
  if (change === 'selection') f.props.selectedTaskId = 'new-task'
  else f.props.presentation = { ...f.props.presentation, status: 'unavailable' }
  f.confirmation.resolve(true); await action; await flush()
  assert.equal(f.calls.cancel, 0); assert.equal(f.state.cancellationFeedback.value, null)
})
