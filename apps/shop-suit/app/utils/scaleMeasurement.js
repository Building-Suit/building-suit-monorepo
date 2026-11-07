import { convertMeasurement, measurementUnits } from './measurement.js'
import { cartQuantityFromDecimal } from './weightBarcodes.js'
import { sicsNetReading } from '@building-suit/ux/mtSics'

function integer(text, places) {
  if (typeof text !== 'string' || !new RegExp(`^[0-9]{1,12}(?:\\.[0-9]{1,${places}})?$`).test(text)) throw new Error('INVALID_MASS_LENGTH_FACTOR')
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'))
}
function quantity(value) {
  const tail = String(value % 1000000n).padStart(6, '0').replace(/0+$/, '')
  return `${value / 1000000n}${tail ? '.' + tail : ''}`
}
export function approvedFactorDecimal(text) {
  const value = integer(text, 12)
  if (value <= 0n || value > 1000000n * 10n ** 12n) throw new Error('INVALID_MASS_LENGTH_FACTOR')
  return text
}
/** One product's approved kg-per-stock-unit relationship; never a global unit.
 * @param {import('../types/scales').ApprovedMassLengthFactor | null} [factor]
 */
export function scaleStockQuantity(net, unitCode, item, factor = null) {
  const measurement = item?.measurement
  const source = measurementUnits.find(u => u.code === unitCode), target = measurementUnits.find(u => u.code === measurement?.baseUnitCode)
  if (item?.itemType !== 'product' || !measurement || measurement.reelTracking || !source?.isActive || source.dimension !== 'mass' || !target?.isActive) throw new Error('SCALE_PRODUCT_UNAVAILABLE')
  let result
  if (target.dimension === 'mass') result = convertMeasurement(net, unitCode, target.code, measurement.increment)
  else {
    if (target.dimension !== 'length' || !factor || !factor.active || factor.productId !== item.id || factor.baseUnitCode !== target.code
      || factor.measurementRevision !== measurement.revision || !factor.id || !Number.isSafeInteger(factor.revision) || factor.revision < 1) throw new Error('APPROVED_MASS_LENGTH_REQUIRED')
    const relationship = integer(factor.kgPerBaseUnit, 12), entered = integer(net, 6), sourceFactor = integer(source.factor, 6)
    if (relationship <= 0n || relationship > 1000000n * 10n ** 12n || entered <= 0n) throw new Error('INVALID_MASS_LENGTH_FACTOR')
    // Compute the complete ratio at once: no rounded intermediate kg value.
    const numerator = entered * sourceFactor * 1000000n
    if (numerator % relationship !== 0n) throw new Error('UNREPRESENTABLE_MEASUREMENT_QUANTITY')
    result = convertMeasurement(quantity(numerator / relationship), target.code, target.code, measurement.increment)
  }
  cartQuantityFromDecimal(result)
  return result
}

/** Reject malformed capture reads before projecting them into a cart line. */
export function verifyScaleCapture(result) {
  const snapshot = result?.snapshot, reading = snapshot?.reading
  if (!result || typeof result.id !== 'string' || snapshot?.kind !== 'scale' || snapshot.id !== result.id || !reading || reading.confirmed !== true
    || snapshot.productId !== result.item?.id || snapshot.productRevision !== result.item?.measurement?.revision || snapshot.baseUnitCode !== result.unitCode
    || typeof result.availableQuantity !== 'string' || reading.serial !== snapshot.device?.serial) throw new Error('INVALID_SCALE_CAPTURE_RESPONSE')
  const parsed = sicsNetReading(reading.tareBefore, reading.stable, reading.tareAfter)
  if (parsed.net !== snapshot.netQuantity || parsed.tare !== snapshot.tareQuantity || parsed.gross !== snapshot.grossQuantity || parsed.unit !== snapshot.unitCode
    || scaleStockQuantity(parsed.net, parsed.unit, result.item, snapshot.factor) !== result.quantity || result.quantity !== snapshot.baseQuantity) throw new Error('INVALID_SCALE_CAPTURE_RESPONSE')
  return result
}
