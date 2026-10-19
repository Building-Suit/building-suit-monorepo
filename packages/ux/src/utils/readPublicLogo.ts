/** Decode bounded raster input and discard metadata/trailing content by re-encoding.
 * This browser interaction never uploads a file or chooses a tenant. */
export async function readPublicLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size < 20 || file.size > 131072) throw new Error('INVALID_PUBLIC_LOGO')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const hex = Array.from(bytes.slice(0, 12), v => v.toString(16).padStart(2, '0')).join('')
  if ((file.type === 'image/png' && !hex.startsWith('89504e470d0a1a0a')) || (file.type === 'image/jpeg' && !hex.startsWith('ffd8ff')) || (file.type === 'image/webp' && (!hex.startsWith('52494646') || !hex.endsWith('57454250')))) throw new Error('INVALID_PUBLIC_LOGO')
  // Read dimensions before allocating a decoder bitmap (compressed raster bombs).
  const dimensions = rasterDimensions(bytes, file.type)
  if (!dimensions || dimensions.some(value => value < 1 || value > 2048)) throw new Error('INVALID_PUBLIC_LOGO')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > 2048 || bitmap.height > 2048) throw new Error('INVALID_PUBLIC_LOGO')
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('INVALID_PUBLIC_LOGO')
    context.drawImage(bitmap, 0, 0)
    const result = canvas.toDataURL('image/png')
    if (result.length > 174790) throw new Error('INVALID_PUBLIC_LOGO')
    return result
  } finally { bitmap.close() }
}

function rasterDimensions(bytes: Uint8Array, mime: string): [number, number] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (mime === 'image/png') return bytes.length >= 33 ? [view.getUint32(16), view.getUint32(20)] : null
  if (mime === 'image/webp') {
    if (bytes.length < 25 || view.getUint32(4, true) !== bytes.length - 8) return null
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8L' && bytes[20] === 47) {
      const packed = view.getUint32(21, true)
      return [1 + (packed & 16383), 1 + ((packed >>> 14) & 16383)]
    }
    if (chunk === 'VP8X' && bytes.length >= 30) return [1 + bytes[24]! + bytes[25]! * 256 + bytes[26]! * 65536, 1 + bytes[27]! + bytes[28]! * 256 + bytes[29]! * 65536]
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return [view.getUint16(26, true) & 16383, view.getUint16(28, true) & 16383]
    return null
  }
  let position = 2
  while (position + 8 < bytes.length) {
    if (bytes[position] !== 255) return null
    const marker = bytes[position + 1]!
    if (marker === 255) { position++; continue }
    if ([1,216,208,209,210,211,212,213,214,215].includes(marker)) { position += 2; continue }
    if ([217,218].includes(marker)) return null
    const length = view.getUint16(position + 2)
    if (length < 2 || position + 2 + length > bytes.length) return null
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return length >= 8 ? [view.getUint16(position + 7), view.getUint16(position + 5)] : null
    position += 2 + length
  }
  return null
}
