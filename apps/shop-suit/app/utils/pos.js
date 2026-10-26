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
  const available = item.itemType === 'product' && Number.isFinite(item.stock) ? Math.max(0, item.reelId && item.reelRemaining != null ? Number(item.reelRemaining) : item.stock) / factor : 1000000
  return Math.min(1000000, Math.floor((available + 1e-10) / step) * step)
}
export function nextCartQuantity(current, item) {
  const limit = cartQuantityLimit(item)
  if (!Number.isFinite(current) || current < 0 || current >= limit) return null
  return Math.min(current + 1, limit)
}


export function selectedMeasurement(item) { return item.unitSelection || (item.measurement ? `unit:${item.measurement.baseUnitCode}` : '') }
export function cartLineKey(item) { const selection = selectedMeasurement(item); return `${item.itemType}:${item.sourceId || item.id}${selection ? ':' + selection : ''}${item.reelId ? ':reel:' + item.reelId : ''}${item.measurementCapture ? ':capture:' + item.measurementCapture.kind + ':' + item.measurementCapture.id : ''}` }
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
  const input = { ...(line.measurementCapture ? { measurement_capture: line.measurementCapture } : {}), item_type: line.itemType, source_id: line.sourceId || line.id, quantity: line.measurement ? String(line.quantity) : Number(line.quantity), ...(line.itemType === 'product' && line.overridePrice !== undefined && line.overridePrice !== '' ? { override_price: line.overridePrice, override_reason: line.overrideReason ?? '' } : {}) }
  if (!line.measurement) return input
  const pack = selectedPackaging(line)
  return { ...input, measurement_revision: line.measurement.revision, ...(line.measurement.reelTracking ? { allow_split: line.allowSplit ?? false, cutting_loss: line.cuttingLoss || '0', ...(line.reelId ? { reel_id: line.reelId } : {}) } : {}), ...(pack ? { package_id: pack.id, package_version: pack.version } : { unit_code: selectedMeasurement(line).slice(5) }) }
}
export function selectedUnitPrice(item) {
  const pack = selectedPackaging(item)
  return pack?.salePrice == null ? Number(item.reelId && item.reelPrice != null ? item.reelPrice : item.measurement?.baseUnitPrice ?? item.unitPrice) * measurementFactor(item) : Number(pack.salePrice)
}

/** Bounded offline preview only; posting always replans under server locks. */
export function physicalCartError(line) {
  if (!line.measurement?.reelTracking) return null
  try {
    const scaled = value => { const text = String(value); if (!/^\d{1,12}(\.\d{1,6})?$/.test(text)) throw new Error('INVALID_REEL_CUT'); const [a,b = ''] = text.split('.'); return BigInt(a + b.padEnd(6,'0')) }
    const sold = scaled(measuredBaseQuantity(line)), loss = scaled(line.cuttingLoss || '0')
    const pack = selectedPackaging(line)
    if (pack && loss !== 0n) return 'INVALID_SEALED_REEL_SALE'
    if (loss && loss % scaled(line.measurement.increment) !== 0n) return 'INVALID_MEASUREMENT_INCREMENT'
    if (line.reelId) {
      if (line.reelRemaining == null) return 'REEL_STOCK_UNCONFIRMED'
      if (pack && (line.reelStatus !== 'sealed' || scaled(line.reelRemaining) !== scaled(pack.baseQuantity) || Number(line.quantity) !== 1)) return 'INSUFFICIENT_SEALED_REELS'
      return sold + loss <= scaled(line.reelRemaining) ? null : 'SELECTED_REEL_CANNOT_FULFILL'
    }
    const summary = line.reelSummary
    if (!summary) return 'REEL_STOCK_UNCONFIRMED'
    if (pack) return Number(line.quantity) <= Number(summary.sealedByLength?.[pack.baseQuantity] ?? 0) ? null : 'INSUFFICIENT_SEALED_REELS'
    const available = line.allowSplit ? summary.automaticAvailable : summary.largestAutomatic
    if (available == null) return 'REEL_STOCK_UNCONFIRMED'
    return sold + loss <= scaled(available) ? null : line.allowSplit ? 'INSUFFICIENT_REEL_LENGTH' : 'CONTINUOUS_LENGTH_UNAVAILABLE'
  } catch (error) { return error.message || 'INVALID_REEL_CUT' }
}

/** Only previously cached, scoped physical identities may resolve while offline. */
export function cachedReelBarcodeItem(item, options, barcode) {
 if (!item.measurement?.reelTracking) return null
 const reel = options?.items.find(reel => reel.barcode === barcode && ['sealed','open'].includes(reel.status) && ['sellable','discounted'].includes(reel.classification) && Number(reel.remainingLength)>0)
 if (!reel) return null
 const selected = { ...item, barcode, reelId: reel.id, reelBarcode: barcode, reelStatus: reel.status, reelRemaining: reel.remainingLength, reelPrice: reel.classification === 'discounted' ? reel.price : null, reelSummary: options.summary, catalogStock: item.stock, stock: Number(reel.remainingLength), unitSelection: `unit:${item.measurement.baseUnitCode}` }
 return { ...selected, unitPrice: selectedUnitPrice(selected) }
}
