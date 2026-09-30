import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { apiUrl, localStatus } from '../pilot/local-backend.mjs'

export type MarketMode = 'product' | 'service' | 'mixed'
export type MarketRole = 'owner' | 'manager' | 'cashier'
type Account = { email: string; password: string; token: string }

export async function marketFixture(mode: MarketMode, role: MarketRole) {
  const status = localStatus()
  const run = randomUUID()
  async function request<T>(path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    // Never attach JWTs, passwords, or provider response bodies to test errors.
    if (!response.ok) throw new Error(`Local market request ${path.split('?')[0]} failed (${response.status})`)
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
  const rpc = <T>(actor: Account, name: string, args: Record<string, unknown>) =>
    request<T>(`/rest/v1/rpc/${name}`, actor.token, args)
  async function account(label: string): Promise<Account> {
    const email = `${label}-${run}@ss-market.invalid`
    const password = `Market-${randomUUID()}!`
    await request('/auth/v1/admin/users', status.SERVICE_ROLE_KEY, { email, password, email_confirm: true })
    const session = await request<{ access_token: string }>('/auth/v1/token?grant_type=password', status.ANON_KEY, { email, password })
    return { email, password, token: session.access_token }
  }
  const owner = await account('owner')
  const shopId = await rpc<string>(owner, 'create_owner_shop', { p_shop_name: `Market ${mode} ${run}`, p_plan_slug: 'pro', p_business_mode: mode })
  const locations = await rpc<Array<{ id: string; name: string }>>(owner, 'list_shop_locations', { p_shop_id: shopId })
  expect(locations).toHaveLength(1)
  const locationId = locations[0]!.id
  const actor = role === 'owner' ? owner : await account(role)
  if (role !== 'owner') {
    const invitation = await rpc<{ kind: string; invitationCode?: string }>(owner, 'invite_shop_member', {
      p_request_id: randomUUID(), p_shop_id: shopId, p_email: actor.email,
      p_display_name: `Market ${role}`, p_role_key: role, p_location_ids: [locationId],
    })
    if (invitation.kind === 'invited') {
      expect(invitation.invitationCode).toBeTruthy()
      await rpc(actor, 'accept_shop_invitation', { p_request_id: randomUUID(), p_invitation_code: invitation.invitationCode })
    } else expect(invitation.kind).toBe('added')
  }
  const memberships = await request<Array<{ id: string }>>(`/rest/v1/shop_memberships?select=id&shop_id=eq.${shopId}`, actor.token)
  expect(memberships).toHaveLength(1)
  if (mode !== 'product') await rpc(owner, 'save_service', {
    p_shop_id: shopId, p_service_id: null, p_name: 'Market service', p_description: null,
    p_base_sale_price: 30, p_discount_type: 'amount', p_discount_value: 0,
  })
  return { owner, actor, shopId, locationId, membershipId: memberships[0]!.id, rpc, account }
}
