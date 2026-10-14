/** Resolve roving tab focus without depending on a renderer or product state. */
export function tabNavigationTarget(
  keys: readonly string[], current: string, key: string, direction: 'ltr' | 'rtl' = 'ltr',
): string | undefined {
  if (!keys.length) return undefined
  if (key === 'Home') return keys[0]
  if (key === 'End') return keys[keys.length - 1]
  const forward = key === 'ArrowDown' || key === (direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
  const backward = key === 'ArrowUp' || key === (direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft')
  if (!forward && !backward) return undefined
  const index = Math.max(0, keys.indexOf(current))
  return keys[(index + (forward ? 1 : -1) + keys.length) % keys.length]
}
