import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { generatePlatform } from '../generate.mjs'
import { validateSuitTemplateBoundaries } from '../../checks/suit-template-boundaries.mjs'

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))
const slug = 'generator-fixture-suit'
// CLI subprocesses must not inherit Node's binary test-runner reporting protocol.
const cliEnvironment = { ...process.env }
delete cliEnvironment.NODE_TEST_CONTEXT

test('standalone verification runs disposable generation and the strict checker CLI', () => {
  const result = spawnSync(process.execPath, ['tooling/new-platform/verify-fixture.mjs'], {
    cwd: workspaceRoot, stdio: 'ignore', env: cliEnvironment,
  })
  assert.ifError(result.error)
  assert.equal(result.status, 0)
})

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bs-generator-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(path.join(root, 'package.json'), await readFile(path.join(workspaceRoot, 'package.json')))
  return { root, app: path.join(root, 'apps', slug) }
}


async function inventory(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...(await inventory(path.join(directory, entry.name))).map(file => `${entry.name}/${file}`))
    else files.push(entry.name)
  }
  return files.sort()
}

test('dry run is side-effect free and matches the generated disposable Suit', async t => {
  const { root, app } = await fixture(t)
  const preview = await generatePlatform({ root, slug, title: 'Fixture Suit', dryRun: true })
  await assert.rejects(access(path.join(root, 'apps')), { code: 'ENOENT' })
  const emitted = await generatePlatform({ root, slug, title: 'Fixture Suit' })
  assert.deepEqual(emitted, preview)
  assert.deepEqual((await inventory(app)).map(file => `apps/${slug}/${file}`), preview.toSorted())
  const result = await validateSuitTemplateBoundaries({ root, strict: true })
  assert.deepEqual(result.failures, [])
  assert.equal(result.files.length, 3)
  assert.deepEqual(result.debt, [])
  assert.ok(!preview.some(file => file.includes('/app/components/') || /\.(css|scss|sass|less)$/.test(file)))
  assert.equal((await readFile(path.join(app, 'app/app.vue'), 'utf8')).trim(), '<template><BsAppRoot toast-host /></template>')
  const page = await readFile(path.join(app, 'app/pages/index.vue'), 'utf8')
  assert.match(page, /v-bind="sample"/)
  assert.match(page, /@click="openWorkflow"/)
  const guidance = await readFile(path.join(app, 'AGENTS.md'), 'utf8')
  for (const required of ['ZERO-NATIVE', 'packages/ui', 'packages/ux', 'Do not create Vue files under `app/components`']) assert.ok(guidance.includes(required))
  const { dependencies } = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'))
  assert.deepEqual(Object.keys(dependencies).sort(), ['@building-suit/nuxt-layer', 'nuxt', 'vue', 'vue-router'])
  const layer = JSON.parse(await readFile(path.join(workspaceRoot, 'packages/nuxt-layer/package.json'), 'utf8'))
  for (const name of ['primevue', '@primevue/nuxt-module', '@nuxtjs/i18n', '@nuxt/eslint', '@hugeicons/vue', 'tailwindcss']) assert.ok(layer.dependencies[name], `${name} must be owned by the shared layer`)
  for (const locale of ['en', 'ar']) {
    assert.equal(JSON.parse(await readFile(path.join(app, `i18n/locales/${locale}.json`), 'utf8')).product.name, 'Fixture Suit')
  }
  await assert.rejects(generatePlatform({ root, slug }), /Refusing to overwrite/)
})

const regressions = [
  ['native tag', 'app/pages/index.vue', '<template><div /></template>', 'native-tag'],
  ['Nuxt render tag', 'app/pages/index.vue', '<template><NuxtPage /></template>', 'nuxt-or-vue-render-tag'],
  ['vendor tag', 'app/pages/index.vue', '<template><Button /></template>', 'vendor-tag'],
  ['non-Bs alias', 'app/pages/index.vue', '<template><AppIcon /></template>', 'non-bs-tag'],
  ['local presentation component', 'app/components/nested/BsLocal.vue', '<template><BsText /></template>', 'app-local-component-file'],
  ['class binding', 'app/pages/index.vue', '<template><BsText :class="{}" /></template>', 'presentation-attribute'],
  ['style binding', 'app/pages/index.vue', '<template><BsText :style="{}" /></template>', 'presentation-attribute'],
  ['passthrough styling', 'app/pages/index.vue', '<template><BsButton :pt="{}" /></template>', 'presentation-attribute'],
  ['style block', 'app/pages/index.vue', '<template><BsText /></template><style>p { color: red }</style>', 'style-block'],
  ['vendor import', 'app/pages/index.vue', '<script setup>import Button from "primevue/button"</script><template><BsText /></template>', 'ui-vendor-import'],
]
for (const [name, relative, contents, violation] of regressions) {
  test(`strict generated-fixture check rejects ${name}`, async t => {
    const { root, app } = await fixture(t)
    await generatePlatform({ root, slug })
    const target = path.join(app, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, contents)
    const result = await validateSuitTemplateBoundaries({ root, strict: true })
    assert.ok(result.failures.length > 0)
    assert.ok(result.debt.some(item => item.kind === violation), JSON.stringify(result))
    const cli = spawnSync(process.execPath, ['tooling/checks/suit-template-boundaries.mjs', '--root', root, '--strict'], {
      cwd: workspaceRoot, stdio: 'ignore', env: cliEnvironment,
    })
    assert.ifError(cli.error)
    assert.equal(cli.status, 1)
  })
}

test('generator rejects invalid input without creating an app', async t => {
  const { root } = await fixture(t)
  for (const slug of ['../escape', 'Invalid', '']) await assert.rejects(generatePlatform({ root, slug }), /Usage:/)
  await assert.rejects(generatePlatform({ root, slug, title: ' ' }), /Usage:/)
  await assert.rejects(access(path.join(root, 'apps')), { code: 'ENOENT' })
})
