import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

async function signIn(page: Page, copy: typeof en) {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true', { timeout: 20_000 })
  await page.getByLabel(copy.auth.email).fill('owner@alpha.test')
  await page.getByLabel(copy.auth.password).fill('ledgersuit')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: opening Trial Balance import, validation, posting, locking, and correction`, async ({ page, context }) => {
    test.setTimeout(120_000)
    const copy = locale === 'ar' ? ar : en
    if (locale === 'ar') await context.addCookies([
      { name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' },
      { name: 'i18n_redirected', value: 'ar', domain: '127.0.0.1', path: '/' },
    ])
    await signIn(page, copy)
    const accountRequest = page.waitForRequest(request => request.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: copy.nav.accounts, exact: true }).first().click()
    const source = await accountRequest
    const backend = new URL(source.url()).origin
    const organizationId = new URL(source.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const auth = await source.allHeaders()
    const headers = { apikey: auth.apikey!, authorization: auth.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data: { p_organization_id: organizationId, ...data } })
      const payload = await response.json()
      expect(response.ok(), `${name}: ${response.status()} ${JSON.stringify(payload)}`).toBe(true)
      return payload as string
    }
    const stamp = `${locale}${Date.now().toString().slice(-7)}`
    const cash = await rpc('create_account', { p_name: `Opening cash ${stamp}`, p_type: 'asset', p_subtype: 'cash', p_code: `OC${stamp}` })
    const equity = await rpc('create_account', { p_name: `Opening equity ${stamp}`, p_type: 'equity', p_subtype: 'other_equity', p_code: `OE${stamp}` })
    const year = locale === 'en' ? 2094 : 2095
    const cutoff = `${year}-12-31`

    await page.goto('/opening-balances')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.getByRole('heading', { level: 1, name: copy.opening.title })).toBeVisible()
    await page.locator('#opening-cutoff').fill(cutoff)
    const invalidCsv = `${copy.opening.sourceCode},${copy.opening.sourceName},${copy.opening.debit},${copy.opening.credit}\nSRC-CASH,Cash,100.00,\nSRC-EQ,Equity,,99.99`
    await page.locator('#opening-file').setInputFiles({ name: `opening-${stamp}-invalid.csv`, mimeType: 'text/csv', buffer: Buffer.from(invalidCsv) })
    await page.getByLabel(`${copy.opening.ledgerAccount} 1`).selectOption(cash)
    await page.getByLabel(`${copy.opening.ledgerAccount} 2`).selectOption(equity)
    await page.getByRole('button', { name: copy.opening.validate, exact: true }).click()
    const validation = page.locator('[data-validation="invalid"]')
    await expect(validation).toContainText(copy.opening.errors.OPENING_BATCH_UNBALANCED)
    await expect(validation).toContainText(copy.opening.difference)

    const validCsv = `${copy.opening.sourceCode},${copy.opening.sourceName},${copy.opening.debit},${copy.opening.credit}\nSRC-CASH,Cash,100.00,\nSRC-EQ,Equity,,100.00`
    await page.locator('#opening-file').setInputFiles({ name: `opening-${stamp}.csv`, mimeType: 'text/csv', buffer: Buffer.from(validCsv) })
    await page.getByLabel(`${copy.opening.ledgerAccount} 1`).selectOption(cash)
    await page.getByLabel(`${copy.opening.ledgerAccount} 2`).selectOption(equity)
    await page.getByRole('button', { name: copy.opening.validate, exact: true }).click()
    await expect(page.locator('[data-validation="valid"]')).toContainText(copy.opening.validationPassed)
    const preview = page.locator('section[aria-labelledby="opening-preview"]')
    await expect(preview.getByRole('heading', { name: `5. ${copy.opening.preview}` })).toBeVisible()
    await expect(preview.getByRole('cell', { name: new RegExp(`OC${stamp}`) })).toBeVisible()
    await page.getByRole('button', { name: copy.opening.approve, exact: true }).click()
    await expect(page.locator('[data-opening-posted]')).toContainText(copy.opening.postedLocked)
    await expect(page.locator('article[data-batch-status="posted"]').first()).toContainText(copy.opening.status.posted)

    const posted = page.locator('article[data-batch-status="posted"]').first()
    await posted.getByLabel(copy.opening.correctionReason).fill(locale === 'ar' ? 'تصحيح مصدر الافتتاح' : 'Opening source correction')
    await posted.getByLabel(copy.opening.reversalDate).fill(`${year + 1}-01-01`)
    await posted.getByRole('button', { name: copy.opening.reverse, exact: true }).click()
    await expect(page.locator('article[data-batch-status="reversed"]').first()).toContainText(copy.opening.status.reversed)
    await expect(page.locator('article[data-batch-status="reversed"]').first()).toContainText(copy.opening.reversal)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
