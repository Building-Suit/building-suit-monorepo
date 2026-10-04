import { localStatus } from './local-backend.mjs'

// Resolve guarded local credentials only when starting the test server, so
// Playwright discovery (--list) does not need Docker or database access.
const status = localStatus()
process.env.NUXT_PUBLIC_SUPABASE_KEY = status.ANON_KEY
await import('../../.output/server/index.mjs')
