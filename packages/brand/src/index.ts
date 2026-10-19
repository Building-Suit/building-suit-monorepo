export const brands = {
  building: { name: 'Building Suit', logoLight: '/brand/building-suit-logo-light.png', logoDark: '/brand/building-suit-logo-dark.png' },
  ledger: { name: 'Ledger Suit', assetPrefix: '/brand/ledger-suit', icon: '/brand/ledger-suit-app-icon.svg' },
  shop: { name: 'Shop Suit', assetPrefix: '/brand/shop-suit', icon: '/brand/shop-suit-mark-light.svg', emailLogo: '/brand/shop-suit-email-mark.png' },
  doctor: { name: 'Doctor Suit', assetPrefix: '/brand/doctor-suit', icon: '/brand/doctor-suit-mark-light.svg' },
} as const
export const brandTypography = { latin: 'Manrope', arabic: 'IBM Plex Sans Arabic', icons: 'Hugeicons Stroke Rounded' } as const
export { resolveBrandAssets, productLogoImages } from './productAssets.ts'
export type { ProductLogoVariant, ProductLogoKind } from './productAssets.ts'
