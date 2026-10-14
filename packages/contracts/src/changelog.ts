/** BS-VERSION-D01 / BS-CHANGELOG-NEW-D01: customer-authored content only. */
export const CHANGELOG_NEW_WINDOW_MS = 48 * 60 * 60 * 1000
export type ChangelogLocale = 'en' | 'ar'
export interface BilingualText { en: string; ar: string }
export interface ChangelogSuit { id: string; name: BilingualText }
export interface ChangelogLink { label: BilingualText; href: string }
interface ChangelogContent {
  id: string
  suit: string
  visibility: 'public' | 'internal'
  publishedAt: string
  title: BilingualText
  summary: BilingualText
  details: BilingualText
  links: ChangelogLink[]
}
export type ChangelogEntry = ChangelogContent & (
  | { status: 'released'; version: string; releasedAt: string; targetVersion?: never }
  | { status: 'coming-soon'; targetVersion: string; releasedAt?: never; version?: never }
)
/** serverNow must be supplied by the trusted publishing/read service, never the browser. */
export interface ChangelogFeed { serverNow: string; suits: ChangelogSuit[]; entries: ChangelogEntry[] }
export interface ChangelogFilter { suit?: string; status?: ChangelogEntry['status']; search?: string; locale?: ChangelogLocale }
export interface ChangelogCopy {
  timeline: string; suit: string; status: string; allSuits: string; allStatuses: string
  released: string; comingSoon: string; targetVersion: string; new: string
  published: string; releasedAt: string; empty: string; loading: string; error: string; denied: string; retry: string
}
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
export function isSuitVersion(value: unknown): value is string { return typeof value === 'string' && semver.test(value) }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid changelog object')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing changelog text')
  return value.trim()
}
function bilingual(value: unknown): BilingualText { const row = record(value); return { en: text(row.en), ar: text(row.ar) } }
export function changelogTimestamp(value: unknown): string {
  const stamp = text(value)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(stamp) || !Number.isFinite(Date.parse(stamp))) throw new Error('Invalid UTC changelog timestamp')
  // Date.parse normalizes impossible dates; reject those too.
  if (new Date(stamp).toISOString().slice(0, 19) !== stamp.slice(0, 19)) throw new Error('Invalid changelog date')
  return stamp
}
function version(value: unknown): string { if (!isSuitVersion(value)) throw new Error('Invalid semantic version'); return value }
function link(value: unknown): ChangelogLink {
  const row = record(value), href = text(row.href), url = new URL(href)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe changelog link')
  return { label: bilingual(row.label), href }
}
/** Project only approved content fields; unknown backend metadata never reaches rendering. */
export function parseChangelogFeed(value: unknown): ChangelogFeed {
  const row = record(value), serverNow = changelogTimestamp(row.serverNow)
  if (!Array.isArray(row.suits) || !Array.isArray(row.entries)) throw new Error('Invalid changelog collections')
  const suits = row.suits.map(value => { const suit = record(value); const id = text(suit.id); if (!/^[a-z][a-z0-9-]*-suit$/.test(id)) throw new Error('Invalid Suit identity'); return { id, name: bilingual(suit.name) } })
  const suitIds = new Set(suits.map(suit => suit.id))
  if (suitIds.size !== suits.length) throw new Error('Duplicate Suit identity')
  const entries: ChangelogEntry[] = row.entries.map(value => {
    const entry = record(value), suit = text(entry.suit), publishedAt = changelogTimestamp(entry.publishedAt)
    if (!suitIds.has(suit)) throw new Error('Unregistered Suit')
    if (entry.visibility !== 'public' && entry.visibility !== 'internal') throw new Error('Invalid changelog visibility')
    if (entry.links !== undefined && !Array.isArray(entry.links)) throw new Error('Invalid changelog links')
    const content: ChangelogContent = { id: text(entry.id), suit, visibility: entry.visibility, publishedAt,
      title: bilingual(entry.title), summary: bilingual(entry.summary), details: bilingual(entry.details), links: (entry.links as unknown[] | undefined)?.map(link) ?? [] }
    if (entry.status === 'released') {
      if (entry.targetVersion !== undefined) throw new Error('Released entry has a target version')
      const releasedAt = changelogTimestamp(entry.releasedAt)
      if (Date.parse(releasedAt) > Date.parse(publishedAt)) throw new Error('Publication precedes release')
      return { ...content, status: 'released', version: version(entry.version), releasedAt }
    }
    if (entry.status === 'coming-soon') {
      if (entry.releasedAt !== undefined || entry.version !== undefined) throw new Error('Coming Soon is not released')
      return { ...content, status: 'coming-soon', targetVersion: version(entry.targetVersion) }
    }
    throw new Error('Invalid changelog status')
  })
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate changelog entry')
  return { serverNow, suits, entries }
}
export function isChangelogNew(entry: ChangelogEntry, authoritativeNow: string): boolean {
  const age = Date.parse(changelogTimestamp(authoritativeNow)) - Date.parse(entry.publishedAt)
  return entry.status === 'released' && age >= 0 && age < CHANGELOG_NEW_WINDOW_MS
}
/** Public projection is defense in depth; the service must authorize visibility before delivery. */
export function filterChangelog(feed: ChangelogFeed, filter: ChangelogFilter = {}): ChangelogEntry[] {
  const query = filter.search?.trim().toLocaleLowerCase(), locale = filter.locale ?? 'en'
  return feed.entries.filter(entry => entry.visibility === 'public' && Date.parse(entry.publishedAt) <= Date.parse(feed.serverNow)
    && (!filter.suit || entry.suit === filter.suit) && (!filter.status || entry.status === filter.status)
    && (!query || [entry.title[locale], entry.summary[locale], entry.details[locale]].some(value => value.toLocaleLowerCase().includes(query))))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id))
}
