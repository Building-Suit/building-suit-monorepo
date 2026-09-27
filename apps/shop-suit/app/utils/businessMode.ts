export type BusinessMode = 'product' | 'service' | 'mixed'

export const BUSINESS_MODES: BusinessMode[] = ['product', 'service', 'mixed']

export function businessModeSupportsProducts(mode: BusinessMode) {
  return mode === 'product' || mode === 'mixed'
}

export function businessModeSupportsServices(mode: BusinessMode) {
  return mode === 'service' || mode === 'mixed'
}

export function businessAreaForPath(path: string): 'product' | 'service' | null {
  if (path === '/products' || path.startsWith('/products/')
    || path === '/inventory' || path.startsWith('/inventory/')
    || path === '/purchases' || path.startsWith('/purchases/')) return 'product'
  if (path === '/services' || path.startsWith('/services/')) return 'service'
  return null
}

export function businessModeSupportsPath(mode: BusinessMode, path: string) {
  const area = businessAreaForPath(path)
  if (area === 'product') return businessModeSupportsProducts(mode)
  if (area === 'service') return businessModeSupportsServices(mode)
  return true
}
