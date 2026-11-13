import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '../../app/types/database.types'
import type { ShopRpcDatabase } from '../../app/types/shopCrmRpc'

type AssistantDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: ShopRpcDatabase['public']['Functions']
  }
}

export type ShopAssistantScope = {
  client: Awaited<ReturnType<typeof serverSupabaseClient<AssistantDatabase>>>
  actorId: string
  shopId: string
  locationId: string
  location: string
  currency: string
}

export async function requireShopAssistantScope(event: H3Event, shopId: string, locationId: string): Promise<ShopAssistantScope> {
  const client = await serverSupabaseClient<AssistantDatabase>(event)
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user || user.is_anonymous) {
    throw createError({ statusCode: 401, statusMessage: 'Shop sign-in required' })
  }

  const unavailable = () => createError({ statusCode: 503, statusMessage: 'Shop authorization unavailable' })
  const ownerRequired = () => createError({ statusCode: 403, statusMessage: 'Active shop owner required' })
  const portal = await client.from('portals').select('id').eq('key', 'shop-crm').eq('is_active', true).maybeSingle()
  if (portal.error) throw unavailable()
  if (!portal.data) throw ownerRequired()
  const portalId = portal.data.id

  const profile = await client.from('profiles').select('id')
    .eq('user_id', user.id).eq('portal_id', portalId).eq('status', 'active').maybeSingle()
  if (profile.error) throw unavailable()
  if (!profile.data) throw ownerRequired()

  const [membership, shop] = await Promise.all([
    client.from('shop_memberships').select('id').eq('shop_id', shopId).eq('profile_id', profile.data.id)
      .eq('role', 'owner').eq('status', 'active').is('removed_at', null).maybeSingle(),
    client.from('shops').select('business_currency').eq('id', shopId)
      .eq('portal_id', portalId).eq('status', 'active').maybeSingle(),
  ])
  if (membership.error || shop.error) throw unavailable()
  if (!membership.data || !shop.data) throw ownerRequired()
  if (!/^[A-Z]{3}$/.test(shop.data.business_currency)) throw unavailable()

  const { data: locations, error: locationsError } = await client.rpc('list_shop_locations', { p_shop_id: shopId })
  if (locationsError) throw unavailable()
  const location = locations?.find(row => row.id === locationId && row.shop_id === shopId && row.status === 'active')
  if (!location) throw createError({ statusCode: 403, statusMessage: 'Active shop location required' })

  return {
    client, actorId: user.id, shopId, locationId,
    location: location.name, currency: shop.data.business_currency,
  }
}
