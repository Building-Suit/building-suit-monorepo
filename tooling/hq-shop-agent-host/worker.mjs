import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  EMPLOYEE_TEMPLATE, HEAD_AGENT_ID, MODEL_TIMEOUT_MS, loadInference, readApprovedDocs,
  validateIntent, validateMessages, validateReview,
} from './model.mjs'

const TOPIC = 'realtime:shop-hq-assistant-jobs'
const JOIN_TIMEOUT_MS = 15_000
const HEARTBEAT_MS = 20_000
const RPC_TIMEOUT_MS = 5_000
const REAUTH_BEFORE_EXPIRY_MS = 30_000
const MAX_REVIEW_BATCH = 4
const MAX_DISPATCH_BATCH = 32
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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

  const inference = requiredEnv(env, 'SHOP_HQ_INFERENCE_ADAPTER')
  let inferenceConfig
  if (inference === 'ollama') {
    const model = requiredEnv(env, 'SHOP_HQ_OLLAMA_MODEL')
    const modelDigest = requiredEnv(env, 'SHOP_HQ_OLLAMA_MODEL_DIGEST')
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}:[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(model) ||
        /(?:^|[:/._-])cloud(?:$|[:/._-])/i.test(model) || !/^[0-9a-f]{64}$/.test(modelDigest)) {
      throw new Error('approved-local-model-and-digest-required')
    }
    inferenceConfig = { model, modelDigest }
  } else if (inference === 'module') {
    const inferenceModule = requiredEnv(env, 'SHOP_HQ_INFERENCE_MODULE')
    if (!isAbsolute(inferenceModule)) throw new Error('absolute-inference-module-path-required')
    inferenceConfig = { inferenceModule }
  } else {
    throw new Error('invalid-inference-adapter')
  }

  return {
    url,
    key,
    email: requiredEnv(env, 'SHOP_HQ_WORKER_EMAIL'),
    password: requiredEnv(env, 'SHOP_HQ_WORKER_PASSWORD'),
    docsFile,
    inference,
    ...inferenceConfig,
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
  return typeof job?.jobId === 'string' && UUID.test(job.jobId) &&
    typeof job.leaseToken === 'string' && UUID.test(job.leaseToken)
}

function employeeFor(job) {
  if (typeof job.employeeId !== 'string' || !UUID.test(job.employeeId) || job.employeeTemplate !== EMPLOYEE_TEMPLATE) {
    throw new Error('invalid-Shop-employee-binding')
  }
  return { id: job.employeeId, template: job.employeeTemplate }
}

function headFor(job) {
  if (typeof job.headId !== 'string' || !UUID.test(job.headId) || job.headAgentId !== HEAD_AGENT_ID) {
    throw new Error('invalid-Shop-head-binding')
  }
  return { id: job.headId, agentId: job.headAgentId }
}

function outcomeFor(job) {
  const outcome = job.outcome
  if (outcome == null) return null
  if (!Number.isSafeInteger(outcome.sequence) || outcome.sequence < 1) throw new Error('invalid-Shop-action-outcome')
  if (outcome.kind === 'receipt' && typeof outcome.invoiceId === 'string' && UUID.test(outcome.invoiceId)) {
    return { kind: 'receipt' }
  }
  if (outcome.kind === 'clarification' && typeof outcome.outcome?.kind === 'string' &&
      /^[a-z_]{1,50}$/.test(outcome.outcome.kind)) {
    return { kind: 'clarification', reason: outcome.outcome.kind }
  }
  throw new Error('invalid-Shop-action-outcome')
}

export function startWorker(config, {
  inference,
  fetcher = fetch,
  Socket = WebSocket,
  log = event => console.info('[shop-hq-worker]', event),
} = {}) {
  if (typeof inference?.inferEmployee !== 'function' || typeof inference.reviewEmployee !== 'function') {
    throw new Error('inference-adapter-required')
  }
  const shop = createShopClient(config, fetcher)
  let connection
  let drain
  let wakeRequested = false
  let stopped = false
  let reconnectTimer
  let reconnectDelay = 1_000

  async function settle(name, body) {
    let result
    try {
      result = await shop.rpc(name, body)
    } catch {
      // A committed update may have lost its reply. Repeat the same fenced call.
      result = await shop.rpc(name, body)
    }
    return result
  }

  async function settleLease(name, job, body) {
    if (!validLease(job)) throw new Error('invalid-Shop-lease')
    const result = await settle(name, { p_job_id: job.jobId, p_lease_token: job.leaseToken, ...body })
    if (result !== true && result !== false) throw new Error('invalid-Shop-lease-result')
    if (!result) log('lease-expired-or-revoked')
  }

  async function processEmployee(job) {
    const employee = employeeFor(job)
    if (!validLease(job)) throw new Error('invalid-Shop-lease')
    let intent = null
    try {
      intent = validateIntent(await inference.inferEmployee({
        employee,
        messages: validateMessages(job.messages),
        feedback: typeof job.feedback === 'string' ? job.feedback.slice(0, 500) : null,
        outcome: outcomeFor(job),
        docs: await readApprovedDocs(config.docsFile),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      }))
      if (job.outcome?.kind === 'receipt' && intent.kind === 'service_sale') {
        throw new Error('sale-already-issued')
      }
    } catch {
      intent = null
      log('employee-inference-unavailable')
    }
    await settleLease('finish', job, { p_intent: intent, p_succeeded: intent !== null })
  }

  async function processReview(job) {
    const head = headFor(job)
    const employee = employeeFor(job)
    if (!validLease(job)) throw new Error('invalid-Shop-lease')
    let review = { approved: false, feedback: null }
    try {
      review = validateReview(await inference.reviewEmployee({
        head,
        employee,
        messages: validateMessages(job.messages),
        intent: validateIntent(job.intent),
        outcome: outcomeFor(job),
        docs: await readApprovedDocs(config.docsFile),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      }))
    } catch {
      log('head-review-unavailable')
    }
    await settleLease('review_finish', job, { p_approved: review.approved, p_feedback: review.feedback })
  }

  async function executeSale(job) {
    if (!validLease(job)) throw new Error('invalid-Shop-lease')
    await settle('execute_sale', { p_job_id: job.jobId, p_lease_token: job.leaseToken })
  }

  async function drainStages() {
    const sale = await shop.rpc('sale_claim')
    if (sale !== null) {
      await executeSale(sale)
      return true
    }

    const batch = await shop.rpc('review_claim')
    if (!Array.isArray(batch) || batch.length > MAX_REVIEW_BATCH) throw new Error('invalid-Shop-review-batch')
    for (const job of batch) {
      if (stopped || !connection?.ready) break
      await processReview(job)
    }
    if (stopped || !connection?.ready) return false

    let assigned = false
    for (let index = 0; index < MAX_DISPATCH_BATCH && !stopped && connection?.ready; index++) {
      const dispatch = await shop.rpc('dispatch')
      if (dispatch === null) break
      if (typeof dispatch?.jobId !== 'string' || !UUID.test(dispatch.jobId)) throw new Error('invalid-Shop-dispatch')
      employeeFor(dispatch)
      headFor(dispatch)
      assigned = true
    }

    if (stopped || !connection?.ready) return false
    const employeeJob = await shop.rpc('claim')
    if (employeeJob !== null) {
      await processEmployee(employeeJob)
      return true
    }

    return assigned || batch.length > 0
  }

  function wake() {
    wakeRequested = true
    if (stopped || !connection?.ready || drain) return
    drain = (async () => {
      do {
        wakeRequested = false
        while (!stopped && connection?.ready && await drainStages()) { /* Recheck durable stages after each transition. */ }
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

  const stop = startWorker(config, { inference: await loadInference(config) })
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
