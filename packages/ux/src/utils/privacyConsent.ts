export const consentVersion = 1
export const consentLifetime = 180 * 24 * 60 * 60 * 1000
export const consentKey = 'bs-shop.privacy'
export interface PrivacyPreference { version: number; analytics: boolean; savedAt: number }
export function readPrivacyPreference(raw: string | null, now = Date.now()): PrivacyPreference | null {
  try {
    const value = JSON.parse(raw || 'null')
    return value && value.version === consentVersion && typeof value.analytics === 'boolean' &&
      Number.isFinite(value.savedAt) && value.savedAt <= now && now - value.savedAt < consentLifetime ? value : null
  } catch { return null }
}
export function privacyPreference(analytics: boolean, now = Date.now()): PrivacyPreference {
  return { version: consentVersion, analytics, savedAt: now }
}
/** Remove only our GA cookies, including supported parent-domain/path variants. */
export function removeAnalyticsCookies(doc: Document, hostname: string) {
  let cookies: string
  try { cookies = doc.cookie } catch { return }
  const names = cookies.split(';').map(cookie => cookie.split('=')[0]?.trim() || '').filter(name => name === '_ga' || name.startsWith('_ga_'))
  const labels = hostname.split('.')
  const domains = ['', ...labels.map((_, index) => labels.slice(index).join('.')).filter(domain => domain.includes('.'))]
  for (const name of names) for (const domain of domains) {
    try { doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}` } catch { /* Browser policy may block cookie access. */ }
  }
}
export interface PrivacyPresentation {
  showReopen?: boolean
  ready: boolean; prompt: boolean; settings: boolean; analytics: boolean
  copy: { title: string; body: string; accept: string; reject: string; settings: string; necessary: string; analytics: string; save: string; policy: string }
  open: () => void; close: () => void; save: (analytics: boolean) => void; change: (analytics: boolean) => void
}
