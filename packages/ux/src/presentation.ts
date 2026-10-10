export interface BsMoneyFormatOptions {
  currency: string
  locale?: string
  unit?: 'minor' | 'major'
  currencySign?: 'standard' | 'accounting'
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never'
  numberingSystem?: string
}
/** Exact display conversion only. Does not calculate, validate or round financial commands. */
export function formatPresentationMoney(amount: number | bigint | string, options: BsMoneyFormatOptions): string {
  const formatter = new Intl.NumberFormat(options.locale || 'en', {
    style: 'currency', currency: options.currency, currencySign: options.currencySign || 'standard',
    signDisplay: options.signDisplay || 'auto', numberingSystem: options.numberingSystem || 'latn',
  })
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2
  let minor: bigint
  if (options.unit === 'major') {
    if (typeof amount === 'number' && (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER)) throw new RangeError('Supply exact major units as a decimal string')
    const text = String(amount)
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw new TypeError('Expected a decimal amount')
    const [whole = '0', fraction = ''] = text.replace('-', '').split('.')
    if (fraction.length > exponent) throw new RangeError('Amount exceeds currency display precision')
    minor = BigInt(whole + fraction.padEnd(exponent, '0')) * (text.startsWith('-') ? -1n : 1n)
  }
  else {
    if (typeof amount === 'number' && !Number.isSafeInteger(amount)) throw new RangeError('Supply exact minor units as a string')
    minor = BigInt(amount)
  }
  const magnitude = minor < 0n ? -minor : minor
  const scale = 10n ** BigInt(exponent)
  const whole = magnitude / scale
  // A signed sub-unit must still produce negative formatting (including accounting parentheses).
  const signedWhole = minor < 0n ? (whole === 0n ? -0 : -whole) : whole
  // exceptZero must inspect the complete amount, not the integral part.
  const partsFormatter = options.signDisplay === 'exceptZero' && minor !== 0n && whole === 0n
    ? new Intl.NumberFormat(options.locale || 'en', { ...formatter.resolvedOptions(), signDisplay: 'always' }) : formatter
  const fraction = (magnitude % scale).toString().padStart(exponent, '0')
  const digits = new Intl.NumberFormat(options.locale || 'en', { useGrouping: false, numberingSystem: options.numberingSystem || 'latn' })
  const localizedFraction = [...fraction].map(digit => digits.format(Number(digit))).join('')
  return partsFormatter.formatToParts(signedWhole).map(part => part.type === 'fraction' ? localizedFraction : part.value).join('')
}

/** Visual ratio only. Null denotes an unlimited resource; product policy supplies tone/status. */
export function usagePercentage(used: number, limit: number | null): number | null {
  if (limit === null) return null
  if (!Number.isFinite(used) || !Number.isFinite(limit)) return 0
  if (limit <= 0) return used > 0 ? 100 : 0
  return Math.max(0, Math.min(100, Math.round(used / limit * 100)))
}
