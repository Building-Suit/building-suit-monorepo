import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const exports = {}
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('exports', 'require', code)(exports, name => load(`../../app/utils/${name.replace('./', '')}.ts`))
  return exports
}
const { shopNavigation, shopSettingsNavigation } = load('../../app/utils/shopNavigation.ts')
const { SHOP_PAGE_PERMISSIONS, shopPermissionMenu } = load('../../app/utils/shopPermissionMenu.ts')
const { permissionSelection } = load('../../../../packages/ux/src/permissionSelection.ts')
const translate = locale => key => ({ 'customers.title': locale === 'ar' ? 'العملاء' : 'Customers', 'sales.title': locale === 'ar' ? 'المبيعات' : 'Sales' })[key]
const catalog = [...readFileSync(new URL('../../supabase/migrations/20260929210002_fresh_bootstrap_permission_catalog.sql', import.meta.url), 'utf8').matchAll(/\('([a-z_.]+)', '/g)].map(match => match[1])

for (const locale of ['en', 'ar']) {
  test(`${locale}: permission sections follow canonical navigation names and order`, () => {
    const menu = shopNavigation('mixed', locale, translate(locale))
    assert.deepEqual(menu.flatMap(group => group.links.map(page => page.to)), Object.keys(SHOP_PAGE_PERMISSIONS).filter(path => !['/billing','/settings'].includes(path)))
    const rows = shopPermissionMenu(catalog, catalog, locale, translate(locale), key => key)
    const sections = [...new Map(rows.map(row => [row.section, row.sectionLabel]))]
    assert.deepEqual(sections, menu.flatMap(group => group.links.filter(page => SHOP_PAGE_PERMISSIONS[page.to].length).map(page => [page.to, `${group.label} / ${page.label}`])))
    for (const row of rows) assert.ok(SHOP_PAGE_PERMISSIONS[row.section].includes(row.key))
    assert.deepEqual([...new Set(rows.map(row => row.key))].sort(), [...catalog].sort())
    assert.equal(new Set(rows.map(row => JSON.stringify([row.section, row.key]))).size, rows.length)
    assert.equal(menu[0].links[0].label, locale === 'ar' ? 'التقويم والمواعيد' : 'Calendar & appointments')
    assert.equal(menu[0].links.at(-1).label, locale === 'ar' ? 'المبيعات' : 'Sales')
    assert.ok(!shopNavigation('product', locale, translate(locale)).flatMap(group => group.links).some(page => page.to === '/appointments'))
    assert.ok(!shopNavigation('service', locale, translate(locale)).flatMap(group => group.links).some(page => page.to === '/inventory'))
  })
}

test('unknown and ungrantable saved permissions remain visible and immutable', () => {
  const selected = ['sales.manage', 'legacy.custom', 'team.manage']
  const rows = shopPermissionMenu(selected, ['sales.manage'], 'ar', translate('ar'), key => key)
  assert.equal(rows.find(row => row.key === 'legacy.custom').section, 'additional')
  const disabled = rows.filter(row => row.disabled).map(row => row.key)
  assert.equal(permissionSelection(selected, 'legacy.custom', false, disabled), undefined)
  assert.equal(permissionSelection(selected, 'sales.manage', false, [], true), undefined)
  const changed = permissionSelection(selected, 'sales.manage', false, disabled)
  assert.deepEqual(changed, ['legacy.custom', 'team.manage'])
  assert.deepEqual(selected, ['sales.manage', 'legacy.custom', 'team.manage'])
  assert.deepEqual(shopPermissionMenu([], [], 'en', translate('en'), key => key), [])
  assert.deepEqual(SHOP_PAGE_PERMISSIONS['/billing'], [])
})

test('page delegates presentation while preserving saved key and owner contracts', () => {
  const page = readFileSync(new URL('../../app/pages/team.vue', import.meta.url), 'utf8')
  const shell = readFileSync(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8')
  assert.match(shell, /groups = computed\(\(\) => shopNavigation\(/)
  assert.match(page, /permissions: shopPermissionMenu\(/)
  assert.match(page, /role\.key !== 'owner'/)
  assert.match(page, /p_permission_keys: roleForm\.permissionKeys/)
  const matrix = readFileSync(new URL('../../../../packages/ui/src/organisms/BsPermissionMatrix.vue', import.meta.url), 'utf8')
  assert.match(matrix, /rowId: JSON\.stringify\(\[item.section, item.key\]\)/)
  assert.match(matrix, /row-key="rowId"/)
  assert.match(matrix, /emit\('toggle', row.key,/)
})

test('website stack keeps existing settings and appointment grants under their actual menu pages', () => {
  const settings = readFileSync(new URL('../../app/pages/settings/[[section]].vue', import.meta.url), 'utf8')
  assert.match(settings, /p_permission_keys: \['settings.manage'\]/)
  for (const adapter of ['useWebsiteAddress', 'useWebsiteProfile', 'useWebsiteCatalog', 'useWebsiteInquiries']) assert.match(settings, new RegExp(`${adapter}\\(computed\\(\\(\\) => canManage\\.value && section\\.value ===`))
  assert.ok(SHOP_PAGE_PERMISSIONS['/settings'].includes('settings.manage'))
  assert.ok(SHOP_PAGE_PERMISSIONS['/appointments'].includes('appointments.manage'))
  const access = readFileSync(new URL('../../supabase/migrations/20261016020824_shop_appointment_access_credentials.sql', import.meta.url), 'utf8')
  assert.match(access, /appointments\.manage/)
  const pages = shopNavigation('mixed', 'en', translate('en')).flatMap(group => group.links.map(page => page.to))
  assert.ok(pages.includes('/website-builder'))
  assert.ok(!pages.some(page => /^\/website-(address|profile|catalog|inquiries)$/.test(page)), 'publishing controls remain under their scoped Settings pages')
  const settingsPages = shopSettingsNavigation(false,true).map(page => page.to)
  assert.ok(settingsPages.includes('/settings/website-profile'))
  assert.ok(settingsPages.includes('/settings/locations'))
  assert.equal(settingsPages.at(-1), '/billing')
})
