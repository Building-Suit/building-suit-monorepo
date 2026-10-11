/** Download a prepared text document and release its temporary browser resource. */
export function downloadText(filename, text, mimeType) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
