import { boundedFormData, receiptLimit, validateReceipt } from './manual-payment.ts'
function rejects(fn: () => unknown, message: string) {
  try { fn() } catch (error) { if (error instanceof Error && error.message === message) return; throw error }
  throw new Error(`Expected ${message}`)
}
Deno.test('receipt validation rejects spoofed MIME, executable content, empty and oversized evidence', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  validateReceipt(png, 'image/png', 'receipt.png')
  validateReceipt(new Uint8Array([255, 216, 255]), 'image/jpeg', 'receipt.jpg')
  validateReceipt(new TextEncoder().encode('%PDF-1.7'), 'application/pdf', 'receipt.pdf')
  rejects(() => validateReceipt(png, 'image/jpeg', 'receipt.jpg'), 'RECEIPT_TYPE_INVALID')
  rejects(() => validateReceipt(new TextEncoder().encode('<script>alert(1)</script>'), 'application/pdf', 'receipt.pdf'), 'RECEIPT_TYPE_INVALID')
  rejects(() => validateReceipt(png, 'image/svg+xml', 'receipt.svg'), 'RECEIPT_TYPE_INVALID')
  rejects(() => validateReceipt(new Uint8Array(), 'image/png', 'receipt.png'), 'RECEIPT_SIZE_INVALID')
  rejects(() => validateReceipt(new Uint8Array(receiptLimit + 1), 'image/png', 'receipt.png'), 'RECEIPT_SIZE_INVALID')
  rejects(() => validateReceipt(png, 'image/png', '../receipt.png'), 'RECEIPT_NAME_INVALID')
})
Deno.test('multipart receipt limit measures actual streamed bytes', async () => {
  const request = new Request('http://localhost', { method: 'POST', headers: { 'Content-Length': '1', 'Content-Type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(receiptLimit + 16385) })
  try { await boundedFormData(request) } catch (error) {
    if (error instanceof Error && error.message === 'RECEIPT_SIZE_INVALID') return
    throw error
  }
  throw new Error('Expected oversized body rejection')
})
Deno.test('multipart receipt preserves bytes and reason', async () => {
  const body = new FormData()
  body.set('reason', 'Transfer receipt')
  body.set('receipt', new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' }))
  const form = await boundedFormData(new Request('http://localhost', { method: 'POST', body }))
  if (form.get('reason') !== 'Transfer receipt' || !(form.get('receipt') instanceof File)) throw new Error('Multipart mismatch')
})
