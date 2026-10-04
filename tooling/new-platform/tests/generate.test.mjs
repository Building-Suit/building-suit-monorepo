import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))
const templates = path.join(workspaceRoot, 'tooling/new-platform/templates')

test('future Suit scaffold is an adapter over shared UI', () => {
  const layout = readFileSync(path.join(templates, 'app/layouts/default.vue.template'), 'utf8')
  const page = readFileSync(path.join(templates, 'app/pages/index.vue.template'), 'utf8')
  const app = readFileSync(path.join(templates, 'app/app.vue.template'), 'utf8')

  assert.match(layout, /<BsAppShell\b/)
  assert.match(layout, /<BsProductLogo\b/)
  assert.match(layout, /<SettingsMenu\b/)
  assert.match(page, /<BsContentSection\b/)
  assert.doesNotMatch(page, /\bls-(?:card|btn|input|select)\b|<(?:button|form|section)\b[^>]*class=/)
  assert.match(app, /<ToastHost\b/)
  assert.match(app, /<BsConfirmHost\b/)
})

test('generator recursively consumes the maintained template inventory in dry-run mode', () => {
  const generator = readFileSync(path.join(workspaceRoot, 'tooling/new-platform/generate.mjs'), 'utf8')
  assert.match(generator, /async function templates\(relative = ''\)/)
  assert.match(generator, /await templates\(\)/)
  assert.match(generator, /option === '--dry-run'/)

  const pageTemplates = readdirSync(path.join(templates, 'app/pages'))
  assert.deepEqual(pageTemplates, ['index.vue.template'])
  for (const relative of [
    'app/app.vue.template',
    'app/layouts/default.vue.template',
    'app/pages/index.vue.template',
    'nuxt.config.ts.template',
  ]) assert.ok(readFileSync(path.join(templates, relative), 'utf8').trim())
})
