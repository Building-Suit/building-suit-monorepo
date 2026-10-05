/** Neutralize spreadsheet formulas without corrupting numeric negative values. */
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
}

export type BsDataTableRowAction = 'edit' | 'delete' | 'archive' | 'void'
export type BsDataTableAlign = 'start' | 'center' | 'end'
export type BsDataTableWidth = 'selection' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'content'
export type BsDataTableSticky = 'start' | 'end'

/**
 * Bs-owned column description. Presentation is intentionally semantic: Suit
 * consumers cannot pass vendor classes, styles, or passthrough configuration.
 * A `cell-${key}` slot may provide domain presentation while keeping the
 * rendered content behind the Bs-only template boundary.
 */
export interface BsDataTableColumn<Row extends object = Record<string, unknown>> {
  key: string
  field?: string
  header: string
  value?: (row: Row) => unknown
  format?: (value: unknown, row: Row) => string | number | null | undefined
  align?: BsDataTableAlign
  headerAlign?: BsDataTableAlign
  width?: BsDataTableWidth
  sticky?: BsDataTableSticky
  sortable?: boolean
  sortField?: string
  filterField?: string
  filterMatchMode?: string
  hidden?: boolean
  exportable?: boolean
  selectionMode?: 'single' | 'multiple'
}

/**
 * Presentation capabilities are deliberately separate from server authority.
 * Products derive these flags from trusted access state and still authorize
 * every command on the server.
 */
export interface BsDataTableCapabilities {
  insert?: boolean
  edit?: boolean
  delete?: boolean
  archive?: boolean
  void?: boolean
  export?: boolean
  select?: boolean
}

export interface BsDataTableActionLabels {
  insert?: string
  edit?: string
  delete?: string
  archive?: string
  void?: string
  actions?: string
}

export interface BsDataTablePageQuery {
  first: number
  rows: number
  page: number
  pageCount: number
}

export interface BsDataTableSortQuery {
  sortField?: string | ((item: unknown) => string) | null
  sortOrder?: 0 | 1 | -1 | null
}

export interface BsDataTableFilterQuery extends BsDataTableSortQuery {
  filters: Record<string, unknown>
}

/** Optional typed bridge for a product-owned lazy query adapter. */
export interface BsDataTableQueryAdapter {
  search?: (value: string) => void
  page?: (event: BsDataTablePageQuery) => void
  sort?: (event: BsDataTableSortQuery) => void
  filter?: (event: BsDataTableFilterQuery) => void
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
