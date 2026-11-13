import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

test('contact duplicate commands stay locked until one authoritative request settles', async () => {
  const source = (await readFile(new URL('../../app/pages/contact.vue', import.meta.url), 'utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const code = ts.transpileModule(`${source}\nreturn { form, submit, pending, sent, error }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  let resolve
  let calls = 0
  const request = new Promise(done => { resolve = done })
  const globals = { ref: vue.ref, reactive: vue.reactive, computed: vue.computed, watch: () => {}, definePageMeta: () => {}, useHead: () => {}, useI18n: () => ({ t: key => key, locale: vue.ref('en') }), useSupabaseUser: () => vue.ref(null), useShopClient: () => ({ schema: () => ({ rpc: () => { calls++; return request } }) }) }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const f = await new AsyncFunction('require', 'exports', ...Object.keys(globals), code)(() => ({ publicBusiness: {} }), {}, ...Object.values(globals))
  Object.assign(f.form, { email: 'visitor@example.test', subject: 'Question', message: 'Help please', consent: true })
  const first = f.submit()
  assert.equal(f.pending.value, true)
  await f.submit()
  assert.equal(calls, 1)
  assert.equal(f.sent.value, false)
  resolve({ error: null })
  await first
  assert.equal(f.pending.value, false)
  assert.equal(f.sent.value, true)
  assert.equal(f.form.subject, '')
  assert.equal(f.form.consent, false)
})
