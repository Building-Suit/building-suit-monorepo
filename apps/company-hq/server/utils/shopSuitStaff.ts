import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { SHOP_SUIT_STAFF_PAGE_SIZE } from '../../shared/shopSuitStaff'

interface Configuration {
  hqEnvironment: string
  hqShopStaffPublishableKey: string
  hqShopStaffEmail: string
  hqShopStaffPassword: string
}

const shopOrigin = {
  staging: 'https://jvvelvftpfnlogalgxgv.supabase.co',
  production: 'https://fgdzjnsbcxfbiuogbmom.supabase.co',
} as const
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i
const token = /^[\w-]+\.[\w-]+\.[\w-]+$/
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Shop Suit staff unavailable' })
let session: { key: string; until: number; token: Promise<string> } | undefined

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable()
  return value as Record<string, unknown>
}

function staffPage(value: unknown) {
  if (!Array.isArray(value) || value.length > SHOP_SUIT_STAFF_PAGE_SIZE) throw unavailable()
  const ids = new Set<string>()
  return value.map(raw => {
    const { employeeId, employeeTemplate, shopId, shopName, state } = object(raw)
    if (typeof employeeId !== 'string' || !uuid.test(employeeId) || ids.has(employeeId)
      || employeeTemplate !== 'shop-suit-agent-v1' || typeof shopId !== 'string' || !uuid.test(shopId)
      || typeof shopName !== 'string' || !shopName.trim() || shopName.length > 200
      || (state !== 'idle' && state !== 'busy')) throw unavailable()
    ids.add(employeeId)
    return { employeeId, shopName, state }
  })
}

async function fetchJson(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok || !response.body) throw unavailable()
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = ''
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 65_536) {
        await reader.cancel()
        throw unavailable()
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } finally {
    reader.releaseLock()
  }
}

function staffToken(origin: string, apiKey: string, email: string, password: string) {
  const key = createHash('sha256').update(JSON.stringify([origin, apiKey, email, password])).digest('hex')
  if (session?.key === key && session.until > Date.now()) return session.token
  const entry = {
    key,
    until: Date.now() + 5_000,
    token: fetchJson(`${origin}/auth/v1/token?grant_type=password`, { apikey: apiKey }, { email, password })
      .then(response => {
        const { access_token: accessToken, expires_in: expiresIn } = object(response)
        if (typeof accessToken !== 'string' || accessToken.length > 4096 || !token.test(accessToken)
          || typeof expiresIn !== 'number' || !Number.isInteger(expiresIn) || expiresIn <= 0) throw unavailable()
        entry.until = Date.now() + Math.max(0, Math.min(300, expiresIn - 15)) * 1_000
        return accessToken
      })
      .catch(error => {
        if (session === entry) session = undefined
        throw error
      }),
  }
  session = entry
  return entry.token
}

export async function loadShopSuitStaff(config: Configuration, after?: string) {
  const { hqShopStaffPublishableKey: key, hqShopStaffEmail: email, hqShopStaffPassword: password } = config
  if (!key || !email || !password) {
    if (!key && !email && !password) return { status: 'unconfigured' as const, staff: [], next: null }
    throw unavailable()
  }
  const origin = config.hqEnvironment === 'staging' ? shopOrigin.staging
    : config.hqEnvironment === 'production' ? shopOrigin.production : null
  if (!origin || !/^sb_publishable_[\w-]{16,512}$/.test(key) || email.length > 254 || password.length > 1024) throw unavailable()

  try {
    const accessToken = await staffToken(origin, key, email, password)
    const staff = staffPage(await fetchJson(`${origin}/rest/v1/rpc/shop_hq_assistant_staff`, {
      apikey: key, Authorization: `Bearer ${accessToken}`,
    }, { p_after_employee_id: after ?? null, p_limit: SHOP_SUIT_STAFF_PAGE_SIZE }))
    return {
      status: 'ready' as const,
      staff,
      next: staff.length === SHOP_SUIT_STAFF_PAGE_SIZE ? staff.at(-1)!.employeeId : null,
    }
  } catch {
    throw unavailable()
  }
}
