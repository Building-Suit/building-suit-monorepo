import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import { completePasswordSignIn } from './password-sign-in'

const fixture = process.env.LEDGER_BROWSER_DISPOSABLE_TEST === '1' ? JSON.parse(readFileSync(fileURLToPath(new URL('../../../../.local/verification/journal-precision/fixture.json', import.meta.url)), 'utf8')) as { task: string; bank: string; journal: string; expected_minor: string; expected_assets_display: string; description: string } : null
if (fixture && fixture.task !== 'LS-FIN-PRECISION-002') throw new Error('Owned native precision fixture required')
for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: actual huge journal list, details, filters and dashboard remain exact`, async ({ page, context }) => {
    test.skip(!fixture, 'Requires the explicitly owned native precision fixture')
    if (!fixture) throw new Error('Native fixture required')
    const copy = locale === 'ar' ? ar : en
    await context.addCookies(['building-suit-locale', 'i18n_redirected'].map(name => ({ name, value: locale, domain: '127.0.0.1', path: '/' })))
    await page.goto('/login')
    await completePasswordSignIn(page, 'owner@alpha.test', 'ledgersuit', locale)
    await expect(page).toHaveURL('/dashboard')
    const response = await page.goto(`/transactions?account=${fixture.bank}`)
    expect(response?.status()).toBe(200)
    const row = page.getByRole('row').filter({ hasText: fixture.description })
    await expect(row).toContainText('90,071,992,547,409.93')
    await row.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('LS-FIN-PRECISION-002 bank')
    await expect(dialog).toContainText('LS-FIN-PRECISION-002 equity')
    await expect(dialog).toContainText('90,071,992,547,409.93')
    await dialog.getByRole('button', { name: copy.common.close, exact: true }).click()
    await page.getByRole('button', { name: copy.transactionWorkspace.moreFilters, exact: true }).click()
    const min = page.getByLabel(copy.transactions.minAmount, { exact: true })
    const max = page.getByLabel(copy.transactions.maxAmount, { exact: true })
    await min.fill(locale === 'ar' ? '٩٠٠٧١٩٩٢٥٤٧٤٠٩٫٩٣' : '90071992547409.93')
    await max.fill('90071992547409.93')
    await expect(row).toBeVisible()
    await max.fill('90071992547409.92')
    await expect(page.getByRole('alert')).toContainText(copy.transactionWorkspace.validation.amounts)
    await max.fill('90071992547409.94')
    await min.fill('90071992547409.94')
    await expect(page.getByText(copy.transactions.noMatchTitle, { exact: true })).toBeVisible()
    await min.fill('90071992547409.93')
    await expect(row).toContainText('90,071,992,547,409.93')
    await max.fill('92233720368547758.08')
    await expect(page.getByRole('alert')).toContainText(copy.transactionWorkspace.validation.amounts)
    await max.fill('90071992547409.93')
    await expect(row).toContainText('90,071,992,547,409.93')
    const dashboard = await page.goto('/dashboard')
    expect(dashboard?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: copy.dashboard.title })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'LS-FIN-PRECISION-002 bank' }).first()).toContainText('90,071,992,547,409.93')
    await expect(page.getByText(fixture.expected_assets_display, { exact: false }).first()).toBeVisible()
    await page.goto(`/transactions?account=${fixture.bank}`)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button').filter({ hasText: fixture.description }).last()).toContainText('90,071,992,547,409.93')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  })
}
