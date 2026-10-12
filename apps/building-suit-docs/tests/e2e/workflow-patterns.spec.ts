import { test, expect } from '@playwright/test'

test('shared workflows retain controlled navigation, row limits, focus and print semantics', async ({ page }) => {
  await page.goto('/components')
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Workflow and presentation families', exact: true }) }).last()
  await expect(section).toBeVisible()
  await section.getByText('Setup checklist', { exact: true }).click()
  await expect(section.getByText('Invite your team', { exact: true })).toBeVisible()
  const wizard = section.getByRole('region', { name: 'Import records', exact: true })
  await wizard.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(wizard.getByRole('combobox', { name: 'Name', exact: true })).toBeVisible()
  await wizard.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(wizard.getByText('Row 2: name is required')).toBeVisible()
  await wizard.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(wizard.getByText('Import complete', { exact: true })).toBeVisible()
  await wizard.getByRole('button', { name: 'Start again', exact: true }).click()
  await expect(wizard.getByText('Choose or drop a file')).toBeVisible()
  await section.getByRole('button', { name: 'Collapse: Workspace', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Operations', exact: true })).toHaveCount(0)
  await section.getByRole('button', { name: 'Expand: Workspace', exact: true }).click()
  await expect(section.getByRole('button', { name: 'Operations', exact: true })).toBeVisible()
  const editor = section.getByRole('region', { name: 'Line items', exact: true })
  await expect(editor.getByRole('button', { name: /Remove line/ })).toHaveCount(0)
  await editor.getByRole('button', { name: 'Add line', exact: true }).click()
  await expect(editor.getByRole('spinbutton')).toHaveCount(2)
  await editor.getByRole('button', { name: 'Remove line: Line 2', exact: true }).click()
  await expect(editor.getByRole('spinbutton')).toHaveCount(1)
  await section.getByRole('button', { name: 'Invite', exact: true }).last().click()
  const dialog = page.getByRole('dialog', { name: 'Invite member' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Email' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await section.getByRole('switch', { name: 'Pending actions' }).check()
  await expect(editor.getByRole('button', { name: 'Add line' })).toBeDisabled()
  await expect(section.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled()
  await section.getByRole('switch', { name: 'Pending actions' }).uncheck()
  await page.emulateMedia({ media: 'print' })
  await expect(section.getByRole('button', { name: 'Print', exact: true })).toBeHidden()
  await expect(section.getByRole('article', { name: 'Example receipt' })).toBeVisible()
  await page.emulateMedia({ media: 'screen' })
})

for (const locale of ['en', 'ar']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      test(`catalogue ${locale} ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
        await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
        await page.goto('/components')
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
        const heading = locale === 'ar' ? 'عائلات العرض وسير العمل' : 'Workflow and presentation families'
        const section = page.locator('section').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).last()
        await expect(section).toBeVisible()
        await section.scrollIntoViewIfNeeded()
        await section.screenshot({ path: testInfo.outputPath('workflow-catalogue.png') })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
        const state = section.getByRole('combobox', { name: locale === 'ar' ? 'حالة المثال' : 'Example state' })
        for (const value of ['loading', 'error', 'empty']) {
          await state.click()
          await page.getByRole('option', { name: value, exact: true }).click()
          if (value === 'error') await expect(section.getByText(locale === 'ar' ? 'الأعضاء غير متاحين' : 'Members unavailable', { exact: true })).toBeVisible()
        }
      })
    }
  }
}
