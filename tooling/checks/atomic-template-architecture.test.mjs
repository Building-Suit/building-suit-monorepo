import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { validateAtomicTemplateArchitecture } from './atomic-template-architecture.mjs'
async function fixture(t, source) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bs-template-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const dir of ['apps/example-suit/app/pages', 'packages/ui/src/templates', 'docs/shared']) await mkdir(path.join(root, dir), { recursive: true })
  await writeFile(path.join(root, 'packages/ui/package.json'), JSON.stringify({ exports: { './templates/BsExamplePage': './src/templates/BsExamplePage.vue' } }))
  await writeFile(path.join(root, 'packages/ui/src/templates/BsExamplePage.vue'), '<template><main /></template>')
  await writeFile(path.join(root, 'docs/shared/atomic-template-route-inventory.json'), JSON.stringify({ pageTemplates: ['BsExamplePage'], entries: [{ source: 'apps/example-suit/app/pages/index.vue', kind: 'route', purpose: 'example', destination: 'packages/ui/src/templates/BsExamplePage.vue' }] }))
  await writeFile(path.join(root, 'apps/example-suit/app/pages/index.vue'), source)
  return root
}
test('a thin registered adapter passes without debt allowances', async t => {
  const root = await fixture(t, '<template><BsExamplePage :title="title" /></template>')
  assert.deepEqual((await validateAtomicTemplateArchitecture({ root })).failures, [])
})
for (const [name, source, pattern] of [
  ['counterfeit prefix', '<script setup>import BsExamplePage from "./LocalPanel.vue"</script><template><BsExamplePage /></template>', /shadowed/],
  ['slot recipe', '<template><BsExamplePage><template #default><BsText /></template></BsExamplePage></template>', /render composition/],
  ['raw html', '<template><BsExamplePage v-html="html" /></template>', /slot recipe/],
  ['aliased render', '<script setup>import { h as render } from "vue"; const view = render("div")</script><template><BsExamplePage /></template>', /render factory/],
  ['namespace render', '<script setup>import * as renderer from "vue"; const view = renderer.createVNode("div")</script><template><BsExamplePage /></template>', /render factory/],
  ['runtime alias', '<script setup>import { h } from "vue"; const draw = h; const view = draw("div")</script><template><BsExamplePage /></template>', /render factory/],
  ['local shadow', '<script setup>const BsExamplePage = arbitraryRenderer</script><template><BsExamplePage /></template>', /shadowed/],
  ['alternate render file', '<template><BsExamplePage /></template>', /JSX rendering/],
]) test(`architecture rejects ${name}`, async t => {
  const root = await fixture(t, source)
  if (name === 'alternate render file') await writeFile(path.join(root, 'apps/example-suit/app/escape.tsx'), 'export const render = () => <div />')
  const result = await validateAtomicTemplateArchitecture({ root })
  assert.ok(result.failures.some(message => pattern.test(message)), JSON.stringify(result))
})

for (const [name, source, pattern] of [
  ['query alias', '<script setup>import { useFetch as load } from "#imports"; load("/api/example")</script><template><main /></template>', /product query/],
  ['product infrastructure', '<script setup>import { useSession } from "@building-suit/auth"</script><template><main /></template>', /infrastructure/],
  ['untyped state bag', '<script setup lang="ts">defineProps<{ state: Record<string, unknown> }>()</script><template><main /></template>', /untyped state/],
  ['scope factory', '<script setup>const state = props.factory(props.input)</script><template><main /></template>', /scope factories/],
]) test(`UI presentation rejects ${name}`, async t => {
  const root = await fixture(t, '<template><BsExamplePage /></template>')
  await writeFile(path.join(root, 'packages/ui/src/templates/BsExamplePage.vue'), source)
  assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => pattern.test(message)))
})
test('layout rejects a disguised scoped render outlet', async t => {
  const root = await fixture(t, '<template><BsExamplePage /></template>')
  await mkdir(path.join(root, 'apps/example-suit/app/layouts'))
  const registryPath = path.join(root, 'docs/shared/atomic-template-route-inventory.json')
  const registry = JSON.parse(await (await import('node:fs/promises')).readFile(registryPath, 'utf8'))
  registry.entries.push({ source: 'apps/example-suit/app/layouts/default.vue', kind: 'layout', destination: 'packages/ui/src/templates/BsExamplePage.vue' })
  await writeFile(registryPath, JSON.stringify(registry))
  await writeFile(path.join(root, 'apps/example-suit/app/layouts/default.vue'), '<template><BsExamplePage><slot :renderer="view" /></BsExamplePage></template>')
  assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => /unscoped route outlet/.test(message)))
})
