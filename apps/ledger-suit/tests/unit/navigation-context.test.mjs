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
    ['pages/transactions.vue', ['context(filters.from, filters.to, undefined)']],
    ['pages/reports.vue', ['ledgerPresentation.context(']],
    ['pages/receivables.vue', ['context(from, asOf, undefined)']],
    ['pages/payables.vue', ['context(from, asOf, undefined)']],
    ['pages/bank-reconciliation.vue', ['context(current?.statement_start, current?.statement_end, undefined)']],
    ['pages/accounting-dimensions.vue', ["context(tab === 'reports' ? reportFilter.from"]],
    ['pages/tax-vat.vue', ['context(from, to, undefined)']],
    ['pages/inventory-accounting.vue', ['context(undefined, undefined, asOf)']],
    ['pages/fixed-assets.vue', ['context(undefined, undefined, asOfDate)']],
    ['pages/periods.vue', ['context(currentPeriod?.start_date, currentPeriod?.end_date, undefined)']],
  ])
  for (const [path, bindings] of expected) {
    const page = read(`app/${path}`)
    assert.match(page, /<BsPageHeader/)
    for (const binding of bindings) assert.ok(page.includes(binding), `${path} is missing ${binding}`)
  }
  for (const path of ['accounts', 'opening-balances']) {
    assert.match(read(`app/pages/${path}.vue`), /<BsPageHeader/)
  }
  const header = read('app/composables/useLedgerPresentation.ts')
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
