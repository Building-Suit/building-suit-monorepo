import registry from './measurementUnits.json' with { type: 'json' }

// Client preview only. All business commands must resolve the selected unit again
// on the server. Strings keep quantities exact across JSON boundaries.
export const measurementUnits = Object.freeze(registry.map(unit => Object.freeze({ ...unit })))
const units = new Map(measurementUnits.map(unit => [unit.code, unit]))
const scale = 1000000n
const maximum = 999999999999999999n

function decimal(value, error = 'INVALID_MEASUREMENT_QUANTITY') {
  if (typeof value !== 'string' || !/^[0-9]{1,12}(\.[0-9]{1,6})?$/.test(value)) throw new Error(error)
  const [integer, fraction = ''] = value.split('.')
  const result = BigInt(integer) * scale + BigInt(fraction.padEnd(6, '0'))
  if (result <= 0n || result > maximum) throw new Error(error)
  return result
}
function printable(value) {
  const integer = value / scale
  const fraction = String(value % scale).padStart(6, '0').replace(/0+$/, '')
  return `${integer}${fraction ? `.${fraction}` : ''}`
}
function representable(value, precision) { return value % (10n ** BigInt(6 - precision)) === 0n }

/** Exact dimension-safe preview, rejecting repeating or unsupported precision.
 * @param {string | null} [increment]
 */
export function convertMeasurement(quantity, from, to, increment = null) {
  const entered = decimal(quantity)
  const source = units.get(from)
  const target = units.get(to)
  if (!source?.isActive || !target?.isActive) throw new Error('MEASUREMENT_UNIT_NOT_FOUND')
  if (source.dimension === 'package' || target.dimension === 'package') throw new Error('PRODUCT_PACKAGING_REQUIRED')
  if (source.dimension !== target.dimension) throw new Error('INCOMPATIBLE_MEASUREMENT_DIMENSION')
  if (!representable(entered, source.allowedPrecision)) throw new Error('INVALID_MEASUREMENT_PRECISION')
  const numerator = entered * decimal(source.factor)
  const denominator = decimal(target.factor)
  if (numerator % denominator !== 0n) throw new Error('UNREPRESENTABLE_MEASUREMENT_QUANTITY')
  const result = numerator / denominator
  if (result > maximum || !representable(result, target.allowedPrecision)) throw new Error('UNREPRESENTABLE_MEASUREMENT_QUANTITY')
  if (increment !== null) {
    const step = decimal(increment, 'INVALID_MEASUREMENT_INCREMENT')
    if (step > scale || !representable(step, target.allowedPrecision) || result % step !== 0n) throw new Error('INVALID_MEASUREMENT_INCREMENT')
  }
  return printable(result)
}
