export const CATALOG_IMAGE_BUCKET = 'shop-catalog-images'
export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export function catalogImageExtension(type: string): 'jpg' | 'png' | 'webp' | null {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : null
}
/** Reject mislabeled active content before upload; Storage separately enforces MIME/size and access. */
export async function validateCatalogUpload(file: Pick<File, 'type' | 'size' | 'slice'>): Promise<void> {
  const extension = catalogImageExtension(file.type)
  if (!extension || file.size < 1 || file.size > CATALOG_IMAGE_MAX_BYTES) throw new Error('INVALID_CATALOG_IMAGE')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const valid = extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : extension === 'png' ? [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte)
    : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP'
  if (!valid) throw new Error('INVALID_CATALOG_IMAGE')
}
export function catalogObjectName(shop: string, kind: 'products' | 'services', id: string, type: string): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  const extension = catalogImageExtension(type)
  if (!uuid.test(shop) || !uuid.test(id) || !extension) throw new Error('INVALID_CATALOG_IMAGE')
  return `${shop}/${kind}/${id}.${extension}`
}
