export async function receiptRequest(request: Request): Promise<{ requestId: string }> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('ADMIN_REQUEST_INVALID')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2048) throw new Error('ADMIN_REQUEST_INVALID')
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const body = JSON.parse(new TextDecoder().decode(bytes))
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'requestId')
    || typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)) {
    throw new Error('ADMIN_REQUEST_INVALID')
  }
  return body
}

export interface ReceiptDependencies {
  // Must verify the user's token and return a client using that same token.
  authenticate(request: Request): Promise<{
    read(requestId: string): Promise<{ ok: boolean, storageKey?: string, evidenceId?: string }>
  }>
  sign(storageKey: string): Promise<string>
}

export function platformReceiptHandler(dependencies: ReceiptDependencies) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return respond({ ok: true })
    if (request.method !== 'POST') return respond({ error: 'METHOD_NOT_ALLOWED' }, 405)
    let caller
    try { caller = await dependencies.authenticate(request) }
    catch { return respond({ error: 'AUTHENTICATION_REQUIRED' }, 401) }
    let requestId: string
    try { ({ requestId } = await receiptRequest(request)) }
    catch { return respond({ error: 'ADMIN_REQUEST_INVALID' }, 400) }
    try {
      const receipt = await caller.read(requestId)
      if (!receipt.ok) return respond({ error: 'OPERATOR_REQUIRED' }, 403)
      if (!receipt.storageKey || !receipt.evidenceId) return respond({ error: 'RECEIPT_NOT_FOUND' }, 404)
      const url = await dependencies.sign(receipt.storageKey)
      return respond({ url, evidenceId: receipt.evidenceId, expiresIn: 60 })
    } catch { return respond({ error: 'RECEIPT_UNAVAILABLE' }, 503) }
  }
}
