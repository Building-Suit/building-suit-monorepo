import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { compileScript, parse } from 'vue/compiler-sfc'
const source = await readFile(new URL('../src/organisms/BsSignupEnrollment.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const code = stripTypeScriptTypes(compileScript(descriptor, { id: 'signup-identity', inlineTemplate: true }).content)
  .replace(/from (['"])vue\1/g, `from '${import.meta.resolve('vue')}'`)
const { default: Enrollment } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
async function controls(profileName, nameLocked) {
  const inputs = []
  const app = createSSRApp(Enrollment, {
    form: { name: 'Entered name', email: 'verified@example.test', password: '', workspaceName: '' }, otp: '', consent: false,
    features: { profileName }, view: { stage: 'workspace', existingAccount: true, nameLocked, step: 2 },
    copy: { name: 'Name', email: 'Email', workspaceName: 'Workspace', steps: [] },
    verificationCopy: {}, choices: {}, links: {}, legalConsent: null,
  })
  const wrapper = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of new Set([...source.matchAll(/<(Bs[A-Za-z0-9]+)/g)].map(match => match[1]))) {
    if (!['BsField', 'BsInput'].includes(name)) app.component(name, wrapper)
  }
  app.component('BsField', defineComponent({ props: ['label'], setup: (props, { slots }) => () => h('label', slots.default?.({ id: props.label })) }))
  app.component('BsInput', defineComponent({ props: { id: String, modelValue: String, type: { type: String, default: 'text' }, readonly: Boolean }, setup: props => () => {
    inputs.push({ id: props.id, readonly: props.readonly, type: props.type })
    return h('input')
  } }))
  await renderToString(app)
  return inputs
}
test('professional profile setup keeps one editable name and excludes account identity controls', async () => {
  const fields = await controls(true)
  assert.deepEqual(fields.filter(field => field.id === 'Name'), [{ id: 'Name', readonly: false, type: 'text' }])
  assert.equal(fields.some(field => field.type === 'email'), false)
  assert.equal((await controls(true, true)).find(field => field.id === 'Name').readonly, true)
})
test('verified account onboarding retains read-only provider name and email', async () => {
  const fields = await controls(false, true)
  assert.deepEqual(fields.filter(field => ['Name', 'Email'].includes(field.id)), [
    { id: 'Name', readonly: true, type: 'text' }, { id: 'Email', readonly: true, type: 'email' },
  ])
})
