import { validWebsiteSlug, websiteDomain, websiteUrl, configuredWebsiteDomain } from './websiteAddress.ts'

export type WebsiteHost = { kind: 'private' } | { kind: 'website'; slug: string } | { kind: 'denied' }
/** Only the HTTP authority is trusted. Never consult forwarded/client tenant headers. */
export function classifyWebsiteHost(host: string | undefined, privateOrigin: string, environment: string, hostnameSuffix?: unknown): WebsiteHost {
  if (!host || host !== host.trim() || host.endsWith('.') || /[\s,@/\\?#%]/.test(host)) return { kind: 'denied' }
  const authority = host.toLowerCase()
  if (authority === websiteDomain || authority.endsWith(`.${websiteDomain}`)) {
    const domain = configuredWebsiteDomain({ appEnvironment: environment, websiteHostnameSuffix: hostnameSuffix })
    if (!domain || !authority.endsWith(`.${domain}`)) return { kind: 'denied' }
    const slug = authority.slice(0, -domain.length - 1)
    return validWebsiteSlug(slug) ? { kind: 'website', slug } : { kind: 'denied' }
  }
  // Loopback is an explicit private health/test authority, never a tenant.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:[0-9]{1,5})?$/.test(authority)) return { kind: 'private' }
  try {
    const origin = new URL(privateOrigin)
    if (origin.protocol === 'https:' && !origin.username && !origin.password && origin.hostname !== websiteDomain && !origin.hostname.endsWith(`.${websiteDomain}`) && authority === origin.host) return { kind: 'private' }
  } catch { /* Missing configuration fails closed. */ }
  return { kind: 'denied' }
}
export function websiteAliasRedirect(requestedSlug: string, result: unknown, domain: string = websiteDomain): string | null {
  if (!result || typeof result !== 'object' || !('canonicalSlug' in result) || !('isAlias' in result)) return null
  const { canonicalSlug, isAlias } = result
  return isAlias === true && typeof canonicalSlug === 'string' && canonicalSlug !== requestedSlug && validWebsiteSlug(canonicalSlug) ? websiteUrl(canonicalSlug, domain) : null
}
