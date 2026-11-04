import { getHeader, setResponseHeaders } from 'h3'
import { founder, safe } from '../../utils/hqRuntime'
import { configuration } from '../../utils/hqAuth'
import { HqStore } from '../../utils/hqStore'
import { HqProblem } from '../../utils/hqDomain'
import { LocalInvalidationCursor, LocalUpdateConnections, localUpdatePolicy } from '../../utils/hqRealtime'

const connections = new LocalUpdateConnections()
/** Local node-server SSE invalidations only. Hosted subscriptions remain disabled. */
export default defineEventHandler(event => safe(async () => {
  const candidate = configuration()
  if (candidate && (candidate.environment !== 'local' || candidate.remote)) throw new HqProblem(503, 'HQ_HOSTED_REALTIME_DISABLED', 'Hosted HQ updates require verified dedicated scope, authorization and zero-cost hosting.')
  const { config, store, token } = await founder(event)
  if (config.environment !== 'local' || config.remote || !(store instanceof HqStore)) throw new HqProblem(503, 'HQ_HOSTED_REALTIME_DISABLED', 'Hosted HQ updates require verified dedicated scope, authorization and zero-cost hosting.')
  const origin = getHeader(event, 'origin'), site = getHeader(event, 'sec-fetch-site')
  if ((origin && origin !== config.origin) || (site && !['same-origin', 'none'].includes(site))) throw new HqProblem(403, 'HQ_ORIGIN', 'Same-origin access is required.')
  const release = connections.acquire(token)
  const cursor = new LocalInvalidationCursor(store, token)
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' })
  await new Promise<void>(resolve => {
    let closed = false, interval: ReturnType<typeof setInterval> | undefined, expiry: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      if (closed) return
      closed = true; clearInterval(interval); clearTimeout(expiry); release()
      event.node.res.off('close', finish); event.node.req.off('aborted', finish)
      if (!event.node.res.destroyed && !event.node.res.writableEnded) event.node.res.end()
      resolve()
    }
    const tick = () => {
      if (closed) return
      try {
        const update = cursor.poll()
        if (update.kind === 'closed') { finish(); return }
        if (update.kind === 'invalidate' && !event.node.res.write('event: invalidate\ndata: ' + JSON.stringify({ revision: update.revision }) + '\n\n')) finish()
      } catch { finish() }
    }
    event.node.res.once('close', finish); event.node.req.once('aborted', finish)
    if (event.node.req.aborted || event.node.res.destroyed) { finish(); return }
    tick()
    if (!closed) {
      interval = setInterval(tick, localUpdatePolicy.intervalMs)
      expiry = setTimeout(finish, localUpdatePolicy.lifetimeMs)
    }
  })
}))
