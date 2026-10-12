import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { AdapterError } from './shop-adapter.ts'
import type { SignedAttempt, WireResponse } from './shop-adapter.ts'

// Conservative IPv4 egress. IPv6 is unavailable until an explicit reviewed policy supports it.
export function isPublicAddress(address: string) {
  if (isIP(address) !== 4) return false
  const [a, b] = address.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a! >= 224 || a === 169 && b === 254
    || a === 172 && b! >= 16 && b! <= 31 || a === 192 && (b === 168 || b === 0 || b === 2 || b === 88)
    || a === 100 && b! >= 64 && b! <= 127 || a === 198 && (b === 18 || b === 19 || b === 51)
    || a === 203 && b === 0)
}
export async function sendAdapterAttempt(attempt: SignedAttempt): Promise<WireResponse> {
  const url = new URL(attempt.url)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search
    || url.port && url.port !== '443' || !attempt.allowedHosts.includes(url.hostname)
    || url.pathname !== '/functions/v1/shop-super-admin-bridge/v1/invoke'
    || !Number.isInteger(attempt.timeoutMs) || attempt.timeoutMs < 1
    || !Number.isInteger(attempt.maxResponseBytes) || attempt.maxResponseBytes < 1) throw new AdapterError('configuration_unavailable')
  const startedAt = Date.now()
  let dnsTimer: ReturnType<typeof setTimeout> | undefined
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new AdapterError('outcome_unknown')), Math.max(1, attempt.timeoutMs - (Date.now() - startedAt))) }),
  ]).finally(() => clearTimeout(dnsTimer))
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new AdapterError('configuration_unavailable')
  // Pin the validated DNS result while retaining hostname certificate verification/SNI.
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST', headers: attempt.headers, rejectUnauthorized: true, family: 4,
      lookup: (_hostname, _options, callback) => callback(null, addresses[0]!.address, 4),
    }, (res) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > attempt.maxResponseBytes) req.destroy(new AdapterError('outcome_unknown'))
        else chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => {
        const header = (key: string) => typeof res.headers[key] === 'string' ? res.headers[key] as string : ''
        resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8'), signature: header('x-bs-signature'), algorithm: header('x-bs-algorithm'), keyId: header('x-bs-key-id'), protocolVersion: header('x-bs-protocol-version'), digest: header('x-bs-body-sha256') })
      })
    })
    const timer = setTimeout(() => req.destroy(new AdapterError('outcome_unknown')), Math.max(1, attempt.timeoutMs - (Date.now() - startedAt)))
    req.on('close', () => clearTimeout(timer))
    req.on('error', reject)
    req.end(attempt.body)
  })
}
