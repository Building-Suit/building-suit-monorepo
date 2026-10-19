import { readPublicChangelog } from '../utils/changelogReader.ts'

/** Public SAS catalog read adapter. No target database or privileged credential. */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const config = useRuntimeConfig(event)
  try {
    return await readPublicChangelog({
      origin: config.releaseCatalogUrl,
      key: config.releaseCatalogPublishableKey,
      diagnostic: entry => console.warn('[changelog-reader]', entry),
      fetchFeed: (origin, key) => $fetch(`${origin}/rest/v1/rpc/release_public_feed`, {
        method: 'POST', body: {}, redirect: 'error', timeout: 10000,
        headers: { apikey: key },
      }),
    })
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Changelog unavailable' })
  }
})
