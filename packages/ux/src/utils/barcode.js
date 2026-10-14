export const emptyScanState = () => ({ value: '', lastAt: 0 })

export function captureBarcodeKey(state, key, occurredAt, options = {}) {
  const maxGap = options.maxGap ?? 80
  const minLength = options.minLength ?? 3
  if (key === 'Enter') {
    const code = state.value.length >= minLength ? state.value : null
    return { state: emptyScanState(), code }
  }
  if (key.length !== 1 || occurredAt - state.lastAt > maxGap) {
    return { state: key.length === 1 ? { value: key, lastAt: occurredAt } : emptyScanState(), code: null }
  }
  return { state: { value: state.value + key, lastAt: occurredAt }, code: null }
}

