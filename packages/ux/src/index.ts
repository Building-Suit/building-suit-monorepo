/** Neutralize spreadsheet formulas without corrupting numeric negative values. */
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
}
export const interactionPolicy = Object.freeze({ recordPresentation: 'modal', closeOnEscape: true, dismissableMask: false, protectDirtyForms: true } as const)
