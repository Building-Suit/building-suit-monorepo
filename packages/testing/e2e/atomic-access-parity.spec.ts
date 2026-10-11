import { mkdir } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { expectNoPageOverflow } from '../browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`access template configurations: ${locale}, ${theme}, ${width}`, async ({ browser }, testInfo) => {
    for (const suit of ['ledger', 'shop']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
      await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
      await context.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`http://127.0.0.1:4322/templates/access?suit=${suit}`)
      const memberTab = page.getByRole('tab', { name: locale === 'ar' ? /الأعضاء/ : /Members/ })
      await expect(memberTab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByText('Sample member', { exact: true })).toBeVisible()
      await expectNoPageOverflow(page)
      await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
      const screenshot = `.local/atomic-template-evidence/screenshots/${suit}-access-${locale}-${theme}-${width}.png`
      await page.screenshot({ path: screenshot, fullPage: true })
      await testInfo.attach(`${suit}-access`, { path: screenshot, contentType: 'image/png' })
      await memberTab.focus()
      await page.keyboard.press(locale === 'ar' ? 'ArrowLeft' : 'ArrowRight')
      const roleTab = page.getByRole('tab', { name: locale === 'ar' ? /الأدوار/ : /Roles/ })
      await expect(roleTab).toHaveAttribute('aria-selected', 'true')
      await expect(roleTab).toBeFocused()
      await page.getByRole('button', { name: locale === 'ar' ? 'تعديل' : 'Edit', exact: true }).click()
      const dialog = page.getByRole('dialog').first()
      await expect(dialog).toBeVisible()
      const locked = dialog.getByRole('checkbox', { name: locale === 'ar' ? 'قراءة' : 'Read', exact: true })
      await expect(locked).toBeChecked()
      await expect(locked).toBeDisabled()
      await dialog.getByRole('checkbox', { name: locale === 'ar' ? 'إدارة' : 'Manage', exact: true }).check()
      await page.keyboard.press('Escape')
      const confirmation = page.getByRole('dialog').last()
      await expect(confirmation).toContainText(locale === 'ar' ? 'تجاهل التغييرات غير المحفوظة؟' : 'Discard unsaved changes?')
      await confirmation.getByRole('button', { name: locale === 'ar' ? 'إلغاء' : 'Cancel', exact: true }).first().click()
      await expect(dialog.getByRole('checkbox', { name: locale === 'ar' ? 'إدارة' : 'Manage', exact: true })).toBeChecked()
      await dialog.getByRole('button', { name: locale === 'ar' ? 'حفظ' : 'Save', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await memberTab.click()
      await page.getByRole('button', { name: locale === 'ar' ? 'تعديل' : 'Edit', exact: true }).click()
      await expect(page.getByRole('dialog').locator('input[type=email]')).toHaveAttribute('readonly', '')
      await expect(page.getByRole('dialog').locator('input[type=email]')).toHaveValue('member@example.invalid')
      await page.getByRole('dialog').getByRole('button', { name: locale === 'ar' ? 'إلغاء' : 'Cancel', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expectNoPageOverflow(page)
      expect(errors).toEqual([])
      await context.close()
    }
  })
}
