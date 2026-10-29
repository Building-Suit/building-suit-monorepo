import { expect, test } from '@playwright/test'
import { fixtureGoto, pilotFixture } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

// Synthetic transport qualification only. SQL quota/isolation qualification is
// separate; no generated row is inserted into a hosted or disposable database.
for (const cap of [250, 500, 1000, 2000]) {
  for (const locale of ['en', 'ar']) {
    test(`bounded catalog pagination: ${cap} active, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
      await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), locale === 'ar' ? 'dark' : 'light')
      const active = Array.from({ length: cap }, (_, index) => ({
        id: `capacity-${index + 1}`, name: `Capacity item ${String(index + 1).padStart(5, '0')}`,
        sku: `CAP-${String(index + 1).padStart(5, '0')}`, barcode: null,
        sale_price: 35, category_id: null, category_name: null, created_at: '2026-10-29',
      }))
      const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
        if (name === 'shops') return [{ id: 'shop-1', name: 'Capacity fixture', business_mode: 'product', status: 'active', created_at: '2026-10-29' }]
        if (name === 'shop_permission_access') return { 'products.manage': true }
        if (name === 'list_catalog_categories') return []
        if (name !== 'list_products') return undefined
        expect(args.p_shop_id).toBe('shop-1')
        expect(args.p_page_size).toBe(20)
        const number = Number(args.p_page)
        expect(Number.isInteger(number) && number > 0).toBe(true)
        const term = String(args.p_search ?? '')
        const filtered = active.filter(row => row.name.includes(term) || row.sku.includes(term))
        const response = { items: filtered.slice((number - 1) * 20, number * 20), total: filtered.length, page: number, pageSize: 20 }
        expect(Buffer.byteLength(JSON.stringify(response))).toBeLessThan(16_384)
        return response
      })
      await fixtureGoto(page, '/products')
      const table = page.locator('.bs-data-table')
      await expect(table.locator('tbody tr')).toHaveCount(20)
      await expect(table.getByRole('cell', { name: 'Capacity item 00001', exact: true })).toBeVisible()
      await expectNoPageOverflow(page)
      await table.getByRole('button', { name: 'Next Page', exact: true }).click()
      await expect(table.getByRole('cell', { name: 'Capacity item 00021', exact: true })).toBeVisible()
      await expect(table.locator('tbody tr')).toHaveCount(20)
      await table.getByRole('button', { name: 'Last Page', exact: true }).click()
      await expect(table.getByRole('cell', { name: `Capacity item ${String(cap).padStart(5, '0')}`, exact: true })).toBeVisible()
      await expect(table.locator('tbody tr')).toHaveCount(cap % 20 || 20)
      await expect(table.getByRole('button', { name: 'Next Page', exact: true })).toBeDisabled()
      expect(calls.filter(call => call.name === 'list_products').at(-1)?.args.p_page).toBe(Math.ceil(cap / 20))
      await table.getByRole('searchbox').fill('CAP-00001')
      await expect(table.locator('tbody tr')).toHaveCount(1)
      await expect(table.getByRole('cell', { name: 'Capacity item 00001', exact: true })).toBeVisible()
      expect(calls.filter(call => call.name === 'list_products').at(-1)?.args).toMatchObject({ p_page: 1, p_page_size: 20, p_search: 'CAP-00001' })
      await table.getByRole('searchbox').fill('')
      await expect(table.locator('tbody tr')).toHaveCount(20)
      await expect(table.getByRole('cell', { name: 'Capacity item 00001', exact: true })).toBeVisible()
      await expectNoPageOverflow(page)
      // This page owns a fixed-size server query. Offering a different client
      // size would make page offsets disagree with the returned 20-row slice.
      await table.getByRole('combobox', { name: 'Rows per page', exact: true }).click()
      await expect(page.getByRole('option', { name: '50', exact: true })).toHaveCount(0)
      await expect(page.getByRole('option', { name: '10', exact: true })).toHaveCount(0)
      await page.keyboard.press('Escape')
    })
  }
}

for (const locale of ['en', 'ar']) {
  test(`shared service catalog retains fixed server pages: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_permission_access') return { 'services.manage': true }
      if (name === 'service_scheduling_options') return { locations: [], staff: [] }
      if (name === 'list_catalog_categories') return []
      if (name !== 'list_services_by_category') return undefined
      expect(args.p_shop_id).toBe('shop-1')
      expect(args.p_page_size).toBe(20)
      const rows = Array.from({ length: 45 }, (_, index) => ({ id: `service-${index + 1}`, name: `Capacity service ${index + 1}`, description: null, baseSalePrice: 35, defaultDiscountType: 'amount', defaultDiscountValue: 0, schedulingEnabled: false, categoryId: null, categoryName: null }))
      const filtered = rows.filter(row => row.name.includes(String(args.p_search ?? '')))
      const number = Number(args.p_page)
      return { items: filtered.slice((number - 1) * 20, number * 20), total: filtered.length, page: number, pageSize: 20 }
    })
    await fixtureGoto(page, '/services')
    const table = page.locator('.bs-data-table')
    await expect(table.locator('tbody tr')).toHaveCount(20)
    await table.getByRole('button', { name: 'Last Page', exact: true }).click()
    await expect(table.locator('tbody tr')).toHaveCount(5)
    await expect(table.getByRole('cell', { name: 'Capacity service 45', exact: true })).toBeVisible()
    expect(calls.filter(call => call.name === 'list_services_by_category').at(-1)?.args.p_page).toBe(3)
    await expectNoPageOverflow(page)
    await table.getByRole('combobox', { name: 'Rows per page', exact: true }).click()
    await expect(page.getByRole('option', { name: '50', exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: '10', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
  })
}
