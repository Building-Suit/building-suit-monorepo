import { createError, setResponseHeaders, type H3Event } from 'h3'
import { hqRealtimeUrl, hqRpc, requireHqFounder, type HqAccessConfig, type HqFounderSession } from './hqAccess.ts'

type Invalidation = 'brain' | 'company' | 'access'
type LiveEvent = Invalidation | 'ready'
type JsonObject = Record<string, unknown>
const TOPIC = 'realtime:hq-live'
const JOIN_REF = '1'
const JOIN_TIMEOUT_MS = 15_000
const HEARTBEAT_MS = 20_000
const MAX_FRAME_BYTES = 16_384
const MAX_BUFFER_BYTES = 65_536
const MAX_CONNECTIONS = 32
const MAX_USER_CONNECTIONS = 8
const activeUsers = new Map<string, number>()
let activeConnections = 0

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function sessionExpiresAt(session: HqFounderSession): number {
  // Scheduling only: requireHqFounder already verified the token with Auth and
  // the live-session/founder RPC. Decoding an expiry grants no authority.
  try {
    const payload = object(JSON.parse(Buffer.from(session.accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')))
    if (payload?.sub !== session.user.id || payload.role !== 'authenticated'
      || typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp)
      || payload.exp * 1_000 <= Date.now()) throw new Error('Unavailable')
    return payload.exp * 1_000
  }
  catch { throw createError({ statusCode: 401, statusMessage: 'HQ access unavailable' }) }
}

/**
 * One private upstream socket per authenticated SSE request. Transport
 * heartbeats carry no application data and run no database/Drive queries.
 * https://supabase.com/docs/guides/realtime/protocol
 * https://supabase.com/docs/guides/realtime/authorization
 */
export async function streamHqEvents(event: H3Event, config: HqAccessConfig): Promise<void> {
  // Preserve loopback peer/dev attestation, Host/origin, both custom headers,
  // no-store, fresh Auth identity and trusted founder/session authorization.
  const session = await requireHqFounder(event, config)
  const expiresAt = sessionExpiresAt(session)
  const upstreamUrl = hqRealtimeUrl(config)
  const userKey = `${config.hqSupabaseUrl}:${session.user.id}`
  if (typeof WebSocket === 'undefined') throw createError({ statusCode: 503, statusMessage: 'HQ events unavailable' })
  if (activeConnections >= MAX_CONNECTIONS || (activeUsers.get(userKey) ?? 0) >= MAX_USER_CONNECTIONS) {
    setResponseHeaders(event, { 'Retry-After': '5' })
    throw createError({ statusCode: 429, statusMessage: 'HQ events unavailable' })
  }
  if (event.node.res.destroyed || event.node.req.aborted) return
  let upstream: WebSocket
  try { upstream = new WebSocket(upstreamUrl) }
  catch { throw createError({ statusCode: 503, statusMessage: 'HQ events unavailable' }) }
  activeConnections++
  activeUsers.set(userKey, (activeUsers.get(userKey) ?? 0) + 1)

  await new Promise<void>(resolve => {
    const response = event.node.res
    const disconnected = new AbortController()
    const pending = new Set<Invalidation>()
    let closed = false
    let joined = false
    let replicationReady = false
    let ready = false
    let readyPending = false
    let validating = false
    let blocked = false
    let reference = 1
    let heartbeatRef: string | null = null
    let coalesceTimer: ReturnType<typeof setTimeout> | undefined
    let backpressureTimer: ReturnType<typeof setTimeout> | undefined
    let joinTimer: ReturnType<typeof setTimeout> | undefined
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined

    function close(accessLost = false, destroy = false): void {
      if (closed) return
      if (accessLost && !response.destroyed && !response.writableEnded && !blocked) {
        // A local invalidation is safe even when authority has just disappeared;
        // it contains no private payload and tells the client to clear/recheck.
        try { response.write('event: access\ndata: {}\n\n') } catch { /* Disconnect already won. */ }
      }
      closed = true
      disconnected.abort()
      pending.clear()
      clearTimeout(coalesceTimer); clearTimeout(backpressureTimer)
      clearTimeout(joinTimer); clearTimeout(expiryTimer); clearInterval(heartbeatTimer)
      response.removeListener('drain', onDrain)
      response.removeListener('close', onDisconnect)
      response.removeListener('error', onDisconnect)
      event.node.req.removeListener('aborted', onDisconnect)
      upstream.removeEventListener('open', onOpen)
      upstream.removeEventListener('message', onMessage)
      upstream.removeEventListener('error', onSocketError)
      upstream.removeEventListener('close', onSocketClose)
      try { upstream.close(1000, 'Stream closed') } catch { /* No reconnect inside this request. */ }
      activeConnections--
      const remaining = (activeUsers.get(userKey) ?? 1) - 1
      if (remaining > 0) activeUsers.set(userKey, remaining)
      else activeUsers.delete(userKey)
      if (!response.destroyed && !response.writableEnded) {
        if (destroy) response.destroy()
        else response.end()
      }
      resolve()
    }

    function write(frame: string): boolean {
      if (closed || blocked || response.destroyed || response.writableEnded) return false
      if (response.writableLength + Buffer.byteLength(frame) > MAX_BUFFER_BYTES) { close(false, true); return false }
      try {
        if (!response.write(frame)) {
          blocked = true
          response.once('drain', onDrain)
          backpressureTimer = setTimeout(() => close(false, true), 10_000)
        }
        return true
      }
      catch { close(); return false }
    }

    function emit(kind: LiveEvent): boolean { return write(`event: ${kind}\ndata: {}\n\n`) }

    function send(topic: string, name: string, payload: JsonObject, ref: string, joinRef: string | null): boolean {
      if (closed || upstream.readyState !== WebSocket.OPEN || upstream.bufferedAmount > MAX_BUFFER_BYTES) { close(); return false }
      try { upstream.send(JSON.stringify({ topic, event: name, payload, ref, join_ref: joinRef })); return true }
      catch { close(); return false }
    }

    function queueValidation(): void {
      if (closed || blocked || validating || coalesceTimer !== undefined || (!ready && !readyPending)
        || (!readyPending && !pending.size)) return
      // One event-driven burst coalesces to at most three invalidation kinds.
      // This timer exists only after a real upstream message; it never polls.
      coalesceTimer = setTimeout(() => {
        coalesceTimer = undefined
        void validateAndForward()
      }, 50)
    }

    async function validateAndForward(): Promise<void> {
      if (closed || blocked || validating || (!ready && !readyPending) || (!readyPending && !pending.size)) return
      validating = true
      try {
        if (Date.now() >= expiresAt) { close(true); return }
        // Realtime caches join permissions. Recheck the actual current Auth
        // session + invitation/membership before forwarding each incoming burst.
        const authorized = await hqRpc<unknown>(config, session.accessToken, 'hq_can_receive_events', {}, disconnected.signal)
        if (closed) return
        if (authorized !== true || Date.now() >= expiresAt) { close(true); return }
        if (readyPending) {
          if (!emit('ready')) return
          ready = true
          readyPending = false
          clearTimeout(joinTimer)
        }
        for (const kind of pending) {
          if (!emit(kind)) break
          pending.delete(kind)
        }
      }
      catch (error: unknown) {
        if (closed) return
        const status = object(error)?.statusCode
        close(status === 401 || status === 403)
      }
      finally { validating = false; queueValidation() }
    }

    function onDrain(): void {
      blocked = false
      clearTimeout(backpressureTimer)
      backpressureTimer = undefined
      queueValidation()
    }
    function onDisconnect(): void { close() }
    function onSocketError(): void { close() }
    function onSocketClose(): void { close() }
    function maybeReady(): void {
      if (!ready && joined && replicationReady) { readyPending = true; queueValidation() }
    }
    function onOpen(): void {
      send(TOPIC, 'phx_join', {
        config: {
          private: true, broadcast: { ack: false, self: false, replication_ready: true },
          presence: { enabled: false }, postgres_changes: [],
        },
        access_token: session.accessToken,
      }, JOIN_REF, JOIN_REF)
    }
    function onMessage(message: MessageEvent): void {
      if (closed) return
      if (typeof message.data !== 'string' || Buffer.byteLength(message.data) > MAX_FRAME_BYTES) { close(); return }
      let frame: JsonObject | null
      try { frame = object(JSON.parse(message.data)) } catch { close(); return }
      if (!frame || typeof frame.event !== 'string' || typeof frame.topic !== 'string') { close(); return }
      const payload = object(frame.payload)
      if (frame.topic === 'phoenix' && frame.event === 'phx_reply' && frame.ref === heartbeatRef) {
        if (payload?.status !== 'ok') { close(); return }
        heartbeatRef = null
        return
      }
      if (frame.topic !== TOPIC) return
      if (frame.event === 'phx_reply' && frame.ref === JOIN_REF) {
        if (payload?.status !== 'ok') { close(); return }
        joined = true
        maybeReady()
        return
      }
      if (frame.event === 'phx_error' || frame.event === 'phx_close') { close(); return }
      if (frame.event === 'system') {
        if (payload?.status === 'error' || payload?.status === 'timeout') { close(); return }
        if (payload?.status === 'ok' && payload.extension === 'system' && payload.message === 'Replication connection established') {
          replicationReady = true
          maybeReady()
        }
        return
      }
      if (frame.event !== 'broadcast' || payload?.event !== 'invalidate') return
      const data = object(payload.payload)
      if (data?.kind !== 'brain' && data?.kind !== 'company' && data?.kind !== 'access') return
      pending.add(data.kind)
      if (ready || readyPending) queueValidation()
    }

    response.once('close', onDisconnect)
    response.once('error', onDisconnect)
    event.node.req.once('aborted', onDisconnect)
    upstream.addEventListener('open', onOpen)
    upstream.addEventListener('message', onMessage)
    upstream.addEventListener('error', onSocketError)
    upstream.addEventListener('close', onSocketClose)
    joinTimer = setTimeout(() => close(), JOIN_TIMEOUT_MS)
    expiryTimer = setTimeout(() => close(true), Math.min(expiresAt - Date.now(), 2_147_483_647))
    heartbeatTimer = setInterval(() => {
      if (closed || upstream.readyState !== WebSocket.OPEN) return
      if (heartbeatRef !== null) { close(); return }
      heartbeatRef = String(++reference)
      send('phoenix', 'heartbeat', {}, heartbeatRef, null)
      if (!blocked) write(': keepalive\n\n')
    }, HEARTBEAT_MS)
    try {
      setResponseHeaders(event, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'private, no-store, no-cache, max-age=0, no-transform',
        'X-Accel-Buffering': 'no', Connection: 'keep-alive',
      })
      response.flushHeaders()
      write('retry: 2000\n\n')
    }
    catch { close() }
  })
}
