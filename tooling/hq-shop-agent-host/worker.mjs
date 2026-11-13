import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createIntentResolver } from './model.mjs'

const TOPIC = 'realtime:shop-hq-assistant-jobs'
const JOIN_TIMEOUT_MS = 15_000
const HEARTBEAT_MS = 20_000
const RPC_TIMEOUT_MS = 5_000
const REAUTH_BEFORE_EXPIRY_MS = 30_000
const ALLOWED_SUPABASE_URLS = new Set([
  'https://jvvelvftpfnlogalgxgv.supabase.co',
  'https://fgdzjnsbcxfbiuogbmom.supabase.co',
  'http://127.0.0.1:61321',
  'http://localhost:61321',
])

function requiredEnv(env, key) {
  if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error('missing-' + key)
  return env[key]
}

function localAnonKey(key) {
  try {
    const parts = key.split('.')
    return parts.length === 3 && JSON.parse(Buffer.from(parts[1], 'base64url')).role === 'anon'
  } catch {
    return false
  }
}

export function readConfig(env = process.env) {
  const url = requiredEnv(env, 'SHOP_HQ_SUPABASE_URL').replace(/\/$/, '')
  if (!ALLOWED_SUPABASE_URLS.has(url)) throw new Error('unapproved-Shop-Supabase-origin')

  const key = requiredEnv(env, 'SHOP_HQ_SUPABASE_PUBLISHABLE_KEY')
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !(url.startsWith('http:') && localAnonKey(key))) {
    throw new Error('Shop-publishable-key-required')
  }

  const docsFile = env.SHOP_HQ_DOCS_FILE
  if (docsFile && !isAbsolute(docsFile)) throw new Error('absolute-Shop-docs-path-required')

  return {
    url,
    key,
    email: requiredEnv(env, 'SHOP_HQ_WORKER_EMAIL'),
    password: requiredEnv(env, 'SHOP_HQ_WORKER_PASSWORD'),
    openAiKey: requiredEnv(env, 'SHOP_HQ_OPENAI_API_KEY'),
    model: requiredEnv(env, 'SHOP_HQ_MODEL'),
    docsFile,
  }
}

function createShopClient(config, fetcher) {
  let session
  let authenticating

  async function request(path, body, accessToken) {
    const response = await fetcher(config.url + path, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      headers: {
        apikey: config.key,
        'content-type': 'application/json',
        ...(accessToken ? { authorization: 'Bearer ' + accessToken } : {}),
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      if (response.status === 401) session = undefined
      throw new Error('shop-request-failed')
    }
    return response.json()
  }

  async function authenticate() {
    let result
    if (session?.refreshToken) {
      try {
        result = await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refreshToken })
      } catch {
        // A revoked or expired refresh token requires a fresh technical-account login.
      }
    }
    result ??= await request('/auth/v1/token?grant_type=password', { email: config.email, password: config.password })
    if (typeof result?.access_token !== 'string' || !result.access_token ||
        typeof result.refresh_token !== 'string' || !result.refresh_token ||
        !Number.isFinite(result.expires_in) || result.expires_in < 60) {
      throw new Error('invalid-shop-session')
    }
    return { accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1_000 }
  }

  async function access() {
    if (session?.expiresAt > Date.now() + REAUTH_BEFORE_EXPIRY_MS) return session
    authenticating ??= authenticate().finally(() => { authenticating = undefined })
    session = await authenticating
    return session
  }

  async function rpc(name, body = {}) {
    const { accessToken } = await access()
    return request('/rest/v1/rpc/shop_hq_assistant_' + name, body, accessToken)
  }

  return { access, rpc }
}

function validLease(job) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof job?.jobId === 'string' && uuid.test(job.jobId) &&
    typeof job.leaseToken === 'string' && uuid.test(job.leaseToken)
}

export function startWorker(config, {
  fetcher = fetch,
  Socket = WebSocket,
  log = event => console.info('[shop-hq-worker]', event),
} = {}) {
  const shop = createShopClient(config, fetcher)
  const resolveIntent = createIntentResolver(config, fetcher)
  let connection
  let drain
  let wakeRequested = false
  let stopped = false
  let reconnectTimer
  let reconnectDelay = 1_000

  async function processJob(job) {
    if (!validLease(job)) throw new Error('invalid-Shop-lease')
    let intent = null
    try {
      intent = await resolveIntent(job.messages)
    } catch {
      log('intent-unavailable')
    }

    const receipt = {
      p_job_id: job.jobId,
      p_lease_token: job.leaseToken,
      p_intent: intent,
      p_succeeded: intent !== null,
    }
    let result
    try {
      result = await shop.rpc('finish', receipt)
    } catch {
      // A finish may have been committed before its response was lost. Repeat the same receipt.
      result = await shop.rpc('finish', receipt)
    }
    if (result !== true && result !== false) throw new Error('invalid-Shop-finish')
    if (!result) log('receipt-expired-or-revoked')
  }

  function wake() {
    wakeRequested = true
    if (stopped || !connection?.ready || drain) return
    drain = (async () => {
      do {
        wakeRequested = false
        while (!stopped && connection?.ready) {
          const job = await shop.rpc('claim')
          if (job === null) break
          await processJob(job)
        }
      } while (wakeRequested && !stopped && connection?.ready)
    })().catch(() => {
      log('queue-request-failed')
      reconnect(connection)
    }).finally(() => {
      drain = undefined
      if (wakeRequested && connection?.ready) wake()
    })
  }

  function disconnect(current) {
    if (!current) return
    if (current === connection) connection = undefined
    clearTimeout(current.joinTimer)
    clearTimeout(current.expiryTimer)
    clearInterval(current.heartbeatTimer)
    current.socket?.close()
  }

  function reconnect(current) {
    if (stopped || connection !== current || reconnectTimer) return
    disconnect(current)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      void connect()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
  }

  function setupSocket(current, { accessToken, expiresAt }) {
    const url = new URL('/realtime/v1/websocket', config.url)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('apikey', config.key)
    url.searchParams.set('vsn', '1.0.0')
    const socket = new Socket(url)
    current.socket = socket
    current.joinTimer = setTimeout(() => reconnect(current), JOIN_TIMEOUT_MS)
    current.expiryTimer = setTimeout(() => reconnect(current), expiresAt - Date.now() - REAUTH_BEFORE_EXPIRY_MS)
    const joinRef = '1'
    let sequence = 1
    let pendingHeartbeat
    let joined = false
    let replicationReady = false

    function send(topic, event, payload, ref) {
      try {
        socket.send(JSON.stringify({ topic, event, payload, ref, ...(topic === TOPIC ? { join_ref: joinRef } : {}) }))
      } catch {
        reconnect(current)
      }
    }

    socket.addEventListener('open', () => {
      if (current !== connection || stopped) return
      send(TOPIC, 'phx_join', {
        config: {
          private: true,
          broadcast: { ack: false, self: false, replication_ready: true },
          presence: { enabled: false },
          postgres_changes: [],
        },
        access_token: accessToken,
      }, joinRef)
      if (current !== connection) return
      current.heartbeatTimer = setInterval(() => {
        if (pendingHeartbeat) {
          reconnect(current)
          return
        }
        pendingHeartbeat = String(++sequence)
        send('phoenix', 'heartbeat', {}, pendingHeartbeat)
      }, HEARTBEAT_MS)
    })

    socket.addEventListener('message', event => {
      if (current !== connection || stopped) return
      let frame
      try {
        if (typeof event.data !== 'string' || Buffer.byteLength(event.data) > 65_536) throw new Error()
        frame = JSON.parse(event.data)
      } catch {
        reconnect(current)
        return
      }

      if (frame?.topic === 'phoenix' && frame.ref === pendingHeartbeat &&
          frame.event === 'phx_reply' && frame.payload?.status === 'ok') pendingHeartbeat = undefined
      if (frame?.topic !== TOPIC) return

      if (frame.event === 'phx_error' || frame.event === 'phx_close' ||
          (['phx_reply', 'system'].includes(frame.event) && ['error', 'timeout'].includes(frame.payload?.status))) {
        reconnect(current)
        return
      }
      if (frame.event === 'phx_reply' && frame.ref === joinRef && frame.payload?.status === 'ok') joined = true
      if (frame.event === 'system' && frame.payload?.status === 'ok' && frame.payload?.extension === 'system' &&
          frame.payload?.message === 'Replication connection established') replicationReady = true

      if (!current.ready && joined && replicationReady) {
        current.ready = true
        clearTimeout(current.joinTimer)
        reconnectDelay = 1_000
        log('queue-ready')
        wake()
        return
      }
      if (current.ready && frame.event === 'broadcast' && frame.payload?.event === 'jobs') wake()
    })

    socket.addEventListener('close', () => reconnect(current))
    socket.addEventListener('error', () => reconnect(current))
  }

  async function connect() {
    if (stopped || connection) return
    const current = { ready: false }
    connection = current
    try {
      const session = await shop.access()
      if (stopped || current !== connection) return
      setupSocket(current, session)
    } catch {
      log('queue-connect-failed')
      reconnect(current)
    }
  }

  void connect()

  return async function stop() {
    stopped = true
    clearTimeout(reconnectTimer)
    disconnect(connection)
    await drain
  }
}

async function main() {
  if (typeof WebSocket !== 'function') throw new Error('worker-runtime-requires-WebSocket')
  let config
  try {
    config = readConfig()
  } catch (error) {
    console.error('[shop-hq-worker]', error.message)
    process.exitCode = 1
    return
  }

  const stop = startWorker(config)
  const shutdown = async () => {
    await stop()
    process.exitCode = 0
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('[shop-hq-worker]', 'startup-failed')
    process.exitCode = 1
  })
}
