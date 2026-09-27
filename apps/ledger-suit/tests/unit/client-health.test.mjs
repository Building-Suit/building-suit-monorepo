import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  availableSignal,
  deriveClientHealth,
  filterClientHealthRows,
  loadClientHealthRows,
  portfolioScopeKey,
  todayInTimezone,
  unavailableSignal,
} from '../../app/utils/clientHealth.ts'

const organization = (id, name) => ({
  id,
  name,
  legalName: `${name} LLC`,
  baseCurrency: 'EGP',
  timezone: 'Africa/Cairo',
  role: 'accountant',
  roleId: null,
})

const signals = overrides => ({
  period: availableSignal('open'),
  reconciliation: availableSignal('reconciled'),
  lastActivity: availableSignal('2026-09-27'),
  ...overrides,
})

test('health derives only from available real signals and never converts missing providers to zero', () => {
  assert.equal(deriveClientHealth(signals({})), 'healthy')
  assert.equal(deriveClientHealth(signals({ period: availableSignal('missing') })), 'needs_attention')
  assert.equal(deriveClientHealth(signals({ reconciliation: availableSignal('needs_attention') })), 'needs_attention')
  assert.equal(deriveClientHealth({
    period: unavailableSignal(),
    reconciliation: unavailableSignal(),
    lastActivity: unavailableSignal(),
  }), 'unavailable')
  assert.equal(deriveClientHealth({
    period: unavailableSignal(),
    reconciliation: unavailableSignal(),
    lastActivity: availableSignal(null),
  }), 'unavailable')
  assert.equal(deriveClientHealth(signals({ reconciliation: unavailableSignal() })), 'unavailable')
})

test('portfolio search and health filters cover names, legal names, currencies, and roles', async () => {
  const rows = await loadClientHealthRows(
    [organization('a', 'Alpha'), { ...organization('b', 'Beta'), baseCurrency: 'USD', role: 'owner' }],
    async row => row.id === 'a' ? signals({}) : signals({ period: availableSignal('missing') }),
  )
  assert.ok(rows)
  assert.deepEqual(filterClientHealthRows(rows, 'alpha llc', 'all').map(row => row.id), ['a'])
  assert.deepEqual(filterClientHealthRows(rows, 'usd', 'all').map(row => row.id), ['b'])
  assert.deepEqual(filterClientHealthRows(rows, '', 'needs_attention').map(row => row.id), ['b'])
})

test('a stale portfolio request cannot publish after identity or membership scope changes', async () => {
  let release
  const waiting = new Promise(resolve => { release = resolve })
  let currentScope = portfolioScopeKey('user-a', ['org-a'])
  const requestedScope = currentScope
  const request = loadClientHealthRows(
    [organization('org-a', 'Alpha')],
    async () => { await waiting; return signals({}) },
    () => currentScope === requestedScope,
  )

  currentScope = portfolioScopeKey('user-b', ['org-b'])
  release()
  assert.equal(await request, null)
})

test('scope keys are membership-order independent and organization dates respect timezones', () => {
  assert.equal(portfolioScopeKey('user', ['b', 'a']), portfolioScopeKey('user', ['a', 'b']))
  const instant = new Date('2026-09-27T22:30:00.000Z')
  assert.equal(todayInTimezone('Africa/Cairo', instant), '2026-09-28')
  assert.equal(todayInTimezone('America/New_York', instant), '2026-09-27')
})

test('portfolio UI is bilingual, uses existing organization switching, and does not request monetary summaries', () => {
  const locale = name => JSON.parse(readFileSync(new URL(`../../i18n/locales/${name}.json`, import.meta.url), 'utf8'))
  assert.ok(locale('en').clientPortfolio)
  assert.ok(locale('ar').clientPortfolio)

  const page = readFileSync(new URL('../../app/pages/clients.vue', import.meta.url), 'utf8')
  const loader = readFileSync(new URL('../../app/composables/useClientPortfolio.ts', import.meta.url), 'utf8')
  const tenant = readFileSync(new URL('../../app/composables/useTenant.ts', import.meta.url), 'utf8')
  assert.match(page, /setOrganization\(row\.id\)/)
  assert.match(page, /BsDataTable/)
  assert.doesNotMatch(loader, /dashboard_summary|Number\(/)
  assert.match(loader, /reconcile_control_accounts/)
  assert.match(loader, /accounting_periods/)
  assert.match(loader, /search_transactions/)
  assert.match(tenant, /switchVersions/)
  assert.ok(tenant.indexOf('switchVersions.set(nuxtApp, version)') < tenant.indexOf('if (id === currentId.value)'))
  assert.ok(tenant.indexOf('switchVersions.get(nuxtApp) !== version') < tenant.indexOf('currentId.value = id'))
})
