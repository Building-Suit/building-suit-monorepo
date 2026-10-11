/** Download prepared text; optional delayed cleanup supports mounted native anchors. */
export function downloadText(filename, text, mimeType, options = {}) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  let link
  const cleanup = () => { if (options.mount) link?.remove(); URL.revokeObjectURL(url) }
  try {
    link = document.createElement('a')
    link.href = url
    link.download = filename
    if (options.mount) { link.hidden = true; document.body.append(link) }
    link.click()
  } catch (failure) { cleanup(); throw failure }
  if (options.cleanupDelayMs > 0) setTimeout(cleanup, options.cleanupDelayMs)
  else cleanup()
}
