/** Preserve immutable controlled selection and unavailable permissions. */
export function permissionSelection(
  selected: readonly string[], key: string, checked: boolean,
  disabled: readonly string[] = [], pending = false,
): string[] | undefined {
  if (pending || disabled.includes(key)) return undefined
  return checked ? [...new Set([...selected, key])] : selected.filter(value => value !== key)
}
