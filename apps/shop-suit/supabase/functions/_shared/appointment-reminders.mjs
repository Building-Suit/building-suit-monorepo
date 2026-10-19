import {appointmentReminderEmail} from './generated/appointmentReminderEmail.ts'
const email = value => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value)
export function reminderConfiguration(env) {
  const mode = env('SHOP_REMINDER_DELIVERY_MODE')
  if (!['test','live'].includes(mode)) return null
  const allowlist = (env('SHOP_REMINDER_TEST_ALLOWLIST') || '').split(',').map(s => s.trim().toLowerCase())
  const from = env('SHOP_REMINDER_FROM'), apiKey = env('RESEND_API_KEY')
  if (!apiKey || !from || !/^[A-Za-z0-9._+-]+@building-suit\.com$/.test(from)) return null
  if (mode === 'test' && (allowlist.length < 1 || allowlist.length > 20 || !allowlist.every(email))) return null
  return {mode,allowlist:mode === 'test' ? [...new Set(allowlist)] : null,from,apiKey}
}
const recipientAllowed = (configuration,to) => email(to) && (configuration.mode === 'live' && configuration.allowlist === null || configuration.mode === 'test' && Array.isArray(configuration.allowlist) && configuration.allowlist.includes(to))
export async function processAppointmentReminder({rpc,configuration,fetchImpl=fetch}) {
  const row = await rpc('claim_appointment_email',{p_allowlist:configuration.allowlist,p_mode:configuration.mode})
  if (!row) return 'idle'
  if (!recipientAllowed(configuration,row.to)) throw Error('REMINDER_RECIPIENT_DENIED')
  const payload = row.payload || {from:configuration.from,to:[row.to],...appointmentReminderEmail(row)}
  // Persist exact bytes before HTTP; retry configuration/template changes cannot
  // alter an uncertain send. The DB rechecks current consent/contact and budgets.
  const prepared = await rpc('prepare_appointment_email',{p_id:row.id,p_lease_token:row.leaseToken,p_payload:payload,p_allowlist:configuration.allowlist,p_mode:configuration.mode})
  if (!prepared) return 'deferred'
  if (!Array.isArray(prepared.to) || prepared.to.length !== 1 || prepared.to[0] !== row.to || !recipientAllowed(configuration,prepared.to[0])) throw Error('REMINDER_RECIPIENT_DENIED')
  let providerId, status
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {method:'POST',signal:AbortSignal.timeout(10000),
      headers:{authorization:`Bearer ${configuration.apiKey}`,'content-type':'application/json','idempotency-key':`shop-appointment/${row.id}`},body:JSON.stringify(prepared)})
    if (!response.ok) status = response.status === 429 || response.status === 409 || response.status >= 500 ? 'retry' : 'review_required'
    else { const body = await response.json(); if (typeof body.id !== 'string' || !body.id || body.id.length > 128) throw Error('UNCERTAIN_RESULT'); providerId = body.id; status = 'sent' }
  } catch { status = 'retry' }
  // A persistence failure never triggers an unfenced resend here. Recovery uses
  // the same key and frozen payload within 23h, at most five provider attempts.
  const accepted = await rpc('finish_appointment_email',{p_id:row.id,p_lease_token:row.leaseToken,p_status:status,p_provider_id:providerId || null})
  return accepted ? status : 'superseded'
}
export function createAppointmentReminderSender({env,rpc,fetchImpl=fetch}) {
  return async request => {
    const reply = (status,body) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})
    if (request.method !== 'POST') return reply(405,{error:'method_not_allowed'})
    const token = env('SHOP_REMINDER_WORKER_TOKEN')
    if (!token || token.length < 32) return reply(503,{error:'sender_disabled'})
    if (request.headers.get('x-shop-reminder-worker-token') !== token || request.headers.get('authorization') !== `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`) return reply(401,{error:'unauthorized'})
    const configuration = reminderConfiguration(env)
    if (!configuration || !env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) return reply(503,{error:'sender_disabled'})
    try { const result = await processAppointmentReminder({rpc,configuration,fetchImpl});return reply(200,{processed:result === 'idle' || result === 'deferred' ? 0 : 1}) }
    catch { return reply(503,{error:'sender_unavailable'}) }
  }
}
