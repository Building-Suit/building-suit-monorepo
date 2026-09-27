import { MAX_DATABASE_MONEY_MINOR, minorUnitFor } from './money.ts'

export interface DecimalRatio { numerator: bigint, denominator: bigint, canonical: string }

export function parsePositiveDecimal(value: string, maxScale = 12): DecimalRatio {
  const normalized = value.trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace('٫', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new TypeError('Rate must be a positive decimal')
  const [whole, fraction = ''] = normalized.split('.')
  if (fraction.length > maxScale) throw new RangeError(`Rate supports at most ${maxScale} decimal places`)
  const numerator = BigInt(`${whole}${fraction}`)
  if (numerator <= 0n) throw new RangeError('Rate must be positive')
  const denominator = 10n ** BigInt(fraction.length)
  const divisor = gcd(numerator, denominator)
  const trimmed = fraction.replace(/0+$/, '')
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
    canonical: trimmed ? `${whole}.${trimmed}` : whole!,
  }
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b) [a, b] = [b, a % b]
  return a
}

/** Divide exactly and round a tie away from zero. */
export function divideHalfAway(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Denominator must be positive')
  const negative = numerator < 0n
  const magnitude = negative ? -numerator : numerator
  const quotient = magnitude / denominator
  const remainder = magnitude % denominator
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n)
  return negative ? -rounded : rounded
}

/** Base major units per one source-currency major unit. */
export function convertMinorExact(amountMinor: bigint, fromCurrency: string, toCurrency: string, rate: string): bigint {
  if (fromCurrency === toCurrency) {
    if (parsePositiveDecimal(rate).numerator !== parsePositiveDecimal(rate).denominator) throw new RangeError('Same-currency rate must be 1')
    return amountMinor
  }
  const parsed = parsePositiveDecimal(rate)
  const fromScale = 10n ** BigInt(minorUnitFor(fromCurrency))
  const toScale = 10n ** BigInt(minorUnitFor(toCurrency))
  const result = divideHalfAway(amountMinor * parsed.numerator * toScale, parsed.denominator * fromScale)
  if (result > MAX_DATABASE_MONEY_MINOR || result < -MAX_DATABASE_MONEY_MINOR) throw new RangeError('Converted amount exceeds the ledger range')
  return result
}

export function allocateCarryingBase(
  carryingBaseMinor: bigint,
  outstandingDocumentMinor: bigint,
  allocatedDocumentMinor: bigint,
): bigint {
  if (carryingBaseMinor <= 0n || outstandingDocumentMinor <= 0n || allocatedDocumentMinor <= 0n || allocatedDocumentMinor > outstandingDocumentMinor) {
    throw new RangeError('Invalid carrying-value allocation')
  }
  return allocatedDocumentMinor === outstandingDocumentMinor
    ? carryingBaseMinor
    : divideHalfAway(carryingBaseMinor * allocatedDocumentMinor, outstandingDocumentMinor)
}

export function allocationRoundingResidual(
  grossBaseMinor: bigint,
  grossSettlementMinor: bigint,
  allocationSettlementMinor: bigint,
  allocationBaseMinor: bigint,
): bigint {
  return allocationBaseMinor - divideHalfAway(grossBaseMinor * allocationSettlementMinor, grossSettlementMinor)
}
