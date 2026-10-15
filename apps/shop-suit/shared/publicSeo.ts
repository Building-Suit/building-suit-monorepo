/** Deliberately enumerate existing public documents, never operational or auth URLs. */
export const publicPaths = ['/', '/about', '/contact', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation'] as const
export const productionOrigin = 'https://shop.building-suit.com'
export function isPublicPath(path: string): boolean { return (publicPaths as readonly string[]).includes(path) }
export function canIndex(environment: string, origin: string): boolean {
  return environment === 'production' && origin === productionOrigin
}
export function publicSitemap(enabled: boolean): string {
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    (enabled ? publicPaths.map(path => `<url><loc>${productionOrigin}${path}</loc></url>`).join('') : '') + '</urlset>'
}
