/** Public website addresses are independent of Shop display names. */
export const websiteDomain = 'shops.building-suit.com'
export const stagingWebsiteDomain = 'stg.shops.building-suit.com'
/** Deployment-owned DNS suffixes only; never accept a request or tenant override. */
export function validWebsiteHostnameSuffix(value: unknown): value is string {
  return value === websiteDomain || value === stagingWebsiteDomain
}
export function configuredWebsiteDomain(config: { websiteHostnameSuffix?: unknown; appEnvironment?: unknown }): string | null {
  const environment = config.appEnvironment === undefined ? 'local' : config.appEnvironment
  if (typeof environment !== 'string' || !['local', 'staging', 'production'].includes(environment)) return null
  const domain = config.websiteHostnameSuffix === '' || config.websiteHostnameSuffix === undefined ? (environment === 'staging' ? null : websiteDomain) : config.websiteHostnameSuffix
  if (!validWebsiteHostnameSuffix(domain)) return null
  if (environment === 'staging' && domain !== stagingWebsiteDomain || environment === 'production' && domain !== websiteDomain) return null
  return domain
}
export const reservedWebsiteSlugs = new Set(['www', 'app', 'api', 'admin', 'auth', 'account', 'accounts', 'billing', 'blog', 'cdn', 'dashboard', 'docs', 'email', 'help', 'internal', 'login', 'logout', 'mail', 'manage', 'owner', 'preview', 'private', 'public', 'register', 'root', 'security', 'shop', 'shops', 'signup', 'staff', 'static', 'status', 'stg', 'staging', 'support', 'system', 'test', 'vercel', 'web', 'webmail', 'building-suit'])
export function validWebsiteSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 50 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !slug.startsWith('xn--') && !reservedWebsiteSlugs.has(slug)
}
export function websiteUrl(slug: string, domain: string = websiteDomain): string {
  if (!validWebsiteSlug(slug)) throw new Error('INVALID_WEBSITE_SLUG')
  if (!validWebsiteHostnameSuffix(domain)) throw new Error('INVALID_WEBSITE_HOSTNAME_SUFFIX')
  return `https://${slug}.${domain}`
}
/** Do not transliterate mixed scripts or silently discard ambiguous characters. */
export function suggestWebsiteSlug(name: string, entropy: string): string {
  if (!/^[a-f0-9]{32}$/.test(entropy)) throw new Error('SECURE_ENTROPY_REQUIRED')
  const candidate = name.trim().toLowerCase().replace(/[\s]+/g, '-').replace(/-+/g, '-')
  return /^[\x20-\x7e]+$/.test(name) && validWebsiteSlug(candidate) ? candidate : `shop-${entropy}`
}
export type WebsiteAddress = { slug: string; state: 'draft' | 'published' | 'suspended'; aliases: string[] }
