export interface DoctorProviderConfiguration {
  enabled: boolean
  environment: 'local' | 'staging' | 'production'
  origin: string
  url: string
  key: string
  cookiePrefix: string
}

export function doctorProviderConfiguration(values: Record<string, string | undefined>): DoctorProviderConfiguration {
  const environment = values.APP_ENV || 'local'
  if (!['local', 'staging', 'production'].includes(environment)) throw new Error('DOCTOR_ENVIRONMENT_INVALID')
  const result = {
    enabled: false, environment: environment as DoctorProviderConfiguration['environment'],
    origin: '', url: '', key: '', cookiePrefix: `bs-doctor-${environment}-auth-token`,
  }
  const url = values.DOCTOR_SUPABASE_URL?.trim() || ''
  const key = values.DOCTOR_SUPABASE_PUBLISHABLE_KEY?.trim() || ''
  if (!url || !key) return result
  let backend: URL
  try { backend = new URL(url) } catch { throw new Error('DOCTOR_PROVIDER_URL_INVALID') }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(backend.hostname)
  if (backend.username || backend.password || backend.search || backend.hash || backend.pathname !== '/'
    || !(backend.protocol === 'https:' || (environment === 'local' && loopback && backend.protocol === 'http:'))) throw new Error('DOCTOR_PROVIDER_URL_INVALID')
  let publicKey = key.startsWith('sb_publishable_')
  if (!publicKey && key.split('.').length === 3) {
    try { publicKey = JSON.parse(atob(key.split('.')[1]!.replaceAll('-', '+').replaceAll('_', '/'))).role === 'anon' } catch { /* Fail closed. */ }
  }
  if (!publicKey || key.startsWith('sb_secret_')) throw new Error('DOCTOR_PUBLIC_KEY_REQUIRED')
  let origin: URL
  try { origin = new URL(values.APP_URL || (environment === 'local' ? 'http://127.0.0.1:3006' : '')) } catch { throw new Error('DOCTOR_APP_ORIGIN_INVALID') }
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/'
    || !(origin.protocol === 'https:' || (environment === 'local' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) && origin.protocol === 'http:'))) throw new Error('DOCTOR_APP_ORIGIN_INVALID')
  return { ...result, enabled: true, origin: origin.origin, url: backend.origin, key }
}

export const doctorHomePath = '/workspace'
export function doctorReturnPath(value: unknown): string {
  if (typeof value !== 'string') return doctorHomePath
  let decoded: string
  try { decoded = decodeURIComponent(value) } catch { return doctorHomePath }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')
    || Array.from(decoded).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return doctorHomePath
  const url = new URL(decoded, 'https://doctor.invalid')
  if (url.origin !== 'https://doctor.invalid') return doctorHomePath
  if (['/appointment-types','/clinical','/privacy','/subscription','/payment-notices','/payment-review','/payment-reconciliation','/payment-review-reconciliation','/account', '/account-activity', '/team', '/invitations/accept', '/onboarding', '/workspace', '/patients', '/availability','/appointments', '/appointments', '/locations', '/settings', '/audit'].includes(url.pathname)
    || /^\/clinical-releases\/[0-9a-f-]{36}$/i.test(url.pathname)
    || /^\/patients\/[0-9a-f-]{36}$/i.test(url.pathname)) return url.pathname
  return doctorHomePath
}

/** Preserve the pinned SDK's per-flow PKCE binding before removing URL material. */
export function doctorPkceCallback(query: Record<string, unknown>): { code: string; flowId?: string } | null {
  if (typeof query.code !== 'string' || !query.code || query.code.length > 2048) return null
  if (query.sb_flow_id === undefined) return { code: query.code }
  if (typeof query.sb_flow_id !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(query.sb_flow_id)) return null
  return { code: query.code, flowId: query.sb_flow_id }
}
