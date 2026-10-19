export function boundedQuantity(value: number, minimum: number, maximum: number): number | null {
  if (![value, minimum, maximum].every(Number.isFinite) || maximum < minimum) return null
  return Math.max(minimum, Math.min(maximum, value))
}
export function steppedQuantity(value: number, direction: -1 | 1, step: number, minimum: number, maximum: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return null
  return boundedQuantity(Number((value + direction * step).toPrecision(12)), minimum, maximum)
}

/** Restore an incomplete controlled numeric input on blur; manual zero/clearing never removes a record. Decrement buttons retain explicit zero intent. */
export function restoreQuantityInput(event: Event, value: number) {
  if (typeof HTMLInputElement !== 'undefined' && event.target instanceof HTMLInputElement && (event.target.value === '' || !Number.isFinite(Number(event.target.value)) || Number(event.target.value) <= 0)) event.target.value = String(value)
}
