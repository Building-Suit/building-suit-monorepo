import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`shared workspace navigation and card surfaces: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale, 'owner', name => name === 'shop_team_read' ? { canManage: true, canManagePermissions: true, canViewAudit: true, permissionKeys: [], grantablePermissionKeys: [], members: [], roles: [], locations: [], invitations: [], events: [] } : undefined)
    await fixtureGoto(page, '/team')
    const tabs = page.getByRole('tablist').getByRole('tab')
    const bounds = await tabs.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top))
    expect(bounds.length).toBeGreaterThan(1)
    expect(Math.max(...bounds) - Math.min(...bounds)).toBeLessThan(2)
    if (width < 1024) await page.getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu', exact: true }).click()
    const dashboard = page.locator('#bs-primary-navigation nav').getByRole('link', { name: locale === 'ar' ? 'التقارير ونظرة عامة' : 'Reports & overview', exact: true, includeHidden: true })
    await expect(dashboard).toHaveAttribute('href', '/dashboard')
    await dashboard.click()
    await expect(page).toHaveURL(/\/dashboard(?:[?#]|$)/)
    await expect(page.getByRole('heading', { level: 1, name: locale === 'ar' ? 'لوحة التحكم' : 'Operating dashboard' })).toBeVisible()
    await expect(dashboard).toHaveAttribute('aria-current', 'page')
    const panel = page.locator('.bs-panel').first()
    await expect(panel).toBeVisible()
    const geometry = await panel.evaluate(element => {
      const style = getComputedStyle(element)
      return { radius: parseFloat(style.borderTopLeftRadius), start: style.borderInlineStartWidth, end: style.borderInlineEndWidth, gap: parseFloat(style.gap) }
    })
    expect(geometry.radius).toBeGreaterThan(0)
    expect(geometry.start).toBe(geometry.end)
    expect(geometry.gap).toBeGreaterThan(0)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('shared-dashboard.png'), fullPage: true })
  })
}
