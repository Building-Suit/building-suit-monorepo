/** Serializable read failure. Never retain a provider request, stack or credentials in SSR state. */
export class ShopQueryError extends Error {
  code?: string
  shopResponse?: { data: null; error: { message: string; code?: string }; status?: number; statusText?: string }
  constructor(message: string, code?: string, response?: { status?: number; statusText?: string }) {
    super(message)
    this.name = 'ShopQueryError'
    this.code = code
    if (response) this.shopResponse = { data: null, error: { message, ...(code ? { code } : {}) }, status: response.status, statusText: response.statusText }
  }
}
export function shopQueryError(cause: unknown, response?: { error: { message?: string; code?: string } | null; status?: number; statusText?: string }): ShopQueryError {
  if (cause instanceof ShopQueryError) return cause
  const error = response?.error ?? (cause && typeof cause === 'object' ? cause as { message?: unknown; code?: unknown } : {})
  return new ShopQueryError(typeof error.message === 'string' ? error.message : 'Shop request failed', typeof error.code === 'string' ? error.code : undefined, response)
}
export function queryErrorPayload(error: ShopQueryError) {
  return { message: error.message, code: error.code, response: error.shopResponse ? { status: error.shopResponse.status, statusText: error.shopResponse.statusText } : undefined }
}
export function reviveQueryError(payload: ReturnType<typeof queryErrorPayload>) { return new ShopQueryError(payload.message, payload.code, payload.response) }
