import { getCookie, setResponseHeader } from 'h3'
import { configuration } from '../../utils/hqAuth'
import { runtime, safe, sessionCookie } from '../../utils/hqRuntime'
import { projectState } from '../../utils/hqDomain'
export default defineEventHandler(event => safe(async () => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!configuration()) return { configured: false, authenticated: false, state: null }
  const { config, store } = runtime(event)
  const token = getCookie(event, sessionCookie(config.origin.startsWith('https:'))) || ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !await store.sessionValid(token)) return { configured: true, authenticated: false, state: null }
  return { configured: true, authenticated: true, state: projectState(await store.read(), { id: 'founder', role: 'founder' }, config.remote ? 'supabase' : 'sqlite') }
}))
