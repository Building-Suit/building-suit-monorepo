import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
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
const staffSchema = z.array(z.object({
  employeeId: z.uuid(),
  employeeTemplate: z.literal('shop-suit-agent-v1'),
  shopId: z.uuid(),
  shopName: z.string().trim().min(1).max(160),
  state: z.enum(['idle', 'busy']),
})).max(SHOP_SUIT_STAFF_PAGE_SIZE)
const tokenSchema = z.object({
  access_token: z.string().regex(/^[\w-]+\.[\w-]+\.[\w-]+$/).max(4096),
  expires_in: z.number().int().positive(),
})
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Shop Suit staff unavailable' })
let session: { key: string; until: number; token: Promise<string> } | undefined

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
        const { access_token, expires_in } = tokenSchema.parse(response)
        entry.until = Date.now() + Math.max(0, Math.min(300, expires_in - 15)) * 1_000
        return access_token
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
    const token = await staffToken(origin, key, email, password)
    const staff = staffSchema.parse(await fetchJson(`${origin}/rest/v1/rpc/shop_hq_assistant_staff`, {
      apikey: key, Authorization: `Bearer ${token}`,
    }, { p_after_employee_id: after ?? null, p_limit: SHOP_SUIT_STAFF_PAGE_SIZE }))
    return {
      status: 'ready' as const,
      staff: staff.map(({ employeeId, shopName, state }) => ({ employeeId, shopName, state })),
      next: staff.length === SHOP_SUIT_STAFF_PAGE_SIZE ? staff.at(-1)!.employeeId : null,
    }
  } catch {
    throw unavailable()
  }
}
