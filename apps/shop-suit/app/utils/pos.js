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
