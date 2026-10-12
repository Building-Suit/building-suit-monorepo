/** Browser interaction only; callers own URL authorization and file policy. */
export function openExternalLink(url: string) {
  if (typeof window === 'undefined') return false
  window.open(url, '_blank', 'noopener')
  return true
}
export function clearFileSelection(event: Event) {
  const target = event.target
  if (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement) target.value = ''
}
export function runPrimaryEnter(event: KeyboardEvent, submit: () => void) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { submit(); return true }
  return false
}
/** A mapping picker keeps its current selection while excluding choices used by its peers. */
export function exclusiveChoiceOptions<T extends { value: string; label: string }>(options: T[], selectedValues: string[], current: string) {
  const used = new Set(selectedValues)
  return options.map(option => ({ ...option, disabled: used.has(option.value) && option.value !== current }))
}
