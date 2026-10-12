import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { catalogMediaRequest, type CatalogMediaAction, type CatalogMediaPayload, type CatalogMediaResult } from '~/utils/catalogMedia'
export function useCatalogMedia() {
  const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
  async function request(action: CatalogMediaAction, payload: CatalogMediaPayload & { p_shop_id: string }, legacy: () => PromiseLike<CatalogMediaResult>, imageUrl: string | null = null, requiresMedia = false) {
    return catalogMediaRequest(action, imageUrl, () => rpc.rpc('shop_catalog_media', { p_shop_id: payload.p_shop_id, p_action: action, p_payload: action.startsWith('save_') ? { ...payload, imageUrl } : payload }), legacy, requiresMedia)
  }
  return { request }
}
