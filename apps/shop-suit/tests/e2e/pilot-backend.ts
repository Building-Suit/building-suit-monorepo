import { randomUUID } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { localStatus, apiUrl } from '../pilot/local-backend.mjs'

export type PilotRole = 'owner' | 'manager' | 'cashier' | 'barber'
type Account = { email: string; password: string; token: string }
type Location = { id: string; name: string }

// Local Auth + real PostgREST, with no intercepted responses. Credentials live
// only in this process. Fixtures remain in the disposable backend for recovery
// verification; this helper never resets a database or deletes unrelated data.
export async function backendFixture(role: PilotRole) {
  const status = localStatus()
  const runId = randomUUID()
  async function request<T>(path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Local pilot request ${path.split('?')[0]} failed (${response.status}); inspect local logs privately`)
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
  const rpc = <T>(account: Account, name: string, args: Record<string, unknown>) => request<T>(`/rest/v1/rpc/${name}`, account.token, args)
  async function account(label: string): Promise<Account> {
    const email = `${label}-${runId}@ss-pilot.invalid`
    const password = `Pilot-${randomUUID()}!`
    await request('/auth/v1/admin/users', status.SERVICE_ROLE_KEY, { email, password, email_confirm: true })
    const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', status.ANON_KEY, { email, password })
    return { email, password, token: session.access_token }
  }
  const owner = await account('owner')
  const shopId = await rpc<string>(owner, 'create_owner_shop', { p_shop_name: `Pilot ${runId}`, p_plan_slug: 'pro', p_business_mode: 'service' })
  const locations = await rpc<Location[]>(owner, 'list_shop_locations', { p_shop_id: shopId })
  const second = await rpc<string>(owner, 'save_shop_location', { p_shop_id: shopId, p_location_id: null, p_name: 'Pilot second branch', p_code: 'P2', p_address: null, p_phone: null })
  locations.push({ id: second, name: 'Pilot second branch' })
  const actor = role === 'owner' ? owner : await account(role)
  if (role !== 'owner') {
    const invitation = await rpc<{ kind: string; invitationCode?: string }>(owner, 'invite_shop_member', {
      p_request_id: randomUUID(), p_shop_id: shopId, p_email: actor.email,
      p_display_name: `Pilot ${role}`, p_role_key: role, p_location_ids: locations.map(item => item.id),
    })
    if (invitation.kind === 'invited') {
      expect(invitation.invitationCode).toBeTruthy()
      await rpc(actor, 'accept_shop_invitation', { p_request_id: randomUUID(), p_invitation_code: invitation.invitationCode })
    } else expect(invitation.kind).toBe('added')
  }
  const memberships = await request<Array<{ id: string }>>(`/rest/v1/shop_memberships?select=id&shop_id=eq.${shopId}`, actor.token)
  // An owner may read all members; the fixture's owner is the sole member in
  // owner cases. Staff RLS returns only their own membership.
  expect(memberships).toHaveLength(1)
  const membershipId = memberships[0]!.id
  const serviceId = await rpc<string>(owner, 'save_service', {
    p_shop_id: shopId, p_service_id: null, p_name: 'Pilot haircut', p_description: null,
    p_base_sale_price: 100, p_discount_type: 'amount', p_discount_value: 0,
    p_scheduling_enabled: true, p_duration_minutes: 30, p_cleanup_minutes: 0,
    p_location_ids: locations.map(item => item.id), p_staff_membership_ids: [membershipId],
  })
  for (const location of locations) await rpc(owner, 'save_staff_schedule', {
    p_shop_id: shopId, p_location_id: location.id, p_membership_id: membershipId,
    p_timezone: 'Africa/Cairo',
    p_working_hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, startsLocal: '00:00', endsLocal: '23:59' })),
    p_blocks: [],
  })
  const customerId = await rpc<string>(owner, 'save_customer', {
    p_shop_id: shopId, p_customer_id: null, p_name: 'Pilot booked customer',
    p_phone: null, p_email: null, p_address: null, p_notes: null,
  })
  return { owner, actor, shopId, locations, membershipId, serviceId, customerId, rpc }
}

export async function login(page: Page, account: Account, locale: string) {
  await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await page.goto('/auth/login')

  // The Vue app object exists before Nuxt necessarily finishes hydration.
  // Wait until client hydration is actually complete before interacting with
  // the SSR-rendered login form so submit cannot fall through as a native form
  // submission without Vue's @submit.prevent handler.
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__?: {
        config?: {
          globalProperties?: {
            $nuxt?: { isHydrating?: boolean }
          }
        }
      }
    }

    return root.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
  })

  const email = page.locator('#login-email')
  const password = page.locator('#login-password')
  const submit = page.locator('form button[type="submit"]')

  await expect(email).toBeEditable()
  await expect(password).toBeEditable()
  await expect(submit).toBeEnabled()

  await email.fill(account.email)
  await password.fill(account.password)

  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 20_000 }),
    submit.click(),
  ])
  await expect(page.getByRole('main').getByRole('heading', { name: locale === 'ar' ? 'لوحة التشغيل' : 'Operating dashboard', exact: true })).toBeVisible()
}
