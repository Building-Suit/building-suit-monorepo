import { HQ_AGENT_UUID, hasHqControlCharacters, type HqBusinessTask } from './agents'
export type HqTaskGroup = 'running' | 'waiting' | 'done'
export interface HqTaskPage { items: HqBusinessTask[]; counts: Record<HqTaskGroup, number> }
/** Summaries deliberately omit long fields. Details use the same bounded shape. */
export function parseHqTaskPage(value: unknown): HqTaskPage | null {
  if (!value || typeof value !== 'object') return null
  const page = value as HqTaskPage
  if (!page.counts || !['running', 'waiting', 'done'].every(key => Number.isSafeInteger(page.counts[key as HqTaskGroup]) && page.counts[key as HqTaskGroup] >= 0)
    || !Array.isArray(page.items) || page.items.length > 12) return null
  const seen = new Set<string>()
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max && !hasHqControlCharacters(v)
  const date = (v: unknown) => typeof v === 'string' && v.length <= 64 && Number.isFinite(Date.parse(v))
  for (const t of page.items) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !HQ_AGENT_UUID.test(t.id) || seen.has(t.id)
      || !text(t.title, 180) || !t.title.trim() || !text(t.brief, 12000) || !text(t.acceptance, 6000)
      || !(t.assigneeId === null || typeof t.assigneeId === 'string' && /^AG-[A-Z]+-[0-9]{3}$/.test(t.assigneeId))
      || !['queued','working','review','completed','blocked','canceled'].includes(t.status)
      || !date(t.createdAt) || !date(t.updatedAt) || !(t.completedAt === null || date(t.completedAt))
      || !Number.isInteger(t.repairCount) || t.repairCount < 0 || t.repairCount > 2
      || !(t.deliverable === null || text(t.deliverable, 32000)) || !(t.reviewSummary === null || text(t.reviewSummary, 8000))
      || !(t.error === null || typeof t.error === 'string' && /^[a-z-]{1,80}$/.test(t.error))) return null
    seen.add(t.id)
  }
  // Explicit projection: never forward provider-only task properties.
  return { counts: { running: page.counts.running, waiting: page.counts.waiting, done: page.counts.done }, items: page.items.map(t => ({
    id: t.id, title: t.title, brief: t.brief, acceptance: t.acceptance, assigneeId: t.assigneeId,
    status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt,
    repairCount: t.repairCount, deliverable: t.deliverable, reviewSummary: t.reviewSummary, error: t.error,
  })) }
}
