/** Read bounded raster bytes for a self-contained, immutable document image. */
export async function readRasterImage(file: File, maximumBytes = 131072): Promise<string> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size === 0 || file.size > maximumBytes) throw new Error('INVALID_DOCUMENT_IMAGE')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = Array.from(bytes.slice(0, 8), byte => byte.toString(16).padStart(2, '0')).join('')
  if ((file.type === 'image/png' && signature !== '89504e470d0a1a0a') || (file.type === 'image/jpeg' && !signature.startsWith('ffd8ff'))) throw new Error('INVALID_DOCUMENT_IMAGE')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:${file.type};base64,${btoa(binary)}`
}
