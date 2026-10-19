import { DOCTOR_DOCUMENT_MAX_BYTES,DoctorDocumentFailure,doctorDocumentBytes,doctorDocumentDisposition,doctorDocumentFilename,doctorDocumentHash,doctorDocumentMime } from './files.ts'
import { doctorDocumentRequest,type DoctorDocumentBackend } from './contracts.ts'
export function createDoctorDocumentHandler(backend: (authorization: string) => DoctorDocumentBackend,origins: readonly string[]) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({ 'Cache-Control': 'no-store, private','X-Content-Type-Options': 'nosniff','X-Robots-Tag': 'noindex, nofollow','Referrer-Policy': 'no-referrer',Vary: 'Origin' })
    const json = (value: unknown,status = 200) => { headers.set('Content-Type','application/json'); return new Response(JSON.stringify(value),{ status,headers }) }
    try {
      const origin = request.headers.get('origin')
      if (origin && !origins.includes(origin)) throw new DoctorDocumentFailure(403,'denied')
      if (origin) headers.set('Access-Control-Allow-Origin',origin)
      headers.set('Access-Control-Allow-Methods','POST, OPTIONS')
      headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, x-doctor-document')
      headers.set('Access-Control-Expose-Headers','Content-Type, Content-Disposition')
      if (request.method==='OPTIONS') return new Response(null,{ status: 204,headers })
      if (request.method!=='POST') throw new DoctorDocumentFailure(405,'invalid')
      const authorization = request.headers.get('authorization') || ''
      if (!/^Bearer [A-Za-z0-9._-]+$/i.test(authorization) || authorization.length>8192) throw new DoctorDocumentFailure(401,'session')
      const data = doctorDocumentRequest(request.headers.get('x-doctor-document'))
      const operation = new URL(request.url).searchParams.get('op')
      if (!['status','upload','download'].includes(operation || '')) throw new DoctorDocumentFailure(400,'invalid')
      const service = backend(authorization)
      const actor = await service.authenticate()
      const access = await service.authorize(actor,data,operation==='upload')
      if (operation==='status') return json({ available: true,canWrite: access.canWrite,maxBytes: DOCTOR_DOCUMENT_MAX_BYTES,mimeTypes: ['application/pdf','image/png','image/jpeg'] })
      if (operation==='upload') {
        if (!doctorDocumentFilename(data.filename) || Boolean(data.documentId)!==(data.expectedVersion!==null) || data.versionId) throw new DoctorDocumentFailure(400,'invalid')
        const bytes = await doctorDocumentBytes(request)
        const mime = doctorDocumentMime(bytes,data.filename,request.headers.get('content-type'))
        const sha256 = await doctorDocumentHash(bytes)
        const reservation = await service.reserve(actor,data,{ filename: data.filename,mime,size: bytes.byteLength,sha256 })
        if (reservation.size!==bytes.byteLength || reservation.mime!==mime || reservation.sha256!==sha256) throw new DoctorDocumentFailure(503,'unavailable')
        if (reservation.state==='committed' && reservation.result) return json(reservation.result)
        await service.put(reservation,bytes)
        const stored = await service.get(reservation)
        if (stored.byteLength!==reservation.size || await doctorDocumentHash(stored)!==sha256) throw new DoctorDocumentFailure(503,'unavailable')
        return json(await service.finalize(actor,reservation.intentId))
      }
      if (!data.documentId || data.filename || data.expectedVersion!==null) throw new DoctorDocumentFailure(400,'invalid')
      const plan = await service.plan(actor,data)
      const bytes = await service.get(plan)
      if (bytes.byteLength!==plan.size || await doctorDocumentHash(bytes)!==plan.sha256) throw new DoctorDocumentFailure(503,'unavailable')
      // Recheck current grants/session after file I/O and attribute this request.
      const latest = await service.plan(actor,data,plan.versionId,data.key)
      if (latest.objectPath!==plan.objectPath || latest.sha256!==plan.sha256 || latest.versionId!==plan.versionId) throw new DoctorDocumentFailure(503,'unavailable')
      headers.set('Content-Type',plan.mime); headers.set('Content-Disposition',doctorDocumentDisposition(plan.filename))
      headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; sandbox")
      return new Response(new Uint8Array(bytes),{ status: 200,headers })
    } catch (error) {
      const safe = error instanceof DoctorDocumentFailure ? error : new DoctorDocumentFailure(503,'unavailable')
      return json({ error: safe.code },safe.status)
    }
  }
}
