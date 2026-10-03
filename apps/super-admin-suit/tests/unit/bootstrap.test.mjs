import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const appRoot = fileURLToPath(new URL('../../', import.meta.url))
const workspaceRoot = path.resolve(appRoot, '../..')
const read = relative => readFileSync(path.join(appRoot, relative), 'utf8')

test('Super Admin is a shared-layer app with an independent Supabase boundary', () => {
  const manifest = JSON.parse(read('package.json'))
  assert.equal(manifest.dependencies['@building-suit/nuxt-layer'], 'workspace:*')
  assert.equal(manifest.dependencies['@nuxtjs/supabase'], '1.6.2')

  const nuxt = read('nuxt.config.ts')
  assert.match(nuxt, /extends: \['@building-suit\/nuxt-layer'\]/)
  assert.match(nuxt, /modules: \['@nuxtjs\/supabase'\]/)
  assert.match(nuxt, /bs-super-admin-\$\{process\.env\.APP_ENV \|\| 'local'\}-auth-token/)

  for (const relative of [
    'supabase/config.toml',
    'supabase/seed.sql',
    'supabase/migrations/.gitkeep',
    'supabase/tests/.gitkeep',
  ]) assert.ok(existsSync(path.join(appRoot, relative)), `${relative} must exist`)
})

test('bootstrap presentation composes shared Bs owners without source-owned navigation', () => {
  const app = read('app/app.vue')
  const layout = read('app/layouts/default.vue')
  const page = read('app/pages/index.vue')

  assert.match(app, /<ToastHost\b/)
  assert.match(app, /<BsConfirmHost\b/)
  assert.match(layout, /<BsAppShell\b/)
  assert.match(layout, /<BsProductLogo\b/)
  assert.match(layout, /<SettingsMenu\b/)
  assert.match(layout, /:groups="\[\]"/)
  assert.match(page, /<BsContentSection\b/)
  assert.doesNotMatch(`${layout}\n${page}`, /<(?:button|table|form|Dialog|DataTable)\b/)
})

test('Super Admin templates contain placeholders only and no runtime business configuration', () => {
  const browserTemplates = ['.env.example', '.env.staging.example', '.env.production.example']
    .map(read).join('\n')
  const deploymentTemplates = ['staging', 'production']
    .map(environment => readFileSync(path.join(workspaceRoot, `supabase/environments/super-admin-suit/.env.${environment}.example`), 'utf8'))
    .join('\n')
  const runtimeSources = [
    'nuxt.config.ts',
    'app/app.vue',
    'app/layouts/default.vue',
    'app/pages/index.vue',
    'i18n/locales/en.json',
    'i18n/locales/ar.json',
  ].map(read).join('\n')

  assert.doesNotMatch(browserTemplates, /https:\/\/[a-z]{20}\.supabase\.co/)
  assert.doesNotMatch(browserTemplates, /sb_(?:secret|publishable)_[A-Za-z0-9]{20,}/)
  assert.doesNotMatch(deploymentTemplates, /^\w+=.+$/m)
  assert.doesNotMatch(runtimeSources, /https:\/\/[a-z]{20}\.supabase\.co|sb_secret_|service[_-]?role/i)
  assert.doesNotMatch(runtimeSources, /(?:price|quota|instapay|provider|ownerId)\s*[:=]/i)
})
