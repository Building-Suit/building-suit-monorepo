import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) for (const observer of [true, false]) {
  test(`compact queue ${observer ? 'observer' : 'blocked operator'}: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'platform_admin_session') return { userId: 'synthetic-admin', role: observer ? 'observer' : 'operator', canMutate: !observer, displayName: 'Synthetic reviewer' }
      if (name === 'platform_admin_read') return args.p_resource === 'dashboard' ? { shops: 1, activeShops: 1, recentEvents: [] } : { items: [], total: 0 }
      if (name === 'platform_admin_billing_read') return args.p_resource === 'queue' ? { items: [{ id: 'submission-1', shopId: 'tenant-1', shopName: 'Synthetic tenant', status: 'under_review', currentPlanName: 'Existing plan', requestedPlanName: 'Requested plan', billingInterval: 'monthly', listPriceAmount: 399, effectivePriceAmount: 349, priceSource: 'override', paidAmount: 300, currency: 'EGP', usageBlockers: [{ resource: 'Synthetic plan capacity blocker', used: 4, limit: 2, excess: 2 }], transferReference: 'CLOUD-REF-1', transferDate: '2026-10-01' }], total: 1 } : args.p_resource === 'configuration' ? {} : args.p_resource === 'summary' ? { open: 1 } : { items: [], total: 0 }
      return undefined
    })
    await fixtureGoto(page, '/platform-admin')
    await page.getByRole('button', { name: ar ? 'قائمة الفوترة' : 'Billing queue', exact: true }).click()
    const row = page.getByRole('row').filter({ hasText: 'Synthetic tenant' })
    await expect(row.getByRole('cell')).toHaveCount(observer ? 3 : 4)
    await expect(row).toContainText(ar ? 'قيد المراجعة' : 'Under review')
    for (const text of ['Existing plan', 'Requested plan', 'CLOUD-REF-1', 'Synthetic plan capacity blocker']) await expect(row).toContainText(text)
    await expect(row).toContainText(/399|٣٩٩/)
    await expect(row).toContainText(/349|٣٤٩/)
    await expect(row).toContainText(/300|٣٠٠/)
    const approve = row.getByRole('button', { name: ar ? 'اعتماد وتفعيل' : 'Approve and activate', exact: true })
    if (observer) {
      await expect(row.getByRole('button')).toHaveCount(0)
    } else {
      await expect(approve).toBeDisabled()
      await approve.scrollIntoViewIfNeeded()
      const box = await approve.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      await expect(row.getByRole('button', { name: ar ? 'رفض' : 'Reject', exact: true })).toBeVisible()
    }
    expect(calls.filter(call => call.name === 'platform_admin_billing_command')).toHaveLength(0)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('compact-queue-capabilities.png'), fullPage: true, animations: 'disabled' })
  })
}
