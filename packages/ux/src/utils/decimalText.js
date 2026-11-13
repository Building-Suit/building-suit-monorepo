/** Normalize typed decimal glyphs without parsing, rounding or accepting grouping.
 * Precision, signs and business limits remain the caller's validation policy.
 * @param {string} value
 * @returns {string}
 */
export function normalizeDecimalText(value) {
  return value.trim()
    .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, '.')
    .replace(/\u2212/g, '-')
    .replace(/^([+-]?)0+(?=[0-9])/, '$1')
}
