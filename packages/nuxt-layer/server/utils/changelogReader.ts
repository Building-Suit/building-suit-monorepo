import { filterChangelog, parseChangelogFeed } from '@building-suit/contracts'

export type ChangelogReaderDiagnostic =
  | { code: 'CHANGELOG_CONFIGURATION_INVALID' | 'CHANGELOG_UPSTREAM_TRANSPORT' | 'CHANGELOG_FEED_INVALID' }
  | { code: 'CHANGELOG_UPSTREAM_STATUS'; status: number }

function upstreamStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = error as { response?: { status?: unknown }; statusCode?: unknown; status?: unknown }
  const status = value.response?.status ?? value.statusCode ?? value.status
  return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
}

/** Diagnostics are constructed here, never from exception messages, bodies, URLs or headers. */
export async function readPublicChangelog({ origin, key, fetchFeed, diagnostic }: {
  origin: unknown
  key: unknown
  fetchFeed: (origin: string, key: string) => Promise<unknown>
  diagnostic: (entry: ChangelogReaderDiagnostic) => void
}) {
  const unavailable = () => new Error('Changelog unavailable')
  if (typeof origin !== 'string' || !/^https:\/\/[a-z]{20}\.supabase\.co$/.test(origin)
    || typeof key !== 'string' || !key.trim() || key !== key.trim() || /[\r\n]/.test(key)) {
    diagnostic({ code: 'CHANGELOG_CONFIGURATION_INVALID' })
    throw unavailable()
  }
  let raw: unknown
  try { raw = await fetchFeed(origin, key) }
  catch (error) {
    const status = upstreamStatus(error)
    diagnostic(status === undefined ? { code: 'CHANGELOG_UPSTREAM_TRANSPORT' } : { code: 'CHANGELOG_UPSTREAM_STATUS', status })
    throw unavailable()
  }
  try {
    const feed = parseChangelogFeed(raw)
    return { ...feed, entries: filterChangelog(feed) }
  } catch {
    diagnostic({ code: 'CHANGELOG_FEED_INVALID' })
    throw unavailable()
  }
}
