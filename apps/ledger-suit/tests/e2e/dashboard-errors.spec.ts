import { expect, test, type Page, type Route } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel('Email').fill('owner@alpha.test')
  await page.getByLabel('Password').fill('ledgersuit')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

async function switchToArabic(page: Page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await page.getByRole('button', { name: 'العربية', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
}

function transaction(description = 'Recovered dashboard transaction') {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    organization_id: 'a0000000-1111-4000-8000-000000000001',
    description,
    transaction_date: '2026-09-01',
    type: 'income',
    status: 'posted',
    amount_minor: 1000,
    currency_code: 'EGP',
    category_name: null,
    from_account_name: 'Revenue',
    to_account_name: 'Bank',
    total_count: 1,
  }
}

async function fail(route: Route) {
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ code: '57014', message: 'canceling statement due to statement timeout' }),
  })
}

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: a successful empty recent read is distinct from loading and shows the empty-company CTA`, async ({ page }) => {
    let release!: () => void
    const waiting = new Promise<void>((resolve) => { release = resolve })
    await page.route('**/rest/v1/rpc/search_transactions', async (route) => {
      await waiting
      await route.fulfill({ json: [] })
    })

    await signIn(page)
    if (locale === 'ar') await switchToArabic(page)
    const emptyTitle = locale === 'ar'
      ? 'أضف أول معاملة لتظهر لك النظرة العامة على وضعك المالي.'
      : 'Add your first transaction to start seeing your financial overview.'
    await expect(page.getByTestId('section-skeleton').first()).toBeVisible()
    await expect(page.getByText(emptyTitle)).toHaveCount(0)

    release()
    await expect(page.getByText(emptyTitle)).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('a failed recent read never appears empty and retries without reloading the page', async ({ page }) => {
  let unavailable = true
  let documentRequests = 0
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documentRequests++
  })
  await page.route('**/rest/v1/rpc/search_transactions', async (route) => {
    if (unavailable) return fail(route)
    await route.fulfill({ json: [transaction()] })
  })

  await signIn(page)
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Recent transactions could not be loaded')
  await expect(page.getByText('Add your first transaction to start seeing your financial overview.')).toHaveCount(0)
  const documentsBeforeRetry = documentRequests

  unavailable = false
  await alert.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('table').filter({ hasText: 'Recovered dashboard transaction' })).toBeVisible()
  expect(documentRequests).toBe(documentsBeforeRetry)
})

test('summary, series, and cash failures remain independent and individually retryable', async ({ page }) => {
  const unavailable = { summary: true, series: true, liquid: true }
  await page.route('**/rest/v1/rpc/search_transactions', route => route.fulfill({ json: [transaction('Visible partial data')] }))
  await page.route('**/rest/v1/rpc/dashboard_summary', async (route) => {
    if (unavailable.summary) return fail(route)
    await route.fulfill({ json: {
      base_currency: 'EGP', total_assets_minor: 1000, total_liabilities_minor: 0, net_worth_minor: 1000,
      cash_and_bank_minor: 1000, accounts_receivable_minor: 0, accounts_payable_minor: 0,
      revenue_this_month_minor: 1000, expenses_this_month_minor: 0, net_profit_this_month_minor: 1000,
      revenue_previous_month_minor: 0, expenses_previous_month_minor: 0, net_profit_previous_month_minor: 0,
    } })
  })
  await page.route('**/rest/v1/rpc/report_monthly_series', async (route) => {
    if (unavailable.series) return fail(route)
    await route.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/rpc/dashboard_liquid_accounts', async (route) => {
    if (unavailable.liquid) return fail(route)
    await route.fulfill({ json: [] })
  })

  await signIn(page)
  await expect(page.getByRole('table').filter({ hasText: 'Visible partial data' })).toBeVisible()
  const summaryAlert = page.getByRole('alert').filter({ hasText: 'Key figures could not be loaded' })
  const seriesAlert = page.getByRole('alert').filter({ hasText: 'Revenue and expenses could not be loaded' })
  const liquidAlert = page.getByRole('alert').filter({ hasText: 'Cash position could not be loaded' })
  await expect(summaryAlert).toBeVisible()
  await expect(seriesAlert).toBeVisible()
  await expect(liquidAlert).toBeVisible()

  unavailable.series = false
  await seriesAlert.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Revenue vs expenses' })).toBeVisible()
  await expect(summaryAlert).toBeVisible()
  await expect(liquidAlert).toBeVisible()

  unavailable.summary = false
  await summaryAlert.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('Total assets', { exact: true })).toBeVisible()
  await expect(liquidAlert).toBeVisible()

  unavailable.liquid = false
  await liquidAlert.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('No liquid accounts yet.')).toBeVisible()
})

test('the recent-read error is localized and accessible in Arabic RTL', async ({ page }) => {
  let unavailable = true
  await page.route('**/rest/v1/rpc/search_transactions', async (route) => {
    if (unavailable) return fail(route)
    await route.fulfill({ json: [transaction('معاملة لوحة تحكم مستعادة')] })
  })
  await signIn(page)
  await switchToArabic(page)
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('تعذر تحميل أحدث المعاملات')
  await expect(alert.getByRole('button', { name: 'إعادة المحاولة', exact: true })).toBeVisible()
  await expect(page.getByText('أضف أول معاملة لتظهر لك النظرة العامة على وضعك المالي.')).toHaveCount(0)

  unavailable = false
  await alert.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click()
  await expect(page.getByRole('table').filter({ hasText: 'معاملة لوحة تحكم مستعادة' })).toBeVisible()
})
