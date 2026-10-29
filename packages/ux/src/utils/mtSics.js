// Verified MT-SICS level0/1 subset. The device's host unit can differ from its
// display unit. No reset, calibration, zero or automatic tare command is sent.
function content(frame) {
  if (typeof frame !== 'string' || frame.length > 128 || !/^[\x20-\x7e]+\r\n$/.test(frame)) throw new Error('SCALE_INVALID_FRAME')
  const text = frame.slice(0, -2)
  if (['ES', 'ET', 'EL'].includes(text)) throw new Error('SCALE_DEVICE_ERROR')
  return text
}
function decimal(text) {
  if (!/^-?\d{1,10}(?:\.\d{1,6})?$/.test(text)) throw new Error('SCALE_UNSUPPORTED_PRECISION')
  const negative = text.startsWith('-'), [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.')
  return (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))) * (negative ? -1n : 1n)
}
function printable(value) {
  const negative = value < 0n, magnitude = negative ? -value : value
  const tail = String(magnitude % 1000000n).padStart(6, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${magnitude / 1000000n}${tail ? '.' + tail : ''}`
}
export function parseSicsWeight(frame, command) {
  if (!['S', 'TA', 'T'].includes(command)) throw new Error('SCALE_UNSUPPORTED_COMMAND')
  const text = content(frame), id = command === 'TA' ? 'TA' : command === 'T' ? 'T' : 'S'
  if (text === `${id} +`) throw new Error('SCALE_OVERLOAD')
  if (text === `${id} -`) throw new Error('SCALE_UNDERLOAD')
  if (text === `${id} I` || text === `${id} L`) throw new Error('SCALE_NOT_READY')
  const match = /^(S|TA|T) ([SAD]) (.{10}) ([A-Za-z]+)$/.exec(text)
  if (!match || match[1] !== id) throw new Error('SCALE_UNEXPECTED_RESPONSE')
  if (match[2] === 'D') throw new Error('SCALE_UNSTABLE')
  if (match[2] !== (command === 'TA' ? 'A' : 'S') || !/^ *-?\d+(?:\.\d+)?$/.test(match[3])) throw new Error('SCALE_INVALID_FRAME')
  if (!['kg', 'g'].includes(match[4])) throw new Error('SCALE_UNSUPPORTED_UNIT')
  return { value: printable(decimal(match[3].trim())), unit: match[4], raw: frame }
}
export function parseSicsIdentity(frame) {
  const match = /^I4 A "([^"\\]{1,64})"$/.exec(content(frame))
  if (!match || !match[1].trim()) throw new Error('SCALE_IDENTITY_UNAVAILABLE')
  return match[1]
}
export function parseSicsCapability(frame) {
  const match = /^I0 ([BA]) ([0-3]) "([A-Z0-9@]{1,16})"$/.exec(content(frame))
  if (!match) throw new Error('SCALE_CAPABILITIES_UNAVAILABLE')
  return { final: match[1] === 'A', level: Number(match[2]), command: match[3] }
}
/** Stable net is bracketed by equal tare readings; never assume tare is zero. */
export function sicsNetReading(tareBeforeFrame, stableFrame, tareAfterFrame) {
  const before = parseSicsWeight(tareBeforeFrame, 'TA'), net = parseSicsWeight(stableFrame, 'S'), after = parseSicsWeight(tareAfterFrame, 'TA')
  if (before.unit !== net.unit || after.unit !== net.unit) throw new Error('SCALE_UNIT_CHANGED')
  if (before.value !== after.value) throw new Error('SCALE_TARE_CHANGED')
  if (decimal(net.value) <= 0n || decimal(before.value) < 0n) throw new Error('SCALE_INVALID_NET')
  return { net: net.value, tare: before.value, gross: printable(decimal(net.value) + decimal(before.value)), unit: net.unit,
    tareBefore: tareBeforeFrame, stable: stableFrame, tareAfter: tareAfterFrame }
}
