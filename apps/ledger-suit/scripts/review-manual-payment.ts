// Dedicated operator user token. Privileged credentials never enter this client.
import { createClient } from 'npm:@supabase/supabase-js@2'
const [requestId, evidenceId, action, reason, context, commandId] = Deno.args
if (!requestId || !evidenceId || !['inspect', 'under_review', 'approved', 'rejected'].includes(action)
  || (action !== 'inspect' && (!reason?.trim() || !context?.trim() || !commandId))) {
  throw new Error('Usage: review-manual-payment.ts <request-id> <evidence-id> inspect|under_review|approved|rejected "reason" "case context" <stable-command-uuid>')
}
function env(key: string) { const value = Deno.env.get(key); if (!value) throw new Error(`Missing ${key}`); return value }
const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
  global: { headers: { Authorization: `Bearer ${env('MANUAL_PAYMENT_OPERATOR_ACCESS_TOKEN')}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})
if (action === 'inspect') {
  const receipt = await client.functions.invoke('platform-admin-receipt', { body: { requestId } })
  if (receipt.error || receipt.data.evidenceId !== evidenceId) throw new Error('Receipt unavailable or replaced; refresh the payment.')
  const payment = await client.rpc('platform_admin_read', { p_resource: 'payments', p_target_id: requestId })
  if (payment.error || !payment.data?.ok) throw new Error('Payment read denied or unavailable.')
  console.log(JSON.stringify({ request: payment.data.data[0], receiptUrl: receipt.data.url }))
} else {
  const { data, error } = await client.rpc('platform_admin_review_payment', {
    p_command_id: commandId, p_request_id: requestId, p_evidence_id: evidenceId, p_action: action, p_reason: reason, p_context: context,
  })
  if (error || !data?.ok) throw new Error(data?.error ?? 'Payment review failed.')
  console.log(JSON.stringify({ payment: data.data.payment, replayed: data.replayed, auditId: data.audit_id }))
}
