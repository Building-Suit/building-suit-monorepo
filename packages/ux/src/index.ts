/** Neutralize spreadsheet formulas without corrupting numeric negative values. */
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
}

export type ConfirmationTone = 'default' | 'danger'

export interface ConfirmationRequest {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmationTone
}

/**
 * Produce a deterministic snapshot for dirty-form comparison.
 *
 * Product forms retain their domain values and validation. The shared action
 * controller only needs a stable representation, including Set/Map values and
 * objects whose keys were inserted in a different order.
 */
export function recordSnapshot(value: unknown): string {
  return JSON.stringify(normalizeSnapshotValue(value, new WeakSet())) ?? 'undefined'
}

function normalizeSnapshotValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (!value || typeof value !== 'object' || value instanceof Date) return value
  if (ancestors.has(value)) throw new TypeError('Record action values must not contain circular references')
  ancestors.add(value)
  let normalized: unknown
  if (value instanceof Set) {
    normalized = { type: 'Set', values: [...value].map(item => normalizeSnapshotValue(item, ancestors)).sort(compareSnapshotValues) }
  }
  else if (value instanceof Map) {
    normalized = {
      type: 'Map',
      entries: [...value.entries()]
        .map(([key, item]) => [normalizeSnapshotValue(key, ancestors), normalizeSnapshotValue(item, ancestors)])
        .sort(([a], [b]) => compareSnapshotValues(a, b)),
    }
  }
  else if (Array.isArray(value)) {
    normalized = value.map(item => normalizeSnapshotValue(item, ancestors))
  }
  else {
    normalized = Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, normalizeSnapshotValue(item, ancestors)]))
  }
  ancestors.delete(value)
  return normalized
}

function compareSnapshotValues(first: unknown, second: unknown): number {
  return JSON.stringify(first).localeCompare(JSON.stringify(second))
}

export const interactionPolicy = Object.freeze({
  recordPresentation: 'modal',
  closeOnEscape: true,
  dismissableMask: false,
  protectDirtyForms: true,
  confirmationPresentation: 'modal',
} as const)
