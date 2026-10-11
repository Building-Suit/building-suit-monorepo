import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 test(`canonical template catalogue: ${locale}, ${theme}, ${width}`, async ({ page, context }) => {
  await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4322/templates')
  await expect(page.getByRole('heading', { name: locale === 'ar' ? 'قوالب الصفحات المشتركة' : 'Shared page templates', exact: true })).toBeVisible()
  for (const template of ['BsWorkspaceShell', 'BsReportsPage', 'BsJournalWorkspacePage', 'BsFinancialAccountsPage', 'BsAccessManagementPage']) await expect(page.getByRole('cell', { name: template, exact: true })).toBeVisible()
  await expectNoPageOverflow(page)
  expect(errors).toEqual([])
 })
}
