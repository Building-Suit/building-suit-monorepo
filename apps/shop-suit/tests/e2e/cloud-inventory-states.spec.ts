import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`inventory failed refresh hides unverified summaries: ${locale}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', name => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Synthetic inventory shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'inventory_access') return [{ can_view: true, can_manage: true, inventory_enabled: true }]
      if (name === 'list_inventory') return { items: [{ product_id: 'product-1', name: 'Synthetic stock', sku: 'CLOUD-1', sale_price: 30, is_active: true, reorder_threshold: 2, quantity_on_hand: 10, inventory_value: 100, is_low_stock: false }], total_valuation: 100, low_stock_count: 0 }
      return undefined
    })
    await fixtureGoto(page, '/inventory')
    const valuation = page.getByText(ar ? 'إجمالي قيمة المخزون' : 'Inventory valuation', { exact: true })
    await expect(valuation).toBeVisible()
    let release: (() => void) | undefined
    let failing = true
    await fixtureRoute(page, '**/rest/v1/rpc/list_inventory', async route => {
      if (failing) {
        await new Promise<void>(resolve => { release = resolve })
        await route.fulfill({ status: 503, json: { message: 'Synthetic inventory service unavailable' } })
      } else await route.fallback()
    })
    await page.getByRole('button', { name: ar ? 'منخفض المخزون' : 'Low stock', exact: true }).click()
    await expect(valuation).toHaveCount(0)
    await expect(page.getByRole('button', { name: ar ? 'استلام يدوي' : 'Manual receipt', exact: true })).toHaveCount(0)
    await expect.poll(() => typeof release).toBe('function')
    release!()
    await expect(page.getByText(ar ? 'تعذّر تحميل المخزون.' : 'Could not load inventory.', { exact: true })).toBeVisible()
    await expect(valuation).toHaveCount(0)
    failing = false
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(valuation).toBeVisible()
    await expect(page.getByRole('cell', { name: /Synthetic stock/ })).toBeVisible()
    await expectNoPageOverflow(page)
  })

  test(`inventory access failure and actual denial stay distinct: ${locale}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', name => name === 'shops' ? [{ id: 'shop-1', name: 'Synthetic inventory shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }] : undefined)
    let fail = true
    await fixtureRoute(page, '**/rest/v1/rpc/inventory_access', route => fail
      ? route.fulfill({ status: 503, json: { message: 'Synthetic access service unavailable' } })
      : route.fulfill({ json: [{ can_view: false, can_manage: false, inventory_enabled: true }] }))
    await fixtureGoto(page, '/inventory')
    await expect(page.getByText(ar ? 'تعذّر تحميل المخزون.' : 'Could not load inventory.', { exact: true })).toBeVisible()
    await expect(page.getByText(ar ? 'ليست لديك صلاحية عرض المخزون.' : 'You do not have permission to view inventory.', { exact: true })).toHaveCount(0)
    fail = false
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.getByText(ar ? 'ليست لديك صلاحية عرض المخزون.' : 'You do not have permission to view inventory.', { exact: true })).toBeVisible()
    expect(calls.filter(call => call.name === 'list_inventory')).toHaveLength(0)
    await expect(page.getByRole('table')).toHaveCount(0)
    await expectNoPageOverflow(page)
  })
}
