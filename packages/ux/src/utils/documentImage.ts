/** Write starts synchronously in the click handler; rasterization resolves inside ClipboardItem. */
export async function copyDocumentImage(render: () => Promise<Blob>, clipboard = globalThis.navigator?.clipboard, Item = globalThis.ClipboardItem) {
  if (!clipboard?.write || !Item || (Item.supports && !Item.supports('image/png'))) throw new Error('IMAGE_CLIPBOARD_UNAVAILABLE')
  const image = render()
  // Prevent an unhandled render rejection if the browser denies write immediately.
  void image.catch(() => undefined)
  await clipboard.write([new Item({ 'image/png': image })])
}

export async function renderDocumentImage(markup: string): Promise<Blob> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:80mm;pointer-events:none;background:white;'
  host.setAttribute('aria-hidden', 'true')
  // Markup comes only from the shared escaped document renderer, never raw merchant HTML.
  host.innerHTML = markup
  document.body.append(host)
  try {
    const node = host.firstElementChild as HTMLElement | null
    if (!node) throw new Error('EMPTY_DOCUMENT')
    await document.fonts.ready
    await Promise.all(Array.from(node.querySelectorAll('img'), async img => {
      // A broken asset must not silently produce an incomplete receipt.
      await img.decode()
    }))
    const { getFontEmbedCSS } = await import('html-to-image')
    const fontEmbedCSS = await getFontEmbedCSS(node)
    const width = Math.ceil(node.getBoundingClientRect().width)
    const height = Math.max(node.scrollHeight, Math.ceil(node.getBoundingClientRect().height))
    if (height * 3 > 32767 || width * height * 9 > 100_000_000) throw new Error('DOCUMENT_TOO_LARGE')
    // Preserve the document's own layout rules. Computed-style cloning freezes
    // line boxes and can change font metrics inside SVG, clipping Arabic/totals.
    const clone = node.cloneNode(true) as HTMLElement
    const computed = getComputedStyle(node)
    clone.style.fontFamily = computed.fontFamily
    // The detached SVG has no application root from which to inherit tokens.
    for (const property of Array.from(computed)) {
      if (property.startsWith('--')) clone.style.setProperty(property, computed.getPropertyValue(property))
    }
    const fonts = document.createElement('style')
    fonts.textContent = fontEmbedCSS
    clone.prepend(fonts)
    await Promise.all(Array.from(clone.querySelectorAll('img'), async image => {
      if (image.src.startsWith('data:')) return
      const url = new URL(image.src, document.baseURI)
      if (url.origin !== location.origin) throw new Error('EXTERNAL_DOCUMENT_ASSET')
      const response = await fetch(url, { credentials: 'same-origin' })
      if (!response.ok) throw new Error('DOCUMENT_ASSET_FAILED')
      const asset = await response.blob()
      image.src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('DOCUMENT_ASSET_FAILED'))
        reader.readAsDataURL(asset)
      })
    }))
    const serialized = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`
    const image = new Image()
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width * 3
    canvas.height = height * 3
    const context = canvas.getContext('2d')
    if (!context) throw new Error('IMAGE_RENDER_FAILED')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.scale(3, 3)
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob || blob.type !== 'image/png') throw new Error('IMAGE_RENDER_FAILED')
    return blob
  }
  finally { host.remove() }
}

export async function downloadDocumentImage(render: () => Promise<Blob>, filename: string) {
  const blob = await render()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.replace(/[^a-z0-9_.-]/gi, '_') + '.png'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
