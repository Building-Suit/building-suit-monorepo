export const DOCTOR_DOCUMENT_BUCKET = 'doctor-private-documents'
export const DOCTOR_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024
export type DoctorFileMime = 'application/pdf' | 'image/png' | 'image/jpeg'
export class DoctorDocumentFailure extends Error {
  readonly status: number
  readonly code: 'session' | 'denied' | 'invalid' | 'size' | 'type' | 'conflict' | 'unavailable'
  constructor(status: number,code: DoctorDocumentFailure['code']) { super(code); this.status = status; this.code = code }
}
export function doctorDocumentFilename(value: unknown): value is string {
  return typeof value==='string' && value.length>=1 && value.length<=160 && value.trim()===value
    && !Array.from(value).some(character => character.charCodeAt(0)<32 || character.charCodeAt(0)===127)
    && !/[\u202a-\u202e\u2066-\u2069/\\]/u.test(value)
}
export async function doctorDocumentBytes(request: Request): Promise<Uint8Array> {
  const length = request.headers.get('content-length')
  if (length!==null && (!/^\d+$/.test(length) || Number(length)>DOCTOR_DOCUMENT_MAX_BYTES)) throw new DoctorDocumentFailure(413,'size')
  const reader = request.body?.getReader()
  if (!reader) throw new DoctorDocumentFailure(400,'invalid')
  const buffer = new Uint8Array(DOCTOR_DOCUMENT_MAX_BYTES); let total = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      total+=next.value.byteLength
      if (total>DOCTOR_DOCUMENT_MAX_BYTES) { await reader.cancel().catch(() => undefined); throw new DoctorDocumentFailure(413,'size') }
      buffer.set(next.value,total-next.value.byteLength)
    }
  } finally { reader.releaseLock() }
  if (total===0 || (length!==null && total!==Number(length))) throw new DoctorDocumentFailure(400,'invalid')
  return buffer.subarray(0,total)
}
export function doctorDocumentMime(bytes: Uint8Array,filename: string,declared: string | null): DoctorFileMime {
  if (!doctorDocumentFilename(filename) || bytes.length<8 || bytes.length>DOCTOR_DOCUMENT_MAX_BYTES) throw new DoctorDocumentFailure(400,'invalid')
  const ascii = (from: number,to: number) => String.fromCharCode(...bytes.subarray(from,to))
  let mime: DoctorFileMime | null = null
  if (/^%PDF-[12]\.\d/.test(ascii(0,8)) && /%%EOF\s*$/.test(ascii(Math.max(0,bytes.length-1024),bytes.length))) mime = 'application/pdf'
  if (bytes.length>=33 && bytes.subarray(0,8).every((value,index) => value===[137,80,78,71,13,10,26,10][index]) && ascii(12,16)==='IHDR') {
    const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
    const width = view.getUint32(16); const height = view.getUint32(20)
    if (width>=1 && height>=1 && width<=8192 && height<=8192) mime = 'image/png'
  }
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217) mime = 'image/jpeg'
  const extension = filename.toLowerCase().split('.').at(-1)
  if (!mime || (mime==='application/pdf' && extension!=='pdf') || (mime==='image/png' && extension!=='png') || (mime==='image/jpeg' && !['jpg','jpeg'].includes(extension || ''))
    || (declared && declared.split(';')[0]?.trim().toLowerCase()!==mime && declared!=='application/octet-stream')) throw new DoctorDocumentFailure(415,'type')
  return mime
}
export async function doctorDocumentHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))
  return Array.from(new Uint8Array(digest),value => value.toString(16).padStart(2,'0')).join('')
}
export function doctorDocumentDisposition(filename: string) {
  if (!doctorDocumentFilename(filename)) throw new DoctorDocumentFailure(503,'unavailable')
  return `attachment; filename="document.${filename.split('.').at(-1)?.toLowerCase()}"; filename*=UTF-8''${encodeURIComponent(filename).replaceAll("'",'%27').replaceAll('(','%28').replaceAll(')','%29')}`
}
