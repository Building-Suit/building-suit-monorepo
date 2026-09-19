import { mkdir } from 'node:fs/promises'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

const evidence = 'docs/evidence/as-s1-01'
async function capture(page: Page, name: string, info: TestInfo) {
  await mkdir(evidence, { recursive: true })
  const path = `${evidence}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  await info.attach(name, { path, contentType: 'image/png' })
}
async function openJournal(page: Page) {
  const trigger = page.getByTestId('journals').getByRole('button', { name: /Open journal|فتح القيد/ }).first()
  const name = await trigger.getAttribute('aria-label')
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  return name!
}
async function openBank(page: Page, org = 'alpha') {
  await page.getByTestId(`account-${org}-bank`).click()
  await expect(page.getByTestId('account-panel')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  // The fixture must remain fully synthetic, even if a developer has .env keys.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.protocol.startsWith('http') && url.origin !== 'http://127.0.0.1:3216') throw new Error(`Unexpected external request to ${url.origin}`)
    await route.continue()
  })
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-hydrated', 'true')
})

test('journal/account/back/close preserve filters, dates, sort, page, note, scroll and focus', async ({ page }, info) => {
  await page.getByTestId('review-note').fill('Unsent review note — ملاحظة')
  await page.getByTestId('search').fill('J-0')
  await page.getByTestId('from').fill('2026-01-03')
  await page.getByTestId('to').fill('2026-02-07')
  await page.getByTestId('journals').getByRole('columnheader', { name: 'Reference' }).click()
  await page.getByTestId('journals').getByRole('button', { name: 'Next Page', exact: true }).click()
  const rows = await page.getByTestId('journals').getByRole('row').allTextContents()
  await page.getByTestId('journals').getByRole('button', { name: /Open journal/ }).first().scrollIntoViewIfNeeded()
  const pageScroll = await page.evaluate(() => scrollY)
  expect(pageScroll).toBeGreaterThan(0)
  const triggerName = await openJournal(page)
  const title = await page.getByRole('dialog').getAttribute('aria-labelledby')
  await capture(page, 'en-journal', info)
  await openBank(page)
  await expect(page.getByTestId('account-heading')).toBeFocused()
  await expect(page.getByRole('dialog').getByRole('table')).toBeVisible()
  await expect(page.getByTestId('account-panel')).toContainText('1102')
  await capture(page, 'en-account', info)
  await page.getByRole('button', { name: 'Back to journal', exact: true }).first().click()
  await expect(page.getByTestId('account-alpha-bank')).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-labelledby', title!)
  await openBank(page)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('account-panel')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: triggerName, exact: true })).toBeFocused()
  expect(await page.evaluate(() => scrollY)).toBe(pageScroll)
  expect(await page.getByTestId('journals').getByRole('row').allTextContents()).toEqual(rows)
  await expect(page.getByTestId('search')).toHaveValue('J-0')
  await expect(page.getByTestId('from')).toHaveValue('2026-01-03')
  await expect(page.getByTestId('to')).toHaveValue('2026-02-07')
  await expect(page.getByTestId('review-note')).toHaveValue('Unsent review note — ملاحظة')
})

test('stable IDs select different accounts even with identical display names', async ({ page }) => {
  await page.getByTestId('custom-name').fill('Rent expense')
  await openJournal(page)
  await openBank(page)
  await expect(page.getByTestId('account-heading')).toContainText('1102')
  await page.getByRole('button', { name: 'Back to journal', exact: true }).first().click()
  await page.getByTestId('account-alpha-rent').click()
  await expect(page.getByTestId('account-heading')).toContainText('6101')
})

test('loading, error/retry, not found, denied and empty are reviewable without financial actions', async ({ page }, info) => {
  for (const scenario of ['error', 'missing', 'denied', 'empty'] as const) {
    await page.getByTestId('scenario').selectOption(scenario)
    await openJournal(page)
    await openBank(page)
    if (scenario === 'error') {
      await expect(page.getByRole('alert')).toContainText('Sample account could not be loaded')
      await capture(page, 'en-error', info)
      await page.getByRole('button', { name: 'Retry' }).click()
      await expect(page.getByRole('dialog').getByRole('table')).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
    }
    else {
      const message = scenario === 'missing' ? 'This sample account is not available.' : scenario === 'denied' ? 'This simulated reviewer cannot read account details.' : 'No sample entries in this period.'
      await expect(page.getByText(message, { exact: true })).toBeVisible()
      await capture(page, `en-${scenario}`, info)
    }
    await expect(page.getByRole('dialog').getByRole('button', { name: /post|reverse|approve|save/i })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  }
})

test('slow account reads are cancelled on account change, organization change, close and session end', async ({ page }, info) => {
  await page.getByTestId('scenario').selectOption('slow')
  await page.getByTestId('review-note').fill('Private review note')
  await openJournal(page)
  await openBank(page)
  await expect(page.getByTestId('account-panel').getByRole('status')).toContainText('Loading sample account')
  await capture(page, 'en-loading', info)
  await page.getByRole('button', { name: 'Back to journal', exact: true }).first().click()
  await page.getByTestId('account-alpha-rent').click()
  await expect(page.getByTestId('account-heading')).toContainText('6101')
  await page.getByTestId('dialog-organization').selectOption('beta')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('review-note')).toHaveValue('')
  await expect(page.getByTestId('organization-name')).toHaveText('Delta Services')
  await openJournal(page)
  await openBank(page, 'beta')
  await expect(page.getByRole('dialog').getByRole('table')).toBeVisible()
  await expect(page.getByTestId('account-panel')).not.toContainText('Rent expense')
  await page.getByRole('button', { name: 'Back to journal', exact: true }).click()
  await openBank(page, 'beta')
  await expect(page.getByTestId('account-panel').getByRole('status')).toContainText('Loading sample account')
  await page.getByTestId('end-session').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('journals')).toHaveCount(0)
  await page.getByRole('button', { name: 'Start review session' }).click()
  await openJournal(page)
  await openBank(page, 'beta')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  // Wait longer than the deliberately delayed fixture response, then assert no revival.
  await page.waitForTimeout(1300)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByTestId('account-panel')).toHaveCount(0)
})

for (const locale of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${locale}/${theme}: responsive review, keyboard return and independent demo names`, async ({ page }, info) => {
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme)
      await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption(locale)
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await openJournal(page)
      await expect(page.getByTestId('account-alpha-bank')).toHaveText(locale === 'ar' ? 'بنك التشغيل' : 'Operating bank')
      await expect(page.getByTestId('account-alpha-rent')).toHaveText(locale === 'ar' ? 'مصروف الإيجار' : 'Rent expense')
      // A shorter viewport forces real scrolling; restore review size for the capture.
      await page.setViewportSize({ width: 390, height: 560 })
      const scrollBefore = await page.getByTestId('journal-panel').evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop })
      expect(scrollBefore).toBeGreaterThan(0)
      await openBank(page)
      await expect(page.getByRole('dialog').getByRole('table')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.setViewportSize({ width: 390, height: 844 })
      await capture(page, `${locale}-${theme}-mobile`, info)
      await page.setViewportSize({ width: 390, height: 560 })
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('account-alpha-bank')).toBeFocused()
      expect(await page.getByTestId('journal-panel').evaluate(el => el.scrollTop)).toBe(scrollBefore)
      await page.keyboard.press('Escape')
      await page.getByTestId('custom-name').fill('My Bank / بنكي')
      await openJournal(page)
      await expect(page.getByTestId('account-alpha-bank')).toHaveText('My Bank / بنكي')
    })
  }
}

test('refresh explicitly starts a fresh synthetic review with no persisted note or selection', async ({ page }) => {
  await page.getByTestId('review-note').fill('Not persisted')
  await openJournal(page)
  await openBank(page)
  await page.reload()
  await expect(page.getByTestId('review-note')).toHaveValue('')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Refreshing this preview starts a new review. Notes are not saved.')).toBeVisible()
})
