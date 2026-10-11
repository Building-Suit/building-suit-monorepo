/** Immutable row edits for controlled forms; reject stale or out-of-range indexes. */
export function replaceDraftRow<Row>(rows: readonly Row[], index: number, value: Row): Row[] { return Number.isInteger(index) && index >= 0 && index < rows.length ? rows.map((row, position) => position === index ? value : row) : [...rows] }
export function appendDraftRow<Row>(rows: readonly Row[], value: Row): Row[] { return [...rows, value] }
export function removeDraftRow<Row>(rows: readonly Row[], index: number, minimum = 0): Row[] { return rows.length > minimum && Number.isInteger(index) && index >= 0 && index < rows.length ? rows.filter((_, position) => position !== index) : [...rows] }
