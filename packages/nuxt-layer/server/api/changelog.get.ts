import { filterChangelog, parseChangelogFeed } from '@building-suit/contracts'

/** Public SAS catalog read adapter. No target database or privileged credential. */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const config = useRuntimeConfig(event)
  const origin = String(config.releaseCatalogUrl || '')
  if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(origin)) {
    throw createError({ statusCode: 503, statusMessage: 'Changelog unavailable' })
  }
  try {
    const raw = await $fetch(`${origin}/rest/v1/rpc/release_public_feed`, {
      method: 'POST', body: {}, redirect: 'error', timeout: 10000,
      headers: { apikey: String(config.releaseCatalogPublishableKey || '') },
    })
    const feed = parseChangelogFeed(raw)
    return { ...feed, entries: filterChangelog(feed) }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Changelog unavailable' })
  }
})
