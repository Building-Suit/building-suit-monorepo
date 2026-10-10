import { test, expect } from '@playwright/test'
const bindingId = '11111111-1111-4111-8111-111111111111'
for (const locale of ['en', 'ar']) for (const mobile of [false, true]) {
  test(`private offer authoring ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1200, height: 1000 })
    await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
    await page.route('**/api/session', route => route.fulfill({ json: { userId: 'synthetic-owner', role: 'owner', authorityEnvironmentId: 'synthetic-environment' } }))
    await page.route('**/api/registry', route => route.fulfill({ json: { suits: [{ key: 'synthetic-suit', label: { en: 'Synthetic Suit', ar: 'حزمة اختبار' }, items: [{ key: 'offers', label: { en: 'Private offers', ar: 'العروض الخاصة' }, module: 'custom-offers', bindingId }] }] } }))
    const versions: Record<string, unknown>[] = []
    const commands: unknown[] = []
    let fail = true
    await page.route('**/api/custom-offers', async route => {
      const body = route.request().postDataJSON()
      if (body.action === 'read') { await route.fulfill({ json: { versions, issuanceAvailable: false } }); return }
      commands.push(body)
      if (fail) { fail = false; await route.fulfill({ status: 503, json: { statusCode: 503 } }); return }
      versions.push({ ...body.payload, id: bindingId, bindingId, version: 1, state: 'saved' })
      await route.fulfill({ json: { offer: versions[0] } })
    })
    await page.goto('/?suit=synthetic-suit&item=offers')
    await expect(page.locator('[data-offers]')).toContainText(locale === 'en' ? 'Customer link issuance unavailable' : 'إصدار رابط العميل غير متاح')
    const create = page.getByRole('button', { name: locale === 'en' ? 'Create private offer' : 'إنشاء عرض خاص', exact: true })
    await create.focus(); await expect(create).toBeFocused(); await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    for (const field of ['recipientUserId', 'companyId', 'basePlanId']) await dialog.locator(`#offer-${field}`).fill(bindingId)
    await dialog.locator('#offer-displayName').fill('Synthetic negotiated offer')
    await dialog.locator('#offer-priceAmount').fill('123.45')
    await dialog.locator('#offer-currency').fill('EGP')
    await dialog.locator('#offer-billingInterval').fill('monthly')
    await dialog.locator('#offer-expiresAt').fill(new Date(Date.now() + 3600000).toISOString())
    await dialog.locator('#offer-resourceLimits').fill('{"active_locations":1,"active_members":2,"active_products":null,"active_services":3,"active_customers":4,"active_suppliers":5}')
    await dialog.locator('#offer-entitlements').fill('{"synthetic_feature":true}')
    await dialog.locator('#offer-reason').fill('Synthetic negotiated reason')
    await page.screenshot({ path: `/tmp/sas-custom-offer-${locale}-${mobile}-form.png`, fullPage: true })
    await dialog.getByRole('button', { name: locale === 'en' ? 'Save immutable version' : 'حفظ نسخة غير قابلة للتعديل', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.locator('#offer-priceAmount')).toBeDisabled()
    await dialog.getByRole('button', { name: locale === 'en' ? 'Retry exact request' : 'إعادة الطلب نفسه', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(commands).toHaveLength(2); expect(commands[0]).toEqual(commands[1])
    await expect(page.locator('[data-offers]')).toContainText('123.45')
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/sas-custom-offer-${locale}-${mobile}-saved.png`, fullPage: true })
  })
}
test('genuine staged customer reload preserves the already submitted private offer', async ({ browser }) => {
  const { targetSession, redemptionCase, targetEvidence } = await import('../custom-offer-target-evidence.mjs')
  const session = await targetSession()
  const { config, original, state, issued, args } = redemptionCase()
  // This reuses the real previously observed browser submission. No routing,
  // mocked transport, new payment notice or service-role client is involved.
  const context = await browser.newContext()
  try {
    await context.addCookies([{ name: 'bs-shop-staging-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), url: config.customerOrigin }])
    const page = await context.newPage()
    await page.goto(`${config.customerOrigin}/billing#offer=${state.offerId}&version=1&binding=${args.p_target_binding_id}&environment=${args.p_target_environment_id}&token=${issued.redemptionToken}`)
    await expect(page.locator('[data-private-offer-preview]')).toBeVisible({ timeout: 45000 })
    await expect(page.locator('[data-private-offer-preview]')).toContainText('123.45')
    await expect(page.locator('#private-offer-link')).toHaveValue('')
    await expect(page).toHaveURL(`${config.customerOrigin}/billing`)
    expect(original.nativeDatabaseObservation.redemptionCount).toBe(1)
    const evidence = await targetEvidence()
    expect(evidence.submissionId).toBe(original.nativeDatabaseObservation.submissionId)
    expect(evidence.consumedStatus).toBe(409)
  } finally { await context.close() }
})

// Rendered issuer behavior with synthetic API responses; never staging acceptance.
for (const locale of ['en', 'ar']) for (const mobile of [false, true]) {
  test(`confirmed issuance and revocation ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1200, height: 1000 })
    await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
    await page.route('**/api/session', route => route.fulfill({ json: { userId: 'synthetic-owner', role: 'owner', authorityEnvironmentId: 'synthetic-environment' } }))
    await page.route('**/api/registry', route => route.fulfill({ json: { suits: [{ key: 'synthetic-suit', label: { en: 'Synthetic Suit', ar: 'حزمة اختبار' }, items: [{ key: 'offers', label: { en: 'Private offers', ar: 'العروض الخاصة' }, module: 'custom-offers', bindingId }] }] } }))
    const link = `https://shop.example.invalid/billing#offer=${bindingId}&version=1&binding=${bindingId}&environment=${bindingId}&token=${'T'.repeat(43)}`
    const offer = { id: bindingId, definitionId: bindingId, bindingId, version: 1, state: 'saved', recipientUserId: bindingId, companyId: bindingId, basePlanId: bindingId, displayName: 'Synthetic terms', priceAmount: '123.45', currency: 'EGP', billingInterval: 'monthly', resourceLimits: {}, entitlements: {}, expiresAt: '2099-01-01T00:00:00Z', customerLink: null as string | null }
    const commands: Record<string, unknown>[] = []
    let failIssue = true
    await page.route('**/api/custom-offers', async route => {
      const body = route.request().postDataJSON()
      if (body.action === 'read') { await route.fulfill({ json: { versions: [offer], issuanceAvailable: true } }); return }
      commands.push(body)
      if (body.action === 'issue' && failIssue) { failIssue = false; await route.fulfill({ json: { offer, targetState: 'pending', customerLink: link } }); return }
      offer.state = body.action === 'issue' ? 'issued' : 'revoked'
      offer.customerLink = body.action === 'issue' ? link : null
      await route.fulfill({ json: { offer, targetState: offer.state, customerLink: offer.customerLink } })
    })
    await page.goto('/?suit=synthetic-suit&item=offers')
    await page.getByRole('button', { name: locale === 'en' ? 'Issue private offer' : 'إصدار العرض الخاص', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#offer-reason').fill('Synthetic reviewed issuance')
    await dialog.getByRole('button', { name: locale === 'en' ? 'Issue private offer' : 'إصدار العرض الخاص', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(page.locator('#offer-customer-link')).toHaveCount(0)
    await dialog.getByRole('button', { name: locale === 'en' ? 'Retry exact request' : 'إعادة الطلب نفسه', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    expect(commands[0]).toEqual(commands[1])
    await expect(page.locator('#offer-customer-link')).toHaveValue(link)
    await expect(page.locator('#offer-customer-link')).toHaveAttribute('type', 'password')
    await page.screenshot({ path: `/tmp/sas-custom-offer-${locale}-${mobile}-issued.png`, fullPage: true })
    await page.getByRole('button', { name: locale === 'en' ? 'Revoke saved version' : 'إلغاء النسخة المحفوظة', exact: true }).click()
    await dialog.locator('#offer-reason').fill('Synthetic reviewed revocation')
    await dialog.getByRole('button', { name: locale === 'en' ? 'Revoke saved version' : 'إلغاء النسخة المحفوظة', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('#offer-customer-link')).toHaveCount(0)
    await expect(page.getByRole('button', { name: locale === 'en' ? 'View customer link' : 'عرض رابط العميل', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
