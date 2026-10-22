import { rasterDimensions } from './readPublicLogo.ts'
/** Re-encode owner-selected website media; keep the existing bounded raster contract. */
export async function readWebsiteImage(file: File): Promise<string> {
 if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size < 20 || file.size > 5 * 1024 * 1024) throw Error('INVALID_WEBSITE_IMAGE')
 const bytes = new Uint8Array(await file.arrayBuffer()), dimensions = rasterDimensions(bytes,file.type)
 if (!dimensions || dimensions.some(v => v < 1 || v > 8192) || dimensions[0] * dimensions[1] > 16000000) throw Error('INVALID_WEBSITE_IMAGE')
 const bitmap = await createImageBitmap(file)
 try {
  const scale = Math.min(1,2048 / bitmap.width,2048 / bitmap.height)
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale))
  const context = canvas.getContext('2d'); if (!context) throw Error('INVALID_WEBSITE_IMAGE')
  context.drawImage(bitmap,0,0,canvas.width,canvas.height)
  for (const quality of [.86,.72,.58,.42,.28]) { const result=canvas.toDataURL('image/webp',quality); if (result.length<=174790) return result }
  throw Error('WEBSITE_IMAGE_TOO_LARGE')
 } finally { bitmap.close() }
}
