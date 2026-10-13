export { emptyScanState, captureBarcodeKey } from '@building-suit/ux/barcode'

export function addOrIncrementCartLine(lines, item) {
  const existing = lines.find(line => line.itemType === item.itemType && line.sourceId === item.id)
  if (existing) return lines.map(line => line === existing ? { ...line, quantity: line.quantity + 1 } : line)
  return [...lines, {
    key: `${item.itemType}:${item.id}`,
    itemType: item.itemType,
    sourceId: item.id,
    name: item.name,
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount ?? 0),
    stock: item.stock == null ? null : Number(item.stock),
    quantity: 1,
  }]
}

export function cartTotal(lines) {
  return Math.round(lines.reduce((sum, line) => sum
    + Math.max(0, (Number(line.unitPrice) - Number(line.discount || 0)) * Number(line.quantity)), 0) * 100) / 100
}

/** Product-owned catalog limits; missing stock never creates a shared inventory rule. */
export function cartQuantityLimit(item) {
  return item.itemType === 'product' && Number.isFinite(item.stock) ? Math.min(1000000, Math.max(0, item.stock)) : 1000000
}
export function nextCartQuantity(current, item) {
  const limit = cartQuantityLimit(item)
  if (!Number.isFinite(current) || current < 0 || current >= limit) return null
  return Math.min(current + 1, limit)
}
