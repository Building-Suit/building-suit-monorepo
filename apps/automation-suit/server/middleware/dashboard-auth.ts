import { timingSafeEqual } from 'node:crypto'

function safeEqual(actual: string, expected: string) {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const required = config.dashboardAuthRequired !== false && String(config.dashboardAuthRequired).toLowerCase() !== 'false'
  if (!required) return

  const expectedUsername = String(config.dashboardUsername || '')
  const expectedPassword = String(config.dashboardPassword || '')

  if (!expectedUsername || !expectedPassword) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Dashboard authentication is not configured',
      message: 'Set NUXT_DASHBOARD_USERNAME and NUXT_DASHBOARD_PASSWORD, or explicitly disable auth only for a trusted local environment.',
    })
  }

  const authorization = getHeader(event, 'authorization') || ''
  if (!authorization.startsWith('Basic ')) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Automation Suit", charset="UTF-8"')
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  let decoded: string
  try {
    decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
  } catch {
    decoded = ''
  }

  const separator = decoded.indexOf(':')
  const username = separator >= 0 ? decoded.slice(0, separator) : ''
  const password = separator >= 0 ? decoded.slice(separator + 1) : ''

  if (!safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Automation Suit", charset="UTF-8"')
    throw createError({ statusCode: 401, statusMessage: 'Invalid dashboard credentials' })
  }
})
