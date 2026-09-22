import { expect, test } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import { parseCsv, serializeCsv } from '../../app/utils/csv'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

for (const language of ['en', 'ar'] as const) {
  test(`${language}: localized template, real import, duplicate protection, modal context and all five report downloads`, async ({ page }) => {
    test.setTimeout(90_000)
    const copy = language === 'ar' ? ar : en
    await page.goto('/login')
    await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
    await page.getByLabel('Email').fill('owner@alpha.test')
    await page.getByLabel('Password').fill('ledgersuit')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/dashboard')
    const sourcePromise = page.waitForRequest(request => request.url().includes('/rest/v1/account_balances?'))
    await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
    const source = await sourcePromise
    const backend = new URL(source.url()).origin
    expect(['http://127.0.0.1:60321', 'http://127.0.0.1:65321']).toContain(backend)
    const organizationId = new URL(source.url()).searchParams.get('organization_id')!.replace('eq.', '')
    const auth = await source.allHeaders()
    const headers = { apikey: auth.apikey!, authorization: auth.authorization! }
    async function rpc(name: string, data: Record<string, unknown>) {
      const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, { headers, data: { p_organization_id: organizationId, ...data } })
      expect(response.ok(), `${name}: ${response.status()}`).toBe(true)
      return response.json()
    }
    const stamp = Date.now()
    const accountName = `${language === 'ar' ? 'بنك الاستيراد' : 'Import bank'} ${stamp}`
    const bank = await rpc('create_account', { p_name: accountName, p_type: 'asset', p_subtype: 'bank' })
    const revenue = await rpc('create_account', { p_name: `CSV Revenue ${stamp}`, p_type: 'revenue', p_subtype: 'service_revenue' })
    const expense = await rpc('create_account', { p_name: `CSV Expense ${stamp}`, p_type: 'expense', p_subtype: 'professional_fees' })
    const categoryNames = [`CSV Revenue ${stamp}`, `CSV Expense ${stamp}`]
    const categories = await page.request.get(`${backend}/rest/v1/categories?organization_id=eq.${organizationId}&default_account_id=in.(${revenue},${expense})&select=name`, { headers })
    expect(categories.ok()).toBe(true)
    expect((await categories.json()).map((row: { name: string }) => row.name).sort()).toEqual([...categoryNames].sort())
    const description = `${language === 'ar' ? 'استيراد تجريبي' : 'CSV example'} ${stamp}`
    await page.goto(`/transactions?account=${bank}&q=${encodeURIComponent(description)}`)
    await expect(page.locator('#type')).toBeEnabled()
    if (language === 'ar') {
      await page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await page.getByRole('button', { name: 'Dark', exact: true }).click()
      await page.getByRole('button', { name: 'العربية', exact: true }).click()
      await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
    }
    const originalUrl = page.url()
    const openButton = page.getByRole('button', { name: copy.imports.entryPoint, exact: true })
    await openButton.click()
    const dialog = page.getByRole('dialog', { name: copy.imports.title })
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(originalUrl)
    await mkdir('docs/evidence/as-ux-02', { recursive: true })
    await page.screenshot({ path: `docs/evidence/as-ux-02/${language}-import-modal.png`, fullPage: true })
    const downloading = page.waitForEvent('download')
    await dialog.getByRole('button', { name: copy.csv.downloadTemplate }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toBe(`${copy.csv.filenames.template}.csv`)
    const template = await readFile((await download.path())!, 'utf8')
    expect(template.startsWith('\uFEFF')).toBe(true)
    const parsed = parseCsv(template)
    expect(parsed.headers).toContain(copy.csv.columns.category)
    expect(parsed.rows[0]![copy.csv.columns.type]).toBe(copy.types.income)
    const rows = parsed.rows.map((row, index) => ({ ...row,
      [copy.csv.columns.account]: accountName,
      [copy.csv.columns.category]: categoryNames[index]!,
      [copy.csv.columns.description]: `${description} ${index}`,
      [copy.csv.columns.date]: language === 'ar' ? '٢٠٢٦-٠٩-١٩' : '2026-09-19',
      [copy.csv.columns.amount]: language === 'ar' ? (index ? '٢٥٫٠٠' : '١٠٠٫٠٠') : (index ? '25.00' : '100.00'),
    }))
    const buffer = Buffer.from('\uFEFF' + serializeCsv([parsed.headers, ...rows.map(row => parsed.headers.map(header => row[header]!))]))
    async function upload() {
      await dialog.locator('#csv-file').setInputFiles({ name: `${copy.csv.filenames.template}.csv`, mimeType: 'text/csv', buffer })
      await expect(dialog.getByRole('heading', { name: copy.imports.mappingTitle })).toBeVisible()
      await expect(dialog.getByRole('button', { name: copy.imports.validate, exact: true })).toBeEnabled()
      await dialog.getByRole('button', { name: copy.imports.validate, exact: true }).click()
      await expect(dialog.getByRole('heading', { name: copy.imports.validationTitle })).toBeVisible()
    }
    await upload()
    await expect(dialog.getByRole('table')).toContainText(copy.types.income)
    await expect(dialog.getByRole('table')).toContainText(copy.types.expense)
    await dialog.getByRole('button', { name: copy.imports.confirm, exact: true }).click()
    await expect(dialog.getByRole('heading', { name: copy.imports.resultsTitle })).toBeVisible()
    await expect(dialog.getByRole('table').getByText(copy.status.posted, { exact: true })).toHaveCount(2)
    await dialog.getByRole('button', { name: copy.imports.importAnother, exact: true }).click()
    await upload()
    await expect(dialog.getByRole('table').getByText(copy.status.duplicate, { exact: true })).toHaveCount(2)
    await dialog.getByRole('button', { name: copy.imports.confirm, exact: true }).click()
    await expect(dialog.getByRole('heading', { name: copy.imports.resultsTitle })).toBeVisible()
    await dialog.getByRole('button', { name: copy.csv.close, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(openButton).toBeFocused()
    await expect(page).toHaveURL(originalUrl)
    await expect(page.locator('#account')).toHaveValue(bank)
    await expect(page.getByRole('table')).toContainText(`${description} 0`)
    const transactions = await page.request.get(`${backend}/rest/v1/transactions?organization_id=eq.${organizationId}&description=like.${encodeURIComponent(description)}*&select=id`, { headers })
    expect((await transactions.json()).length).toBe(2)
    // Source cells and localized digits remain stored alongside normalized validator values.
    const imports = await page.request.get(`${backend}/rest/v1/import_rows?organization_id=eq.${organizationId}&raw_data->>${encodeURIComponent(copy.csv.columns.description)}=eq.${encodeURIComponent(description + ' 0')}&select=raw_data`, { headers })
    const saved = await imports.json()
    expect(saved[0].raw_data[copy.csv.columns.amount]).toBe(rows[0]![copy.csv.columns.amount])

    await page.getByRole('link', { name: copy.nav.reports, exact: true }).first().click()
    const reports = [
      ['overview', 'trial_balance', copy.csv.columns.account_type], ['profitLoss', 'profit_loss', copy.csv.columns.section],
      ['balanceSheet', 'balance_sheet', copy.csv.columns.classification_id], ['cashFlow', 'cash_flow', copy.csv.columns.activity],
      ['ledger', 'general_ledger', copy.csv.columns.running_balance],
    ] as const
    for (const [tab, report, expectedHeader] of reports) {
      await page.getByRole('tab', { name: copy.reports.tabs[tab], exact: true }).click()
      if (['profit_loss', 'cash_flow', 'general_ledger'].includes(report)) {
        await page.locator('#from').fill('2026-09-01'); await page.locator('#to').fill('2026-09-30')
      }
      else await page.locator('#asof').fill('2026-09-30')
      if (report === 'general_ledger') await page.locator('#ledger-account').selectOption(bank)
      const filePromise = page.waitForEvent('download')
      await page.getByRole('tabpanel', { name: copy.reports.tabs[tab], exact: true }).getByRole('button', { name: copy.common.exportCsv, exact: true }).click()
      const file = await filePromise
      expect(file.suggestedFilename()).toContain(copy.csv.filenames[report])
      const contents = await readFile((await file.path())!, 'utf8')
      expect(contents.startsWith('\uFEFF')).toBe(true)
      const csv = parseCsv(contents, { allowEmpty: true })
      expect(csv.headers).toContain(expectedHeader)
      if (report === 'trial_balance') expect(contents).toContain(copy.accounts.groups.asset)
      if (report === 'profit_loss') expect(contents).toContain(copy.reports.revenue)
      if (report === 'cash_flow') expect(contents).toContain(copy.reports.cashFlowSections.operating)
      if (report === 'general_ledger') { expect(contents).toContain(description); expect(contents).toContain('75.00') }
    }
  })
}
