import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('accounting routes remain capability-gated and grouped in one app shell', () => {
  const layout = read('app/layouts/default.vue')
  for (const route of [
    '/transactions', '/accounts', '/opening-balances', '/periods', '/receivables', '/payables',
    '/bank-reconciliation', '/fixed-assets', '/inventory-accounting', '/tax-vat', '/reports',
    '/accounting-dimensions',
  ]) assert.ok(layout.includes(`to: '${route}'`), `${route} is missing`)
  for (const group of ['ledger', 'subledgers', 'insights']) assert.match(layout, new RegExp(`key: '${group}'`))
  assert.equal((layout.match(/<BsAppShell/g) ?? []).length, 1)
})

test('module headers expose organization and applicable reporting context', () => {
  const expected = new Map([
    ['pages/transactions.vue', [':from="filters.from"', ':to="filters.to"']],
    ['pages/reports.vue', [':as-of=', ':from=']],
    ['pages/receivables.vue', [':from="from"', ':to="asOf"']],
    ['pages/payables.vue', [':from="from"', ':to="asOf"']],
    ['pages/bank-reconciliation.vue', [':from="current?.statement_start"', ':to="current?.statement_end"']],
    ['pages/accounting-dimensions.vue', [':from=', ':to=']],
    ['pages/tax-vat.vue', [':from="from"', ':to="to"']],
    ['pages/inventory-accounting.vue', [':as-of="asOf"']],
    ['pages/fixed-assets.vue', [':as-of="asOfDate"']],
    ['pages/periods.vue', [':from="currentPeriod?.start_date"', ':to="currentPeriod?.end_date"']],
  ])
  for (const [path, bindings] of expected) {
    const page = read(`app/${path}`)
    assert.match(page, /<LedgerPageHeader/)
    for (const binding of bindings) assert.ok(page.includes(binding), `${path} is missing ${binding}`)
  }
  for (const path of ['accounts', 'opening-balances']) {
    assert.match(read(`app/pages/${path}.vue`), /<LedgerPageHeader/)
  }
  const header = read('app/components/LedgerPageHeader.vue')
  assert.match(header, /<BsPageHeader/)
  assert.match(header, /current\.value\?\.name/)
  assert.match(header, /pageContext\.reportingPeriod/)
})

test('mobile navigation declares state and restores keyboard focus', () => {
  const shell = read('../../packages/ui/src/templates/BsAppShell.vue')
  const sideMenu = read('../../packages/ui/src/organisms/BsSideMenu.vue')
  const topHeader = read('../../packages/ui/src/organisms/BsTopHeader.vue')
  assert.match(topHeader, /aria-controls="bs-primary-navigation"/)
  assert.match(topHeader, /:aria-expanded="navigationOpen"/)
  assert.match(sideMenu, /event\.key === 'Escape'/)
  assert.match(sideMenu, /event\.key !== 'Tab'/)
  assert.match(sideMenu, /data-side-menu-close/)
  assert.match(shell, /focusNavigationTrigger/)
})
