import { convertMeasurement, measurementUnits } from './measurement.js'
export { emptyScanState, captureBarcodeKey } from '@building-suit/ux/barcode'

export function addOrIncrementCartLine(lines, item) {
  const existing = lines.find(line => line.key === cartLineKey(item))
  if (existing) return lines.map(line => line === existing ? { ...line, quantity: line.quantity + 1 } : line)
  return [...lines, {
    ...item,
    key: cartLineKey(item),
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
  const factor = measurementFactor(item)
  const step = cartQuantityStep(item)
  const available = item.itemType === 'product' && Number.isFinite(item.stock) ? Math.max(0, item.stock) / factor : 1000000
  return Math.min(1000000, Math.floor((available + 1e-10) / step) * step)
}
export function nextCartQuantity(current, item) {
  const limit = cartQuantityLimit(item)
  if (!Number.isFinite(current) || current < 0 || current >= limit) return null
  return Math.min(current + 1, limit)
}


export function selectedMeasurement(item) { return item.unitSelection || (item.measurement ? `unit:${item.measurement.baseUnitCode}` : '') }
export function cartLineKey(item) { const selection = selectedMeasurement(item); return `${item.itemType}:${item.sourceId || item.id}${selection ? ':' + selection : ''}` }
export function selectedPackaging(item) { return item.measurement?.packages?.find(pack => `package:${pack.id}` === selectedMeasurement(item)) }
export function measurementFactor(item) {
  const m = item.measurement
  if (!m) return 1
  const pack = selectedPackaging(item)
  if (pack) return Number(pack.baseQuantity)
  return Number(convertMeasurement('1', selectedMeasurement(item).slice(5), m.baseUnitCode))
}
export function measuredBaseQuantity(item) {
  if (!item.measurement) return String(item.quantity)
  const pack = selectedPackaging(item)
  if (pack) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('INVALID_PACKAGE_QUANTITY')
    // Both operands are decimal strings. No binary multiplication enters a command.
    const [whole, fraction = ''] = pack.baseQuantity.split('.')
    const base = BigInt(whole + fraction.padEnd(6, '0')) * BigInt(item.quantity)
    return scaledDecimal(base)
  }
  return convertMeasurement(String(item.quantity), selectedMeasurement(item).slice(5), item.measurement.baseUnitCode, item.measurement.increment)
}
function scaledDecimal(n) { return `${n / 1000000n}.${String(n % 1000000n).padStart(6, '0')}`.replace(/\.?0+$/, '') }
function gcd(a, b) { while (b) { const next = a % b; a = b; b = next } return a }
export function cartQuantityStep(item) {
  if (!item.measurement) return 0.001
  if (selectedPackaging(item)) return 1
  const source = measurementUnits.find(unit => unit.code === selectedMeasurement(item).slice(5))
  const target = measurementUnits.find(unit => unit.code === item.measurement.baseUnitCode)
  if (!source?.factor || !target?.factor) return 1
  const scaled = value => { const [a, b = ''] = value.split('.'); return BigInt(a + b.padEnd(6, '0')) }
  const denominator = scaled(target.factor) * scaled(item.measurement.increment)
  const required = denominator / gcd(scaled(source.factor), denominator)
  const quantum = 10n ** BigInt(6 - source.allowedPrecision)
  return Number(required / gcd(required, quantum) * quantum) / 1000000
}
export function saleLineInput(line) {
  const input = { item_type: line.itemType, source_id: line.sourceId || line.id, quantity: line.measurement ? String(line.quantity) : Number(line.quantity) }
  if (!line.measurement) return input
  const pack = selectedPackaging(line)
  return { ...input, measurement_revision: line.measurement.revision, ...(pack ? { package_id: pack.id, package_version: pack.version } : { unit_code: selectedMeasurement(line).slice(5) }) }
}
export function selectedUnitPrice(item) {
  const pack = selectedPackaging(item)
  return pack?.salePrice == null ? Number(item.measurement?.baseUnitPrice ?? item.unitPrice) * measurementFactor(item) : Number(pack.salePrice)
}
