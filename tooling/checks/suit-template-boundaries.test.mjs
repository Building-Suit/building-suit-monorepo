import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { auditSuitTemplates, validateSuitTemplateBoundaries } from './suit-template-boundaries.mjs'

async function fixture(source, manifestViolations) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bs-suit-boundary-'))
  const app = path.join(root, 'apps/example-suit/app')
  await mkdir(path.join(app, 'components'), { recursive: true })
  await writeFile(path.join(app, 'pages.vue'), source)
  if (source.includes('<LocalPanel')) await writeFile(path.join(app, 'components/LocalPanel.vue'), '<template><BsCard /></template>')
  const audit = await auditSuitTemplates({ root })
  const manifest = {
    schemaVersion: 1,
    mode: 'migration',
    auditedReference: { branch: 'test', commit: '0000000' },
    violations: manifestViolations === undefined ? audit.debt : manifestViolations,
  }
  await writeFile(path.join(root, 'debt.json'), JSON.stringify(manifest))
  return { root, audit }
}

test('AST audit rejects native, vendor, non-Bs, styling, raw HTML, style blocks, imports, and local Vue components', async (t) => {
  const source = `<script setup lang="ts">import Button from 'primevue/button'</script>
<template><div class="x"><Button :pt="{}"/><LegacyThing v-html="raw"/><LocalPanel /></div></template>
<style scoped>.x { color: red }</style>`
  const { root, audit } = await fixture(source)
  t.after(() => rm(root, { recursive: true, force: true }))
  const kinds = new Set(audit.debt.map(item => item.kind))
  for (const kind of ['native-tag', 'vendor-tag', 'non-bs-tag', 'presentation-attribute', 'raw-html-directive', 'style-block', 'ui-vendor-import', 'app-local-component-tag', 'app-local-component-file']) assert.ok(kinds.has(kind), kind)
  assert.equal(audit.debt.filter(item => item.evidence === ':pt="{}"').length, 1)
})

test('an unrecorded violation fails immediately', async (t) => {
  const { root } = await fixture('<template><div /></template>', [])
  t.after(() => rm(root, { recursive: true, force: true }))
  const result = await validateSuitTemplateBoundaries({ root, manifestPath: 'debt.json' })
  assert.ok(result.failures.some(failure => failure.includes('new unrecorded Suit UI boundary violation')))
})

test('a removed violation leaves stale debt and fails', async (t) => {
  const first = await fixture('<template><div /></template>')
  const stale = first.audit.debt
  await rm(first.root, { recursive: true, force: true })
  const { root } = await fixture('<template><BsCard /></template>', stale)
  t.after(() => rm(root, { recursive: true, force: true }))
  const result = await validateSuitTemplateBoundaries({ root, manifestPath: 'debt.json' })
  assert.ok(result.failures.some(failure => failure.includes('stale Suit UI boundary debt')))
})

test('recorded migration debt is exact and temporarily allowed', async (t) => {
  const { root } = await fixture('<template><section :class="classes"><BsCard /></section></template>')
  t.after(() => rm(root, { recursive: true, force: true }))
  const result = await validateSuitTemplateBoundaries({ root, manifestPath: 'debt.json' })
  assert.deepEqual(result.failures, [])
})

test('Automation and Inventory have no remaining template or local-component debt', async () => {
  const audit = await auditSuitTemplates()
  const migrated = ['apps/automation-suit/', 'apps/inventory-suit/']
  for (const prefix of migrated) {
    assert.ok(audit.files.some(file => file.startsWith(prefix)), `${prefix} must be discovered`)
    assert.deepEqual(audit.debt.filter(item => item.file.startsWith(prefix)), [], prefix)
    assert.deepEqual(audit.parseFailures.filter(message => message.startsWith(prefix)), [], prefix)
  }
})

test('strict mode rejects even exactly recorded migration debt', async t => {
  const { root } = await fixture('<template><div /></template>')
  t.after(() => rm(root, { recursive: true, force: true }))
  const result = await validateSuitTemplateBoundaries({ root, manifestPath: 'debt.json', strict: true })
  assert.ok(result.failures.some(failure => failure.includes('forbidden in strict mode')))
})

test('strict mode accepts Bs-only templates without a debt manifest', async t => {
  const { root } = await fixture('<template><BsCard><template #default><BsText /></template></BsCard></template>')
  t.after(() => rm(root, { recursive: true, force: true }))
  await rm(path.join(root, 'debt.json'))
  const result = await validateSuitTemplateBoundaries({ root, strict: true })
  assert.deepEqual(result.failures, [])
})
