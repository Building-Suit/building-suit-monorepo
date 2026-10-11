/** Download prepared content; optional delayed cleanup supports native anchors. */
export function downloadBlob(filename, blob, options = {}) {
  const url = URL.createObjectURL(blob)
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

export function downloadText(filename, text, mimeType, options = {}) {
  return downloadBlob(filename, new Blob([text], { type: mimeType }), options)
}
