import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'

export interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}
export interface SignedAttempt {
  attemptId: string
  url: string
  allowedHosts: string[]
  timeoutMs: number
  maxResponseBytes: number
  body: string
  headers: Record<string, string>
}
export interface TargetResponse { status: number; headers: Record<string, string>; body: string }

/** Reject private, loopback, link-local, multicast and reserved ranges before connecting. */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number)
    const a = octets[0]!, b = octets[1]!, c = octets[2]!
    return a !== 0 && a !== 10 && a !== 127 && a < 224
      && !(a === 100 && b! >= 64 && b! <= 127)
      && !(a === 169 && b === 254) && !(a === 172 && b! >= 16 && b! <= 31)
      && !(a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99)))
      && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      && !(a === 203 && b === 0 && c === 113)
  }
  // Only global unicast; reject transition/documentation prefixes and IPv4 mappings.
  return isIP(address) === 6 && /^[23]/i.test(address)
    && !/^(?:2001|2002|3fff):/i.test(address)
}

export async function resolveAttempt(attempt: SignedAttempt, resolve = lookup) {
  const url = new URL(attempt.url)
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash
    || url.pathname !== '/functions/v1/shop-super-admin-bridge/v1/invoke'
    || !Array.isArray(attempt.allowedHosts) || !attempt.allowedHosts.includes(url.hostname)
    || isIP(url.hostname) || !/^[a-z0-9.-]+$/i.test(url.hostname)
    || !Number.isInteger(attempt.timeoutMs) || attempt.timeoutMs < 1 || attempt.timeoutMs > 60000
    || !Number.isInteger(attempt.maxResponseBytes) || attempt.maxResponseBytes < 1 || attempt.maxResponseBytes > 1048576
    || typeof attempt.body !== 'string' || Buffer.byteLength(attempt.body) > 65536) throw new Error('Adapter egress denied')
  const addresses = await resolve(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Adapter egress denied')
  return { url, address: addresses[0]! }
}

/** DNS is resolved once and pinned in the socket lookup. TLS still verifies the configured hostname. */
export async function sendSignedAttempt(attempt: SignedAttempt): Promise<TargetResponse> {
  const startedAt = Date.now()
  let dnsTimer: ReturnType<typeof setTimeout> | undefined
  const resolved = await Promise.race([
    resolveAttempt(attempt),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error('Adapter timeout')), attempt.timeoutMs) }),
  ]).finally(() => clearTimeout(dnsTimer))
  const { url, address } = resolved
  const remaining = attempt.timeoutMs - (Date.now() - startedAt)
  if (remaining <= 0) throw new Error('Adapter timeout')
  return await new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST', headers: attempt.headers,
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [address])
        else callback(null, address.address, address.family)
      },
    }, (response) => {
      if (!response.statusCode || (response.statusCode >= 300 && response.statusCode < 400)) {
        response.destroy(); req.destroy(new Error('Adapter redirect denied')); return
      }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > attempt.maxResponseBytes) { response.destroy(); req.destroy(new Error('Adapter response too large')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => {
        clearTimeout(timer)
        // Duplicate protocol headers must never become a trusted response.
        const headers: Record<string, string> = {}
        for (let i = 0; i < response.rawHeaders.length; i += 2) {
          const name = response.rawHeaders[i]!.toLowerCase()
          if (!name.startsWith('x-bs-')) continue
          if (headers[name] !== undefined) { reject(new Error('Duplicate response header')); return }
          headers[name] = response.rawHeaders[i + 1]!
        }
        resolve({ status: response.statusCode!, headers, body: Buffer.concat(chunks).toString('utf8') })
      })
    })
    const timer = setTimeout(() => req.destroy(new Error('Adapter timeout')), remaining)
    req.on('error', (error) => { clearTimeout(timer); reject(error) })
    req.end(attempt.body)
  })
}

/** The database verifies signatures, response binding and digest before any success is exposed. */
export async function dispatchRequest(actor: RpcClient, worker: RpcClient, command: Record<string, unknown>, send = sendSignedAttempt) {
  const enqueued = await actor.rpc('super_admin_adapter_enqueue', { p_input: command })
  if (enqueued.error || typeof enqueued.data !== 'string') throw new Error('Adapter request unavailable')
  const requestId = command.requestId as string
  const claimed = await worker.rpc('super_admin_adapter_claim', { p_dispatch_id: enqueued.data })
  if (claimed.error || !claimed.data || typeof claimed.data !== 'object') return { state: 'outcome_unknown' as const, requestId }
  const attempt = claimed.data as SignedAttempt
  let response: Record<string, unknown> | null = null
  try {
    const received = await send(attempt)
    response = {
      status: received.status, body: received.body,
      algorithm: received.headers['x-bs-algorithm'], protocolVersion: received.headers['x-bs-protocol-version'],
      keyId: received.headers['x-bs-key-id'], digest: received.headers['x-bs-body-sha256'], signature: received.headers['x-bs-signature'],
    }
  } catch { /* A lost response may follow a committed target mutation. Complete as unknown. */ }
  const completed = await worker.rpc('super_admin_adapter_complete', { p_attempt_id: attempt.attemptId, p_response: response })
  if (completed.error || !completed.data || typeof completed.data !== 'object') return { state: 'outcome_unknown' as const, requestId }
  const result = completed.data as Record<string, unknown>
  if (result.code === 'target_rejected') return { state: 'target_rejected' as const, requestId }
  if (!('data' in result) || typeof result.targetAuditId !== 'string') return { state: 'outcome_unknown' as const, requestId }
  return { state: 'success' as const, requestId, data: result.data, auditId: result.targetAuditId, replayed: result.replayed === true }
}
