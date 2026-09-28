// Uses a short-lived operator user access token, NEVER a browser service-role key.
import { createClient } from 'npm:@supabase/supabase-js@2'
const [requestId, evidenceId, action, reason] = Deno.args
if (!requestId || !evidenceId || !['inspect', 'under_review', 'approved', 'rejected'].includes(action) || (action !== 'inspect' && !reason?.trim())) {
  throw new Error('Usage: review-manual-payment.ts <request-id> <evidence-id> inspect|under_review|approved|rejected "reason"')
}
function env(key: string) { const value = Deno.env.get(key); if (!value) throw new Error(`Missing ${key}`); return value }
const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
  global: { headers: { Authorization: `Bearer ${env('MANUAL_PAYMENT_OPERATOR_ACCESS_TOKEN')}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})
if (action === 'inspect') {
  const { data, error } = await client.from('manual_payment_evidence').select('*').eq('request_id', requestId).eq('id', evidenceId).single()
  if (error) throw new Error(error.message)
  const receipt = await client.storage.from('manual-payment-receipts').createSignedUrl(data.storage_key, 60)
  if (receipt.error) throw new Error(receipt.error.message)
  const payment = await client.from('manual_payment_requests').select('*').eq('id', requestId).single()
  if (payment.error) throw new Error(payment.error.message)
  console.log(JSON.stringify({ request: payment.data, evidence: data, receiptUrl: receipt.data.signedUrl }))
} else {
  const { data, error } = await client.rpc('review_manual_payment', { p_request_id: requestId, p_evidence_id: evidenceId, p_action: action, p_reason: reason })
  if (error) throw new Error(error.message)
  console.log(JSON.stringify({ id: data.id, status: data.status, periodStart: data.period_start, periodEnd: data.period_end }))
}
