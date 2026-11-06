import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { isIP } from 'node:net'

/** Validation only: this module never fetches a caller-supplied URL. */
export function validateResearchUrl(value, allowedHosts) {
  let url
  try { url = new URL(value) } catch { throw new Error('research-url-invalid') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname)
    || !Array.isArray(allowedHosts) || !allowedHosts.includes(url.hostname)
    || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)
    || !url.hostname.includes('.') || url.hash) throw new Error('research-url-not-authorized')
  return url.href
}

/** Explicit synthetic adapter. It does no network, model, speech or code work. */
export function createSyntheticExecutor({ delayMs = 0, fail = false } = {}) {
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 10000) throw new Error('synthetic-delay-invalid')
  return {
    mode: 'synthetic',
    name: 'deterministic-fixture-v1',
    async execute(task, { signal }) {
      if (delayMs) await new Promise((resolve, reject) => {
        const finish = () => { signal.removeEventListener('abort', abort); resolve() }
        const timer = setTimeout(finish, delayMs)
        const abort = () => { clearTimeout(timer); reject(new Error('cancelled')) }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
      if (signal.aborted) throw new Error('cancelled')
      if (fail) throw new Error('synthetic-tool-unavailable')
      return {
        status: 'completed',
        deliverable: `[SYNTHETIC FIXTURE] ${task.deliverable}. Question: ${task.question}. No repository, website, model or live employee was consulted.`,
        evidence: [{ url: 'https://example.com/synthetic-meeting-fixture', title: 'Disposable synthetic worker fixture; no external request occurred', inspectedAt: new Date().toISOString(), excerpt: 'Deterministic local test input only.' }],
      }
    },
  }
}

/** Bounded fixture worker, kept separate from the browser and speech turns. */
export function createMeetingWorker({ repository, executor, workerId = `fixture:${randomUUID()}`, leaseMs = 10000, heartbeatMs = 2000 }) {
  if (!executor || executor.mode !== 'synthetic') throw new Error('live-provider-not-qualified')
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 100 || leaseMs > 30000
    || !Number.isSafeInteger(heartbeatMs) || heartbeatMs < 25 || heartbeatMs * 2 >= leaseMs) throw new Error('invalid-worker-limits')
  let busy = false
  async function runOnce() {
    if (busy) throw new Error('worker-concurrency-limit')
    busy = true
    const started = performance.now()
    let heartbeat, timeout, lease
    const controller = new AbortController()
    let ownershipLost = false
    try {
      lease = repository.claim(workerId, { leaseMs })
      if (!lease) return { claimed: false, synthetic: true }
      heartbeat = setInterval(() => {
        try { repository.heartbeat(lease, { leaseMs }) }
        catch { ownershipLost = true; controller.abort() }
      }, heartbeatMs)
      timeout = setTimeout(() => controller.abort(), Math.max(1, lease.deadline - Date.now()))
      let result
      try { result = await executor.execute(lease.payload, { signal: controller.signal, lease }) }
      catch (error) {
        result = { status: 'failed', error: controller.signal.aborted ? 'task-timeout-or-cancelled' : error.message === 'synthetic-tool-unavailable' ? error.message : 'worker-execution-failed' }
      }
      if (ownershipLost) return { claimed: true, taskId: lease.id, status: 'stale-or-cancelled', synthetic: true }
      try { repository.complete(lease, result) }
      catch (error) {
        if (error.code !== 'stale-lease') throw error
        return { claimed: true, taskId: lease.id, status: 'stale-or-cancelled', synthetic: true }
      }
      return {
        claimed: true, taskId: lease.id, status: result.status, attempt: lease.attempt,
        elapsedMs: Math.round((performance.now() - started) * 100) / 100,
        rssMiB: Math.round(process.memoryUsage().rss / 1048576 * 100) / 100,
        maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024 * 100) / 100,
        synthetic: true,
      }
    }
    finally { clearInterval(heartbeat); clearTimeout(timeout); busy = false }
  }
  return { runOnce }
}
