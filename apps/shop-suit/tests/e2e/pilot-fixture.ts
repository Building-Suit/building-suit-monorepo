import { expect, type Page } from '@playwright/test'

// Synthetic responses only: this suite never connects to a database.
export async function pilotFixture(page: Page, locale: string, role = 'owner') {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const state = { calendarError: false, calendarDenied: false, delayCalendar: false, emptyCalendar: false, failAccess: false }
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'pilot@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', email: user.email })).toString('base64url')}.test`
  const locations = ['First branch', 'Second branch'].map((name, index) => ({ id: `location-${index + 1}`, shop_id: 'shop-1', name, status: 'active', is_default: index === 0 }))
  const staff = { membershipId: 'membership-1', name: 'Pilot barber', locationIds: locations.map(item => item.id) }
  const service = { id: 'service-1', name: 'Haircut', itemType: 'service', unitPrice: 100, discount: 0, stock: null, sku: null, barcode: null }
  const start = new Date(); start.setHours(10, 0, 0, 0)
  const appointment = (locationId: string, name = 'Booked customer') => ({ id: `appointment-${locationId}`, locationId, staffMembershipId: staff.membershipId, serviceId: service.id, customerId: null, identityKind: 'walk_in', customerName: name, status: 'arrived', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 1800000).toISOString(), serviceName: service.name, staffName: staff.name, saleId: null, history: [] })
  const appointments = locations.map(location => appointment(location.id))
  await page.route('http://127.0.0.1:61321/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/auth/v1/')) {
      await route.fulfill({ json: url.pathname.endsWith('/token') ? { access_token: jwt, refresh_token: 'test', expires_in: 3600, token_type: 'bearer', user } : user }); return
    }
    const name = url.pathname.split('/').at(-1)!
    const args = route.request().postDataJSON() ?? {}
    calls.push({ name, args })
    if (name === 'appointment_calendar') {
      if (state.delayCalendar) await new Promise(resolve => setTimeout(resolve, 700))
      if (state.calendarError || state.calendarDenied) {
        await route.fulfill({ status: state.calendarDenied ? 403 : 500, json: { message: state.calendarDenied ? 'SHOP_PERMISSION_DENIED' : 'temporarily unavailable' } }); return
      }
    }
    if (name === 'shop_permission_access' && state.failAccess) {
      await route.fulfill({ status: 500, json: { message: 'temporarily unavailable' } }); return
    }
    let data: unknown = []
    switch (name) {
      case 'portals': data = { id: 'portal-1' }; break
      case 'profiles': data = { id: 'profile-1', status: 'active' }; break
      case 'shop_memberships': data = [{ id: staff.membershipId, shop_id: 'shop-1', profile_id: 'profile-1', role, status: 'active' }]; break
      case 'shops': data = [{ id: 'shop-1', name: 'Pilot shop', business_mode: 'service', status: 'active', created_at: '2026-01-01' }]; break
      case 'list_shop_locations': data = locations; break
      case 'subscriptions': data = { status: 'trialing', trial_end_at: '2026-10-10', plan_id: 'plan-1' }; break
      case 'shop_permission_access': data = { 'reports.view': false }; break
      case 'appointment_options': data = { canManage: true, canManageSchedule: role !== 'barber', locations, staff: [staff], services: [{ ...service, durationMinutes: 30, cleanupMinutes: 0, locationIds: staff.locationIds, staffMembershipIds: [staff.membershipId] }], customers: [] }; break
      case 'appointment_calendar': data = { appointments: state.emptyCalendar ? [] : appointments.filter(item => item.locationId === args.p_location_id), workingHours: [], blocks: [] }; break
      case 'save_appointment': {
        await new Promise(resolve => setTimeout(resolve, 500))
        const created = { ...appointment(String(args.p_location_id), String(args.p_walk_in_name)), id: 'new-appointment', startsAt: String(args.p_starts_at) }
        appointments.push(created); data = created.id; break
      }
      case 'pos_catalog_search': data = { items: [service], total: 1, page: 1, pageSize: 30, businessMode: 'service', ambiguousBarcode: false }; break
      case 'pos_checkout_context': data = { staff: [{ id: staff.membershipId, name: staff.name }], customers: [], appointments: appointments.filter(item => item.locationId === args.p_location_id).map(item => ({ ...item, staffId: staff.membershipId, service })) }; break
      case 'save_pos_sale_draft': data = 'sale-1'; break
      case 'checkout_pos_sale': data = 'sale-1'; break
      case 'get_location_sale_receipt': data = {
        version: 1,
        invoiceId: 'sale-1',
        invoiceNumber: 'SALE-1',
        issuedAt: start.toISOString(),
        currency: 'EGP',
        business: { name: 'Pilot shop', address: null, phone: null },
        location: { ...locations.find(item => item.id === args.p_location_id), code: null, address: null, phone: null },
        staffName: staff.name,
        customer: { name: 'Booked customer', phone: null },
        lines: [{ id: 'line-1', itemType: 'service', name: service.name, sku: null, quantity: 1, unitPrice: 100, discount: 0, total: 100 }],
        payments: [{ id: 'payment-1', amount: 100, method: 'cash', reference: null, paidAt: start.toISOString() }],
        subtotal: 100,
        discount: 0,
        total: 100,
        footer: null,
        paperSize: 'thermal_80',
      }; break
      case 'shop_billing_read': data = { subscription: { planName: 'Pilot plan', accessState: 'trialing', priceAmount: 100, currency: 'EGP', trialDaysRemaining: 7 }, instructions: { recipientAlias: 'pilot-billing-account-with-a-long-alias@example.test', instructionsEn: 'Review the reference before sending.', instructionsAr: 'راجع المرجع قبل الإرسال.' }, usage: { products: 0, services: 1, members: 2, limits: {} }, submissions: [] }; break
      case 'platform_admin_session': data = { userId: user.id, role: 'observer', canMutate: false }; break
      case 'platform_admin_read': data = args.p_resource === 'dashboard' ? { shops: 1, locations: 2, members: 2, recentEvents: [] } : { items: [], total: 0 }; break
      case 'platform_admin_billing_read': data = { items: [], total: 0, open: 0 }; break
    }
    await route.fulfill({ json: data })
  })
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await page.goto('/auth/login')
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
  await page.locator('#login-email').fill(user.email)
  await page.locator('#login-password').fill('fixture-password')
  await page.locator('form button[type="submit"]').click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })
  await expect(page.getByRole('main').getByRole('heading', {
    name: locale === 'ar' ? 'لوحة التشغيل' : 'Operating dashboard',
    exact: true,
  })).toBeVisible({ timeout: 20_000 })
  return { calls, state }
}
