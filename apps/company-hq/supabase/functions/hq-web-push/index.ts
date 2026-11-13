// The Edge worker is invoked by the private database dispatcher. Keep provider
// endpoints, subscription keys and raw delivery errors out of logs and replies.
import { timingSafeEqual } from 'node:crypto'
import webPush from 'npm:web-push@3.6.7'

const projects = new Set(['https://dpruoncalmwicrqhqelu.supabase.co', 'https://nkpvskyugnnnozepbwzb.supabase.co'])
const endpointPattern = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\/[^\s#]+$/
const labels: Readonly<Record<string, string>> = {
  'founder-message': 'Founder message sent',
  'agent-message': 'Agent replied',
  task: 'Company task updated',
  'agent-work': 'Agent work status changed',
  'plan-decision': 'Company plan decision recorded',
  plan: 'Company plan updated',
  staffing: 'Staffing workflow updated',
  'staffing-decision': 'Staffing decision recorded',
  meeting: 'Meeting activity recorded',
  'meeting-contribution': 'Meeting contribution updated',
  'task-result': 'Agent work result recorded',
  learning: 'Company learning updated',
  trial: 'Agent trial updated',
  brain: 'Company Brain updated',
}

interface Delivery {
  id: string
  lease: string
  endpoint: string
  activity: string
  p256dh: string
  auth: string
}

function authorized(request: Request, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false
  const supplied = request.headers.get('x-hq-push-token') ?? ''
  return /^[a-f0-9]{64}$/.test(supplied) &&
    timingSafeEqual(new TextEncoder().encode(supplied), new TextEncoder().encode(token))
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  if (!authorized(request, Deno.env.get('HQ_PUSH_DISPATCH_TOKEN') ?? '')) return new Response(null, { status: 403 })
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('HQ_PUSH_VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('HQ_PUSH_VAPID_PRIVATE_KEY') ?? ''
  const subject = Deno.env.get('HQ_PUSH_VAPID_SUBJECT') ?? ''
  if (!projects.has(url) || !key || !/^[A-Za-z0-9_-]{87}$/.test(publicKey)
    || !/^[A-Za-z0-9_-]{43}$/.test(privateKey) || !/^mailto:[^\s@]+@[^\s@]+$/.test(subject)) {
    return new Response(null, { status: 503 })
  }

  async function rpc(name: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error('Push queue unavailable')
    return response.status === 204 ? null : await response.json()
  }

  async function deliver(job: Delivery) {
    const activity = Object.hasOwn(labels, job.activity) ? labels[job.activity] : undefined
    if (!activity || !endpointPattern.test(job.endpoint) || job.endpoint.includes('\\')) return 'discard'
    try {
      const details = webPush.generateRequestDetails({
        endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth },
      }, JSON.stringify({ id: job.id, activity }), {
        TTL: 600, vapidDetails: { subject, publicKey, privateKey },
      })
      const response = await fetch(job.endpoint, {
        method: 'POST', headers: details.headers, body: details.body ? new Uint8Array(details.body) : null,
        redirect: 'manual', signal: AbortSignal.timeout(8_000),
      })
      void response.body?.cancel().catch(() => {})
      if (response.ok) return 'sent'
      if (response.status === 404 || response.status === 410) return 'expired'
      if (response.status === 429 || response.status >= 500 || response.status === 401 || response.status === 403) return 'retry'
      return 'discard'
    }
    catch { return 'retry' }
  }

  try {
    const jobs = await rpc('hq_claim_push_deliveries') as Delivery[]
    const results = await Promise.allSettled(jobs.map(async job => {
      const result = await deliver(job)
      await rpc('hq_finish_push_delivery', { p_id: job.id, p_lease: job.lease, p_result: result })
    }))
    return new Response(null, { status: results.some(result => result.status === 'rejected') ? 503 : 204 })
  }
  catch { return new Response(null, { status: 503 }) }
})
