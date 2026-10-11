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
  ['bound class', '<template><BsExamplePage :class="recipe" /></template>', /slot recipe/],
  ['bound style', '<template><BsExamplePage :style="recipe" /></template>', /slot recipe/],
  ['dynamic destructured render', '<script setup>const { h: draw } = await import("vue"); draw("div")</script><template><BsExamplePage /></template>', /render factory/],
  ['destructured namespace render', '<script setup>import * as vue from "vue"; const { h: draw } = vue; draw("div")</script><template><BsExamplePage /></template>', /render factory/],
  ['indexed render alias', '<script setup>import * as vue from "vue"; const draw = vue["h"]; draw("div")</script><template><BsExamplePage /></template>', /render factory/],
  ['dynamic namespace render', '<script setup>const renderer = await import("vue"); const view = renderer.h("div")</script><template><BsExamplePage /></template>', /render factory/],
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
  ['destructured query namespace', '<script setup>import * as nuxt from "#imports"; const { useFetch: load } = nuxt; load("/api")</script><template><main /></template>', /product query/],
  ['dynamic destructured query', '<script setup>const { useFetch: load } = await import("#imports"); load("/api")</script><template><main /></template>', /product query/],
  ['indexed query namespace alias', '<script setup>import * as nuxt from "#imports"; const copy = nuxt; copy["useFetch"]("/api")</script><template><main /></template>', /product query/],
  ['variable query alias', '<script setup>const load = useFetch; load("/api/example")</script><template><main /></template>', /product query/],
  ['namespace query', '<script setup>import * as queries from "#imports"; queries.useFetch("/api/example")</script><template><main /></template>', /product query/],
  ['dynamic infrastructure', '<script setup>const session = await import("@building-suit/auth")</script><template><main /></template>', /infrastructure/],
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

test('architecture resolves a renamed callable through two re-export modules', async t => {
  const root = await fixture(t, '<script setup>import { draw } from "../second"; draw("div")</script><template><BsExamplePage /></template>')
  await writeFile(path.join(root, 'apps/example-suit/app/first.ts'), 'export { h as make } from "vue"')
  await writeFile(path.join(root, 'apps/example-suit/app/second.ts'), 'export { make as draw } from "./first"')
  assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => /render factory draw/.test(message)))
})

for (const [name, declaration] of [
 ['opaque imported state', 'export interface PageData { payload: Record<string, unknown> }'],
 ['imported callback recipe', 'export interface PageData { render: () => string }'],
 ['aliased imported component recipe', 'import type { Component as Recipe } from "vue"; export interface PageData { body: Recipe }'],
]) test(`architecture follows ${name} into the shared contract source`, async t => {
 const root = await fixture(t, '<template><BsExamplePage /></template>')
 await mkdir(path.join(root, 'packages/ui/src/types'))
 await writeFile(path.join(root, 'packages/ui/src/types/page.ts'), declaration)
 await writeFile(path.join(root, 'packages/ui/src/templates/BsExamplePage.vue'), '<script setup lang="ts">import type { PageData } from "../types/page"; defineProps<{ data: PageData }>()</script><template><main/></template>')
 assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => /untyped state|render recipes/.test(message)))
})
test('architecture does not interpret documentation copy as executable behavior', async t => {
 const root = await fixture(t, '<script setup>const copy = "useFetch, h and a controller factory are forbidden"</script><template><BsExamplePage :title="copy"/></template>')
 assert.deepEqual((await validateAtomicTemplateArchitecture({ root })).failures, [])
})

test('architecture follows executable wrapper bodies behind conditional package exports', async t => {
 const root = await fixture(t, '<script setup>import { draw } from "@building-suit/renderer"; draw()</script><template><BsExamplePage/></template>')
 await mkdir(path.join(root, 'packages/renderer'))
 await writeFile(path.join(root, 'packages/renderer/package.json'), JSON.stringify({ exports: { '.': { import: './index.ts', default: './index.ts' } } }))
 await writeFile(path.join(root, 'packages/renderer/index.ts'), 'import { h as create } from "vue"; export function draw() { return create("div") }')
 assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => /render factory draw/.test(message)))
})

test('UI cannot hide queries behind imported executable wrappers', async t => {
 const root = await fixture(t, '<template><BsExamplePage/></template>')
 await mkdir(path.join(root, 'packages/ui/src/utils'))
 await writeFile(path.join(root, 'packages/ui/src/utils/query.ts'), 'import { useFetch as request } from "#imports"; export const load = () => request("/api/business")')
 await writeFile(path.join(root, 'packages/ui/src/templates/BsExamplePage.vue'), '<script setup>import { load } from "../utils/query"; load()</script><template><main/></template>')
 assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => /product query\/context behavior load/.test(message)))
})

for (const [name, file, source] of [
 ['Vue presentation', 'Panel.vue', '<template><div/></template>'],
 ['aliased render', 'view.ts', 'import { h as draw } from "vue"; export const panel = () => draw("div")'],
 ['namespace render', 'view.ts', 'import * as vue from "vue"; export const panel = () => vue.h("div")'],
 ['UI dependency', 'view.ts', 'import { formatPresentationMoney } from "@building-suit/ui/utils/presentation"'],
]) test(`UX boundary rejects ${name}`, async t => {
 const root = await fixture(t, '<template><BsExamplePage/></template>')
 await mkdir(path.join(root, 'packages/ux/src'), { recursive: true })
 await writeFile(path.join(root, 'packages/ux/src', file), source)
 assert.ok((await validateAtomicTemplateArchitecture({ root })).failures.some(message => /UX (?:may not|must remain)/.test(message)))
})
