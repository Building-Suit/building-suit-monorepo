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
    const activePeriod = page.getByRole('button', { name: locale === 'ar' ? 'يوم' : 'Day', exact: true })
    await expect(activePeriod).toHaveAttribute('aria-pressed', 'true')
    await activePeriod.hover()
    const contrast = await activePeriod.evaluate(element => {
      const style = getComputedStyle(element)
      const luminance = (color: string) => {
        const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const channel = value / 255
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
        })
        return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722
      }
      const foreground = luminance(style.color), background = luminance(style.backgroundColor)
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
    })
    expect(contrast).toBeGreaterThanOrEqual(4.5)
    const inactivePeriod = page.getByRole('button', { name: locale === 'ar' ? 'شهر' : 'Month', exact: true })
    await expect(inactivePeriod).toHaveAttribute('aria-pressed', 'false')
    // Cards paint a gradient, so their background-color is transparent. The
    // period controls belong to the surface toolbar, not the first metric card.
    const toolbar = page.getByRole('toolbar').filter({ has: inactivePeriod })
    const surface = await toolbar.evaluate(element => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = 'var(--bs-surface)'
      element.append(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })
    await expect(panel).not.toHaveCSS('background-image', 'none')
    await expect(toolbar).toHaveCSS('background-color', surface)
    await expect(inactivePeriod).toHaveCSS('background-color', surface)
    expect(await activePeriod.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(surface)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('shared-dashboard.png'), fullPage: true })
  })
}
