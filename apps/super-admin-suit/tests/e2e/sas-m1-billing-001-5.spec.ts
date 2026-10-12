import { test, expect } from '@playwright/test'
const id = '11111111-1111-4111-8111-111111111111'
const audit = '22222222-2222-4222-8222-222222222222'
const fixture = () => ({ id, shopId: audit, shopName: 'Synthetic Shop', status: 'submitted', requestedPlanName: 'Frozen synthetic offer', requestedPlanSlug: 'frozen-offer', billingInterval: 'monthly', currency: 'EGP', listPriceAmount: 150, effectivePriceAmount: 120, paidAmount: 120, transferDate: '2026-10-07', transferReference: 'Synthetic reference', priceSource: 'catalog', resourceLimits: { active_locations: 1, active_members: 2, active_products: 5, active_services: 5, active_customers: 10, active_suppliers: 10 }, privateOfferId: audit, usageBlockers: [] as object[], evidence: [{ id: audit, originalFileName: 'Synthetic evidence.pdf', mimeType: 'application/pdf', sizeBytes: 100, sha256: 'a'.repeat(64) }] })
// Extended fixture fields are presentation-contract coverage, not proof the current Shop queue supplies them.
for (const lang of ['en', 'ar']) for (const mobile of [false, true]) {
  test(`payment review ${lang} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    const en = lang === 'en'
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1100, height: 1000 })
    await page.context().addCookies([{ name: 'building-suit-locale', value: lang, url: 'http://127.0.0.1:4324' }])
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
    await page.route('**/api/session', route => route.fulfill({ json: { userId: id, role: 'owner', authorityEnvironmentId: audit } }))
    await page.route('**/api/registry', route => route.fulfill({ json: { suits: [{ key: 'synthetic-suit', label: { en: 'Synthetic Suit', ar: 'حزمة اختبار' }, items: [{ key: 'payments', label: { en: 'Payments', ar: 'المدفوعات' }, module: 'payment-review', bindingId: id }] }] } }))
    let rows: object[] = [fixture()]
    let queryCode = 200, lose = true
    let releaseQuery: (() => void) | undefined
    let heldQuery: Promise<void> | null = null
    const commands: Record<string, unknown>[] = [], queries: Record<string, unknown>[] = []
    await page.route('**/api/adapters/shop', async route => {
      const input = route.request().postDataJSON()
      if (input.operation === 'shop.billing.command') {
        commands.push(input)
        if (lose) { lose = false; await route.fulfill({ status: 503, json: { data: { code: 'outcome_unknown' } } }); return }
        const status = input.payload.action === 'approve' ? 'approved' : input.payload.action === 'reject' ? 'rejected' : 'under_review'
        await route.fulfill({ json: { requestId: input.requestId, correlationId: input.correlationId, targetAuditId: audit, targetResultVersion: 1, replayed: commands.length === 2,
          data: { id, status, approved_subscription_end: '2026-11-07T00:00:00Z', subscription: { id: audit, status: 'active', periodEnd: '2026-11-07T00:00:00Z' } } } })
      } else if (input.payload.resource === 'evidence') {
        expect(input.payload).toEqual({ resource: 'evidence', submissionId: id, evidenceId: audit, expiresIn: 60 })
        await route.fulfill({ json: { data: { submissionId: id, evidenceId: audit, signedUrl: 'https://evidence.example.invalid/storage/v1/object/sign/shop-payment-evidence/synthetic?token=synthetic', expiresAt: new Date(Date.now() + 60000).toISOString() } } })
      } else {
        queries.push(input.payload)
        if (heldQuery) await heldQuery
        await route.fulfill({ status: queryCode, json: queryCode === 200 ? { data: { items: rows, total: rows.length ? 51 : 0, page: input.payload.page, pageSize: 25 } } : { statusCode: queryCode } })
      }
    })
    const url = '/?suit=synthetic-suit&item=payments'
    await page.goto(url)
    await expect(page.locator('[data-payment-review]')).toContainText('Synthetic Shop')
    await expect(page.locator('html')).toHaveAttribute('dir', en ? 'ltr' : 'rtl')
    expect(queries[0]).toEqual({ resource: 'queue', status: 'submitted', page: 1, pageSize: 25 })
    await page.screenshot({ path: `/tmp/sas-billing-${lang}-${mobile}-queue.png`, fullPage: true })
    await page.getByRole('button', { name: 'Next Page', exact: true }).click()
    await expect.poll(() => queries.at(-1)?.page).toBe(2)
    await page.locator('#billing-filter').click()
    await page.getByRole('option', { name: en ? 'Under review' : 'قيد المراجعة', exact: true }).click()
    await expect.poll(() => queries.at(-1)?.status).toBe('under_review')
    await expect.poll(() => queries.at(-1)?.page).toBe(1)

    const review = page.getByRole('button', { name: en ? 'Review payment' : 'مراجعة الدفع', exact: true }).first()
    await review.focus(); await expect(review).toBeFocused(); await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Frozen synthetic offer')
    await expect(dialog).toContainText('Synthetic evidence.pdf')
    expect(commands).toHaveLength(0)
    await dialog.getByRole('button', { name: en ? 'Authorize evidence review' : 'السماح بمراجعة الإثبات' }).click()
    await expect(dialog.getByRole('link')).toHaveAttribute('href', /token=synthetic/)
    expect(commands).toHaveLength(0)
    await dialog.locator('#billing-reason').fill('Synthetic externally reviewed request')
    await page.screenshot({ path: `/tmp/sas-billing-${lang}-${mobile}-review.png`, fullPage: true })
    await dialog.getByRole('button', { name: en ? 'Submit review' : 'إرسال المراجعة', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.locator('#billing-reason')).toBeDisabled()
    await dialog.getByRole('button', { name: en ? 'Retry exact request' : 'إعادة الطلب نفسه', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1])
    await expect(page.locator('[data-payment-receipt]')).toContainText(audit)
    await expect(page.locator('[data-payment-receipt]')).toContainText(en ? 'Under review' : 'قيد المراجعة')
    await review.click()
    await dialog.locator('#billing-action').click()
    await page.getByRole('option', { name: en ? 'Approve verified payment' : 'الموافقة على الدفع المتحقّق منه', exact: true }).click()
    await dialog.locator('#billing-reason').fill('Synthetic externally verified transfer')
    await dialog.locator('#billing-amount').fill('119')
    await dialog.locator('#billing-reference').fill('Synthetic bank reference')
    await dialog.locator('#billing-date').fill(new Date().toISOString().slice(0, 10))
    await dialog.locator('#billing-verified').click()
    await page.getByRole('option', { name: en ? 'I verified the received transfer externally' : 'تحقّقت من التحويل المستلم خارج النظام', exact: true }).click()
    await dialog.getByRole('button', { name: en ? 'Submit review' : 'إرسال المراجعة', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible(); expect(commands).toHaveLength(2)
    await dialog.locator('#billing-override').fill('Synthetic bank difference reason')
    await dialog.getByRole('button', { name: en ? 'Submit review' : 'إرسال المراجعة', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('[data-payment-receipt]')).toContainText('2026-11-07')
    await page.screenshot({ path: `/tmp/sas-billing-${lang}-${mobile}-confirmed.png`, fullPage: true })
    // Actual inherited Shop projection omits these fields: surface the blocker, never invent them.
    const actual = fixture() as Record<string, unknown>
    delete actual.resourceLimits; delete actual.evidence; delete actual.privateOfferId
    rows = [actual]
    await page.goto(url); await review.click()
    await expect(dialog).toContainText(en ? 'Frozen resource limits are unavailable' : 'حدود الموارد المثبّتة غير متاحة')
    await expect(dialog).toContainText(en ? 'Evidence metadata is unavailable' : 'بيانات الإثبات غير متاحة')
    await page.screenshot({ path: `/tmp/sas-billing-${lang}-${mobile}-missing.png`, fullPage: true })
    await dialog.locator('#billing-action').click()
    await expect(page.getByRole('option', { name: en ? 'Approve verified payment' : 'الموافقة على الدفع المتحقّق منه', exact: true })).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
    rows = [{ ...fixture(), usageBlockers: [{ resource: 'active_products', used: 8, limit: 5, excess: 3 }] }]
    await page.goto(url); await review.click()
    await expect(dialog).toContainText('active_products: 8 / 5')
    await dialog.locator('#billing-action').click()
    await page.getByRole('option', { name: en ? 'Reject with reason' : 'رفض مع سبب', exact: true }).click()
    await dialog.locator('#billing-reason').fill('Synthetic rejection explanation')
    await dialog.getByRole('button', { name: en ? 'Submit review' : 'إرسال المراجعة', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('[data-payment-receipt]')).toContainText(en ? 'Rejected' : 'مرفوض')
    rows = []; await page.goto(url)
    await expect(page.locator('[data-payment-review] > [data-state="empty"]')).toBeVisible()
    queryCode = 503; await page.goto(url)
    const queueError = page.locator('[data-payment-review] > [data-state="error"]')
    await expect(queueError).toHaveCount(1)
    await expect(queueError).toBeVisible()
    queryCode = 200; rows = [fixture()]
    await queueError.getByRole('button', { name: en ? 'Reload queue' : 'إعادة تحميل القائمة', exact: true }).click()
    await expect(review).toBeVisible()
    queryCode = 403; await page.goto(url)
    await expect(page.locator('[data-payment-review] [data-state="denied"]')).toBeVisible()
    await expect(review).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    queryCode = 200
    heldQuery = new Promise<void>(resolve => { releaseQuery = resolve })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-payment-review] > [data-state="loading"]')).toBeVisible()
    await page.screenshot({ path: `/tmp/sas-billing-${lang}-${mobile}-loading.png`, fullPage: true })
    releaseQuery!(); heldQuery = null
    await expect(review).toBeVisible()

  })
}
