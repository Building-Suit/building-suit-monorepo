import type { HqEmailConnectionReadiness, HqEmailTestSnapshot } from '@building-suit/ui/types/hqEmailConnection'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const sender = 'Shop Suit Team <hello@shop.building-suit.com>'
const states = new Set(['prepared','approved','reserved','accepted','rejected','uncertain','revoked'])
const record = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
export function parseEmailTest(v: unknown): HqEmailTestSnapshot | null {
  const r = record(v)
  if (!r || typeof r.id !== 'string' || !uuid.test(r.id) || r.agentId !== 'AG-EMAIL-002' || r.managerId !== 'AG-EMAIL-001'
    || r.sender !== sender || typeof r.recipient !== 'string' || r.recipient.length > 254 || !r.recipient
    || typeof r.subject !== 'string' || !r.subject || typeof r.body !== 'string' || !r.body
    || typeof r.digest !== 'string' || !/^[0-9a-f]{64}$/.test(r.digest)
    || typeof r.expiresAt !== 'string' || !Number.isFinite(Date.parse(r.expiresAt))
    || typeof r.state !== 'string' || !states.has(r.state) || r.providerAccepted !== (r.state === 'accepted')
    || r.delivered !== false || r.providerId !== null && (typeof r.providerId !== 'string' || !uuid.test(r.providerId))) return null
  return r as unknown as HqEmailTestSnapshot
}
export function parseEmailReadiness(v: unknown): HqEmailConnectionReadiness | null {
  const r = record(v)
  if (!r || r.agentId !== 'AG-EMAIL-002' || r.managerId !== 'AG-EMAIL-001' || r.sender !== sender
    || r.domain !== 'shop.building-suit.com' || typeof r.configured !== 'boolean' || typeof r.providerTested !== 'boolean'
    || r.scope !== 'founder-test-only' || r.automaticSending !== false) return null
  return r as unknown as HqEmailConnectionReadiness
}
export function emailTestApprovable(test: HqEmailTestSnapshot | null, now: number): boolean {
  return !!test && ['prepared','approved'].includes(test.state) && Date.parse(test.expiresAt) > now
}
