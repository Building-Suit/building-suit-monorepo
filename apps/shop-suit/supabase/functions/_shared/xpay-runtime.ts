export const env = (name: string) => Deno.env.get(name)
function baseUrl() {
  const url = new URL(env('SUPABASE_URL') || '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('xpay_runtime_invalid')
  return url.origin
}
export async function rpc(name: string, body: unknown, caller?: string) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!key || !/^shop_xpay_[a-z_]+$/.test(name)) throw new Error('xpay_runtime_invalid')
  const response = await fetch(`${baseUrl()}/rest/v1/rpc/${name}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { apikey: key, authorization: caller || `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('xpay_rpc_failed')
  return response.json()
}
export async function authenticate(caller?: string | null) {
  if (!caller?.startsWith('Bearer ') || caller.length > 8192) return false
  const response = await fetch(`${baseUrl()}/auth/v1/user`, {
    redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY') || '', authorization: caller },
  })
  if (!response.ok) return false
  const user = await response.json()
  return typeof user.id === 'string' && !user.is_anonymous && typeof user.email_confirmed_at === 'string'
}
export async function authorizeServer(caller?: string | null) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!key || !caller || caller.length > 8192) return false
  const encode = new TextEncoder()
  const [expected, actual] = await Promise.all([`Bearer ${key}`, caller].map(value => crypto.subtle.digest('SHA-256', encode.encode(value))))
  const a = new Uint8Array(expected), b = new Uint8Array(actual)
  let mismatch = 0
  for (let index = 0; index < a.length; index++) mismatch |= a[index]! ^ b[index]!
  return mismatch === 0
}
