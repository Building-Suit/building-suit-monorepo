import { adminClient, authenticatedClient, handleOptions, json } from '../_shared/http.ts'
import { boundedFormData, validateReceipt } from '../_shared/manual-payment.ts'

Deno.serve(async (request) => {
  const preflight = handleOptions(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const client = await authenticatedClient(request)
    const { data: identity, error: identityError } = await client.auth.getUser()
    if (identityError || !identity.user) return json({ error: 'AUTHENTICATION_REQUIRED' }, 401)
    const form = await boundedFormData(request)
    const requestId = form.get('requestId')
    const evidenceId = form.get('evidenceId')
    const reason = form.get('reason')
    const file = form.get('receipt')
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof requestId !== 'string' || !uuid.test(requestId) || typeof evidenceId !== 'string' || !uuid.test(evidenceId)
      || typeof reason !== 'string' || !reason.trim() || reason.length > 1000 || !(file instanceof File)) {
      return json({ error: 'RECEIPT_REQUEST_INVALID' }, 400)
    }
    // RLS requires billing.manage, and hides other tenants' payment requests.
    const { data: payment, error } = await client.from('manual_payment_requests').select('*').eq('id', requestId).single()
    if (error || !payment) return json({ error: 'PAYMENT_ACCESS_DENIED' }, 403)
    // Operators can read via RLS, but only a current tenant billing manager submits.
    const { data: capabilities, error: capabilityError } = await client.rpc('my_capabilities', { p_organization_id: payment.organization_id })
    if (capabilityError || !capabilities?.includes('billing.manage')) return json({ error: 'PAYMENT_ACCESS_DENIED' }, 403)
    if (payment.evidence_id === evidenceId) return json({ request: payment })
    if (!['draft', 'rejected'].includes(payment.status)) return json({ error: 'MANUAL_PAYMENT_INVALID_STATE' }, 409)
    const bytes = new Uint8Array(await file.arrayBuffer())
    validateReceipt(bytes, file.type, file.name)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const admin = adminClient()
    const key = `${payment.organization_id}/${payment.id}/${evidenceId}`
    const { error: uploadError } = await admin.storage.from('manual-payment-receipts').upload(key, bytes, { contentType: file.type, upsert: false })
    if (uploadError) {
      // A response may have been lost after upload. Only resume the exact bytes.
      const { data: existing, error: downloadError } = await admin.storage.from('manual-payment-receipts').download(key)
      if (downloadError || !existing) return json({ error: 'RECEIPT_UPLOAD_FAILED' }, 409)
      const existingHash = await crypto.subtle.digest('SHA-256', await existing.arrayBuffer())
      if (Array.from(new Uint8Array(existingHash), byte => byte.toString(16).padStart(2, '0')).join('') !== sha256 || existing.type !== file.type) {
        return json({ error: 'RECEIPT_ID_REUSED' }, 409)
      }
    }
    const result = await admin.rpc('submit_manual_payment', {
      p_request_id: payment.id, p_evidence_id: evidenceId, p_actor_id: identity.user.id,
      p_filename: file.name, p_sha256: sha256, p_reason: reason.trim(),
    })
    // Keep any uploaded object on ambiguous failure; never delete submitted evidence.
    if (result.error) return json({ error: 'RECEIPT_SUBMISSION_FAILED' }, 409)
    return json({ request: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return json({ error: /^RECEIPT_[A-Z_]+$/.test(message) ? message : 'MANUAL_PAYMENT_FAILED' }, 400)
  }
})
