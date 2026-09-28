export const receiptLimit = 5 * 1024 * 1024
export const receiptTypes = ['image/jpeg', 'image/png', 'application/pdf'] as const

export function validateReceipt(bytes: Uint8Array, mime: string, filename: string) {
  if (!bytes.length || bytes.length > receiptLimit) throw new Error('RECEIPT_SIZE_INVALID')
  if (!filename.trim() || filename.length > 255 || /[\x00-\x1f/\\]/.test(filename)) throw new Error('RECEIPT_NAME_INVALID')
  const signatures: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  }
  const signature = signatures[mime]
  if (!signature || !signature.every((byte, index) => bytes[index] === byte)) throw new Error('RECEIPT_TYPE_INVALID')
}

// Bound actual bytes, not the untrusted Content-Length header.
export async function boundedFormData(request: Request): Promise<FormData> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('RECEIPT_REQUIRED')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > receiptLimit + 16384) throw new Error('RECEIPT_SIZE_INVALID')
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return new Response(bytes, { headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' } }).formData()
}
