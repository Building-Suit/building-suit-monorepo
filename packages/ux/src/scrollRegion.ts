/** Physical horizontal arrows scroll only the focused overflow region itself.
 * Descendant editors/buttons and modified shortcuts keep their native behavior. */
export function scrollRegionKey(event: KeyboardEvent) {
  const region = event.currentTarget as HTMLElement | null
  if (!region || event.target !== region || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      !['ArrowLeft', 'ArrowRight'].includes(event.key) || region.scrollWidth <= region.clientWidth) return
  event.preventDefault()
  region.scrollBy({left: (event.key === 'ArrowLeft' ? -1 : 1) * Math.max(1, Math.floor(region.clientWidth / 2)), behavior: 'instant'})
}
