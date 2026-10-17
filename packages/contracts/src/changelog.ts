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
  | { status: 'released'; versionOrigin?: 'retrospective'; version: string; releasedAt: string; targetVersion?: never }
  | { status: 'coming-soon'; targetVersion: string; releasedAt?: never; version?: never }
)
/** serverNow must be supplied by the trusted publishing/read service, never the browser. */
export interface ChangelogFeed { serverNow: string; suits: ChangelogSuit[]; entries: ChangelogEntry[] }
export interface ChangelogFilter { suit?: string; status?: ChangelogEntry['status']; search?: string; locale?: ChangelogLocale }
export interface ChangelogCopy {
  timeline: string; suit: string; status: string; allSuits: string; allStatuses: string
  released: string; comingSoon: string; targetVersion: string; new: string
  retrospective: string; emptyReleased?: string; emptyComingSoon?: string; updated?: string; published: string; releasedAt: string; empty: string; loading: string; error: string; denied: string; retry: string
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
      if (entry.versionOrigin !== undefined && entry.versionOrigin !== 'retrospective') throw new Error('Invalid version origin')
      return { ...content, status: 'released', version: version(entry.version), releasedAt, ...(entry.versionOrigin === 'retrospective' ? { versionOrigin: 'retrospective' as const } : {}) }
    }
    if (entry.status === 'coming-soon') {
      if (entry.releasedAt !== undefined || entry.version !== undefined || entry.versionOrigin !== undefined) throw new Error('Coming Soon is not released')
      return { ...content, status: 'coming-soon', targetVersion: version(entry.targetVersion) }
    }
    throw new Error('Invalid changelog status')
  })
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate changelog entry')
  return { serverNow, suits, entries }
}
export function isChangelogNew(entry: ChangelogEntry, authoritativeNow: string): boolean {
  const age = Date.parse(changelogTimestamp(authoritativeNow)) - Date.parse(entry.publishedAt)
  return entry.status === 'released' && entry.versionOrigin !== 'retrospective' && age >= 0 && age < CHANGELOG_NEW_WINDOW_MS
}
function compareText(left: string, right: string): number { return left === right ? 0 : left < right ? -1 : 1 }
function compareNumericIdentifier(left: string, right: string): number {
  // SemVer permits arbitrarily large integers. Number conversion would lose precedence precision.
  return left.length - right.length || compareText(left, right)
}
/** Standard SemVer precedence, ascending; build metadata does not affect precedence. */
export function compareSuitVersions(left: string, right: string): number {
  const a = semver.exec(version(left))!, b = semver.exec(version(right))!
  for (const index of [1, 2, 3]) {
    const difference = compareNumericIdentifier(a[index]!, b[index]!)
    if (difference) return difference
  }
  const aPre = a[4], bPre = b[4]
  if (aPre === undefined || bPre === undefined) return aPre === bPre ? 0 : aPre === undefined ? 1 : -1
  const aParts = aPre.split('.'), bParts = bPre.split('.')
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index++) {
    const aPart = aParts[index], bPart = bParts[index]
    if (aPart === undefined || bPart === undefined) return aPart === bPart ? 0 : aPart === undefined ? -1 : 1
    const aNumeric = /^\d+$/.test(aPart), bNumeric = /^\d+$/.test(bPart)
    const difference = aNumeric && bNumeric ? compareNumericIdentifier(aPart, bPart)
      : aNumeric !== bNumeric ? aNumeric ? -1 : 1 : compareText(aPart, bPart)
    if (difference) return difference
  }
  return 0
}
function compareChangelogEntries(a: ChangelogEntry, b: ChangelogEntry): number {
  // Independent Suits have independent versions. Use a total ordering, never compare their versions.
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
    || compareText(a.suit, b.suit)
    || (a.status === b.status ? 0 : a.status === 'released' ? -1 : 1)
    || compareSuitVersions(b.status === 'released' ? b.version : b.targetVersion, a.status === 'released' ? a.version : a.targetVersion)
    || compareText(a.id, b.id)
}
/** Public projection is defense in depth; the service must authorize visibility before delivery. */
export function filterChangelog(feed: ChangelogFeed, filter: ChangelogFilter = {}): ChangelogEntry[] {
  const query = filter.search?.trim().toLocaleLowerCase(), locale = filter.locale ?? 'en'
  return feed.entries.filter(entry => entry.visibility === 'public' && Date.parse(entry.publishedAt) <= Date.parse(feed.serverNow)
    && (!filter.suit || entry.suit === filter.suit) && (!filter.status || entry.status === filter.status)
    && (!query || [entry.title[locale], entry.summary[locale], entry.details[locale]].some(value => value.toLocaleLowerCase().includes(query))))
    .sort(compareChangelogEntries)
}

/** Select complete released Suit/version groups; a release with several notes consumes one place. */
export function selectChangelogReleases(feed: ChangelogFeed, filter: Omit<ChangelogFilter, 'status'> = {}, limit = 3): ChangelogEntry[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid changelog release limit')
  const releases = new Map<string, ChangelogEntry[]>()
  for (const entry of filterChangelog(feed, { ...filter, status: 'released' })) {
    if (entry.status !== 'released') continue
    const key = JSON.stringify([entry.suit, entry.version])
    const notes = releases.get(key)
    if (notes) notes.push(entry)
    else releases.set(key, [entry])
  }
  return Array.from(releases.values()).slice(0, limit).flat()
}

/** One upcoming group first, followed by complete frozen production releases. */
export function selectChangelogOverview(feed: ChangelogFeed, filter: ChangelogFilter = {}, limit = 3): ChangelogEntry[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid changelog release limit')
  const groups = new Map<string, ChangelogEntry[]>()
  const entries = filter.status ? filterChangelog(feed, filter) : [...filterChangelog(feed, { ...filter, status: 'coming-soon' }), ...filterChangelog(feed, { ...filter, status: 'released' })]
  for (const entry of entries) {
    const key = JSON.stringify([entry.status, entry.suit, entry.status === 'released' ? entry.version : entry.targetVersion])
    const items = groups.get(key)
    if (items) items.push(entry)
    else groups.set(key, [entry])
  }
  return [...groups.values()].slice(0, limit).flat()
}
