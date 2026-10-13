export type CatalogMediaAction = 'products' | 'services' | 'pos' | 'save_product' | 'save_service'
export type CatalogMediaPayload = Record<string, string | number | boolean | string[] | null>
export type CatalogMediaResult = { data: unknown; error: { code?: string; message?: string } | null }
export function validCatalogImage(value: string): boolean {
  if (!value.trim()) return true
  if (value.trim().length > 2000) return false
  try { const url = new URL(value.trim()); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/\s/.test(value.trim()) } catch { return false }
}
/** Only absent-function errors permit fallback; denial/network/validation errors remain failures. */
export async function catalogMediaRequest(
  action: CatalogMediaAction, imageUrl: string | null,
  media: () => PromiseLike<CatalogMediaResult>, legacy: () => PromiseLike<CatalogMediaResult>, requiresMedia = false,
): Promise<CatalogMediaResult> {
  const result = await media()
  if (!['PGRST202', '42883'].includes(result.error?.code ?? '')) return result
  if (action.startsWith('save_') && (imageUrl || requiresMedia)) return { data: null, error: { code: 'CATALOG_MEDIA_UNAVAILABLE', message: 'CATALOG_MEDIA_UNAVAILABLE' } }
  return legacy()
}
