export type ProductLogoVariant = 'light' | 'dark'
export type ProductLogoKind = 'wordmark' | 'mark'
const variants: ProductLogoVariant[] = ['light', 'dark']
/** Pure build-time discovery; the caller owns filesystem access. No assets are generated. */
export function resolveBrandAssets(prefix: string, exists: (filename: string) => boolean) {
  if (!/^\/brand\/[a-z0-9-]+$/.test(prefix)) throw new Error('Invalid canonical brand prefix')
  const file = prefix.slice('/brand/'.length)
  const present = (suffix: string) => exists(`${file}-${suffix}`)
  const assetPrefix = ['wordmark', 'mark'].some(kind => variants.some(variant => present(`${kind}-${variant}.svg`))) ? prefix : ''
  const icon = ['app-icon.svg','mark-light.svg','mark-dark.svg'].find(present)
  const png = ['app-icon.png','email-mark.png'].find(present)
  const icons = [
    ...(icon ? [{ rel: 'icon' as const, type: 'image/svg+xml' as const, href: `${prefix}-${icon}` }] : []),
    ...(png ? [{ rel: 'icon' as const, type: 'image/png' as const, sizes: '512x512' as const, href: `${prefix}-${png}` }] : []),
  ]
  return { assetPrefix, icons }
}
/** Missing tone falls back to its sibling; missing kind retains the existing monogram. */
export function productLogoImages(prefix: string | undefined, kind: ProductLogoKind, failed: readonly ProductLogoVariant[] = []) {
  if (!prefix) return []
  return variants.flatMap(tone => {
    const variant = !failed.includes(tone) ? tone : variants.find(candidate => !failed.includes(candidate))
    return variant ? [{ tone, variant, src: `${prefix}-${kind}-${variant}.svg` }] : []
  })
}
