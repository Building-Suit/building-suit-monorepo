import { measuredBaseQuantity } from './pos.js'
import { convertMeasurement, measurementUnits } from './measurement.js'

/** Verified GS1 subset: AI01 GTIN-14 followed by AI3100..3105 net kg.
 * Fixed barcode lookup always precedes this decoder. No retail-prefix guessing.
 */
export function parseGs1WeightBarcode(input) {
  if (typeof input !== 'string' || input.length > 80) return null
  const raw = input.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')
  const aim = raw.startsWith(']C1')
  const value = aim ? raw.slice(3) : raw
  const match = /^01(\d{14})310([0-5])(\d{6})$/.exec(value)
    || (!aim ? /^\(01\)(\d{14})\(310([0-5])\)(\d{6})$/.exec(value) : null)
  if (!match) return null
  const [, gtin, places, digits] = match
  const check = [...gtin.slice(0,13)].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 1 : 3), 0)
  if (gtin[0] !== '9' || Number(gtin[13]) !== (10 - check % 10) % 10) throw new Error('INVALID_WEIGHT_BARCODE')
  const amount = BigInt(digits), precision = Number(places), divisor = 10n ** BigInt(precision)
  if (amount === 0n) throw new Error('INVALID_WEIGHT_BARCODE')
  const tail = (amount % divisor).toString().padStart(precision,'0').replace(/0+$/,'')
  return { format: 'gs1-01-310n', raw, gtin, netQuantity: `${amount / divisor}${tail ? '.' + tail : ''}`, unitCode: 'kg' }
}

/** Exact client preview; posting independently verifies the original label. */
export function capturedWeightQuantity(parsed, item) {
  const m = item?.measurement
  if (!parsed || item.itemType !== 'product' || item.barcode !== parsed.gtin || !m || m.reelTracking
    || measurementUnits.find(u => u.code === m.baseUnitCode)?.dimension !== 'mass') throw new Error('WEIGHT_BARCODE_PRODUCT_UNAVAILABLE')
  const quantity = convertMeasurement(parsed.netQuantity, 'kg', m.baseUnitCode, m.increment)
  // The existing cart widget uses numbers, bounded to six decimal places and
  // one million. Check the round trip; no arithmetic or rounding uses Number.
  cartQuantityFromDecimal(quantity)
  return quantity
}
export function cartQuantityFromDecimal(quantity) {
  if (typeof quantity !== 'string' || !/^[0-9]{1,7}(?:\.[0-9]{1,6})?$/.test(quantity)) throw new Error('INVALID_CAPTURED_QUANTITY')
  const scaled = text => { const [whole,fraction=''] = text.split('.'); return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6,'0')) }
  const exact = scaled(quantity), value = Number(quantity)
  if (exact <= 0n || exact > 1000000000000n || !Number.isFinite(value) || !/^[0-9]+(?:\.[0-9]{1,6})?$/.test(String(value)) || scaled(String(value)) !== exact) throw new Error('INVALID_CAPTURED_QUANTITY')
  return value
}

/** Check all existing unit selections for the SKU against canonical free stock. */
export function assertCapturedStock(lines, item, quantity, available) {
  const scaled = value => {
    const text = String(value)
    if (!/^[0-9]{1,18}(?:\.[0-9]{1,6})?$/.test(text)) throw new Error('INVALID_CAPTURED_QUANTITY')
    const [whole,fraction=''] = text.split('.')
    return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6,'0'))
  }
  let requested = scaled(quantity)
  for (const line of lines) if (line.itemType === 'product' && line.sourceId === item.id) requested += scaled(measuredBaseQuantity(line))
  if (requested > scaled(available)) throw new Error('INSUFFICIENT_STOCK')
}
