import { createHash } from 'node:crypto'
import { createInquiryRateLimit } from '../../utils/inquiryRateLimit'

// Supplementary per-instance throttling. In distributed production also enforce
// an edge/WAF rate limit or CAPTCHA, as this endpoint exposes account existence.
const byIp = createInquiryRateLimit(12, 10 * 60_000, 10_000)
const byIpAndAddress = createInquiryRateLimit(4, 10 * 60_000, 20_000)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function lookupCredentials() {
  const url = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL
  // Set only in the server environment. Never use a NUXT_PUBLIC_ key here.
  const key = process.env.SHOP_AUTH_EMAIL_LOOKUP_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' })
  let parsed: URL
  try { parsed = new URL(url) }
  catch { throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' }) }
  if (parsed.username || parsed.password || !(parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) {
    throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' })
  }
  if (key.startsWith('eyJ')) {
    // Don't accidentally install an anon key as the lookup credential.
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString())
      if (payload.role !== 'service_role') throw Error('Unexpected key role')
    }
    catch { throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' }) }
  }
  else if (!key.startsWith('sb_secret_')) {
    throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' })
  }
  return { url: new URL('/rest/v1/rpc/shop_auth_email_exists', parsed), key }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ email?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw createError({ statusCode: 422, statusMessage: 'INVALID_EMAIL' })
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const emailHash = createHash('sha256').update(email).digest('hex')
  if (!byIp(ip) || !byIpAndAddress(`${ip}:${emailHash}`)) {
    throw createError({ statusCode: 429, statusMessage: 'TOO_MANY_ATTEMPTS' })
  }

  const { url, key } = lookupCredentials()
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: key,
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: email }),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
  }
  catch { throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' }) }
  if (!response.ok) throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' })
  let data: unknown
  try { data = await response.json() }
  catch { throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' }) }
  if (typeof data !== 'boolean') throw createError({ statusCode: 503, statusMessage: 'EMAIL_LOOKUP_UNAVAILABLE' })
  return { canContinue: data }
})
