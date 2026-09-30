export const emptyScanState = () => ({ value: '', lastAt: 0 })

export function captureBarcodeKey(state, key, occurredAt, options = {}) {
  const maxGap = options.maxGap ?? 80
  const minLength = options.minLength ?? 3
  if (key === 'Enter') {
    const code = state.value.length >= minLength ? state.value : null
    return { state: emptyScanState(), code }
  }
  if (key.length !== 1 || occurredAt - state.lastAt > maxGap) {
    return { state: key.length === 1 ? { value: key, lastAt: occurredAt } : emptyScanState(), code: null }
  }
  return { state: { value: state.value + key, lastAt: occurredAt }, code: null }
}

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
