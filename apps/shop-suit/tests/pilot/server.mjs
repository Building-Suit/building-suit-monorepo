import { localStatus, nativeServerEnvironment } from './local-backend.mjs'

// Resolve guarded local credentials only when starting the test server, so
// Playwright discovery (--list) does not need Docker or database access.
Object.assign(process.env, nativeServerEnvironment(localStatus()))
await import('../../.output/server/index.mjs')
