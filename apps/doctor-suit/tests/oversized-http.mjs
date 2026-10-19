// An early 413 can arrive while an HTTP client is still writing its body. Keep
// the parsed response authoritative without treating socket errors as denial.
import http from 'node:http'
export function doctorOversizedResponse(url,headers,bytes) {
  const target = new URL(url)
  if (target.protocol!=='http:' || !['127.0.0.1','localhost'].includes(target.hostname) || target.username || target.password
    || target.pathname!=='/functions/v1/doctor-documents' || target.search!=='?op=upload' || !(bytes instanceof Uint8Array) || bytes.length!==5242881) throw new Error('Invalid owned oversized fixture request')
  return new Promise((resolve,reject) => {
    let sent = false; let settled = false; let fallback
    const request = http.request(target,{ method: 'POST',headers: { ...headers,'Content-Length': String(bytes.length),Expect: '100-continue' } })
    const finish = (error,status) => { if (settled) return; settled = true; clearTimeout(fallback); error ? reject(new Error('Owned oversized HTTP transport unavailable')) : resolve(status); request.destroy() }
    const send = () => { if (sent || settled) return; sent = true; request.end(bytes) }
    request.on('continue',send)
    request.on('response',response => { response.on('error',() => undefined); response.resume(); finish(null,response.statusCode) })
    request.on('error',() => finish(true))
    request.setTimeout(15000,() => finish(true))
    request.flushHeaders()
    // Some intermediaries do not forward an interim Continue response.
    fallback = setTimeout(send,500)
  })
}
