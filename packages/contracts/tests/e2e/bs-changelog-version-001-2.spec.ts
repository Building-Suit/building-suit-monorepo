import { test, expect } from '@playwright/test'
for (const locale of ['en','ar'] as const) {
  for (const theme of ['light','dark'] as const) {
    test(`${locale} ${theme}: shared timeline, filters, keyboard, states and responsive layout`, async ({ page }, testInfo) => {
      await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4392' }])
      await page.addInitScript(theme => { localStorage.setItem('building-suit.theme',theme); Date.now = () => 0 },theme)
      await page.goto('/components')
      const timeline = page.locator('#changelog .bs-changelog')
      await expect(timeline).toHaveAttribute('dir',locale === 'ar' ? 'rtl' : 'ltr')
      await expect(timeline.locator('article')).toHaveCount(5)
      await expect(timeline.getByText(locale === 'ar' ? 'جديد' : 'New',{exact:true})).toHaveCount(3)
      const filters = timeline.locator('select')
      await filters.nth(0).focus()
      await page.keyboard.press('Tab')
      await expect(filters.nth(1)).toBeFocused()
      for (const suit of ['shop','ledger','inventory','automation','future']) {
        await filters.nth(0).selectOption(`${suit}-suit`)
        await expect(timeline.locator('article')).toHaveCount(1)
        await expect(timeline.locator('article')).toHaveAttribute('data-entry',`example-${suit}`)
      }
      await filters.nth(0).selectOption('')
      await filters.nth(1).selectOption('coming-soon')
      await expect(timeline.locator('article')).toHaveCount(2)
      await expect(timeline.getByText(locale === 'ar' ? 'جديد' : 'New',{exact:true})).toHaveCount(0)
      await expect(timeline.locator('bdi').first()).toContainText('1.1.0-beta.1')
      await filters.nth(0).selectOption('shop-suit')
      await expect(timeline.getByRole('status')).toContainText(locale === 'ar' ? 'لا توجد تحديثات' : 'No updates')
      await filters.nth(0).selectOption('')
      await filters.nth(1).selectOption('')
      const section = page.locator('#changelog')
      for (const state of ['loading','error','denied']) {
        await section.getByRole('button',{name:state,exact:true}).click()
        await expect(timeline.locator('article')).toHaveCount(0)
        await expect(timeline.locator('[data-state]')).toHaveAttribute('data-state',state)
      }
      await section.getByRole('button',{name:'error',exact:true}).click()
      await timeline.getByRole('button',{name:locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}).click()
      await expect(timeline.locator('article')).toHaveCount(5)
      await section.scrollIntoViewIfNeeded()
      await section.screenshot({path:testInfo.outputPath(`${locale}-${theme}-desktop.png`)})
      await page.setViewportSize({width:390,height:844})
      await section.scrollIntoViewIfNeeded()
      await expect(timeline).toBeVisible()
      expect(await timeline.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy()
      await section.screenshot({path:testInfo.outputPath(`${locale}-${theme}-mobile.png`)})
    })
  }
}
