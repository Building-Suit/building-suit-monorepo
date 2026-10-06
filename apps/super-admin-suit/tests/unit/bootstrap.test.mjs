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

test('configuration authority is migration-owned, deny-by-default, and contains no deployed values', () => {
  const migration = read('supabase/migrations/20261005120000_configuration_authority.sql')
  const databaseTest = read('supabase/tests/configuration_authority.sql')
  const databaseTypes = read('app/types/database.types.ts')

  for (const relation of [
    'admin_environments',
    'platform_admins',
    'suit_registry',
    'suit_environment_bindings',
    'adapter_registrations',
    'adapter_capability_policy',
    'navigation_items',
    'integration_providers',
    'integration_settings',
    'integration_secret_references',
    'adapter_manifest_observations',
    'configuration_revisions',
    'control_plane_events',
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${relation}\\b`))
    assert.match(migration, new RegExp(`'${relation}'`))
  }

  assert.match(migration, /create schema super_admin_private/)
  assert.match(migration, /security definer set search_path = ''/)
  assert.match(migration, /PLATFORM_OWNER_REQUIRED/)
  assert.match(migration, /CONFIG_VERSION_CONFLICT/)
  assert.match(migration, /CONFIG_REQUEST_ID_REUSED/)
  assert.match(migration, /configuration_revisions_immutable/)
  assert.match(migration, /control_plane_events_immutable/)
  assert.match(migration, /p_resource_type='secret_reference' then p_payload-'vaultSecretId'/)
  assert.match(databaseTest, /metadata-bearing outsider entered Super Admin/)
  assert.match(databaseTest, /disabled platform owner retained authority/)
  assert.match(databaseTest, /Vault reference leaked through public audit projection/)
  assert.match(databaseTypes, /super_admin_configuration_command/)
  assert.match(databaseTypes, /integration_secret_references/)

  assert.doesNotMatch(migration, /https:\/\/[a-z]{20}\.supabase\.co/)
  assert.doesNotMatch(migration, /sb_(?:secret|publishable)_[A-Za-z0-9]{20,}/)
  assert.doesNotMatch(migration, /service[_-]?role\s*[:=]\s*['"][^'"]+/i)
})
