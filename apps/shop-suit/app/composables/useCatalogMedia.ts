import { CATALOG_IMAGE_BUCKET } from '~/utils/catalogUpload'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { catalogMediaRequest, type CatalogMediaAction, type CatalogMediaPayload, type CatalogMediaResult } from '~/utils/catalogMedia'
export function useCatalogMedia() {
  const client = useSupabaseClient<ShopRpcDatabase>()
  const rpc = client.schema('public')
  async function request(action: CatalogMediaAction, payload: CatalogMediaPayload & { p_shop_id: string }, legacy: () => PromiseLike<CatalogMediaResult>, imageUrl: string | null = null, requiresMedia = false) {
    const result = await catalogMediaRequest(action, imageUrl, () => rpc.rpc('shop_catalog_media', { p_shop_id: payload.p_shop_id, p_action: action, p_payload: action.startsWith('save_') ? { ...payload, imageUrl } : payload }), legacy, requiresMedia)
    if (!result.error && !action.startsWith('save_') && result.data && typeof result.data === 'object' && 'items' in result.data && Array.isArray(result.data.items)) {
      const items = result.data.items as { imageObjectName?: string | null; imageUrl?: string | null }[]
      const names = [...new Set(items.flatMap(item => item.imageObjectName ? [item.imageObjectName] : []))]
      if (names.length) {
        const { data } = await client.storage.from(CATALOG_IMAGE_BUCKET).createSignedUrls(names, 3600)
        const urls = new Map(data?.map(item => [item.path, item.signedUrl]))
        for (const item of items) if (item.imageObjectName) item.imageUrl = urls.get(item.imageObjectName) || null
      }
    }
    return result
  }
  return { request }
}
