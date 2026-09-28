import { adminClient, authenticatedClient } from '../_shared/http.ts'
import { platformReceiptHandler } from '../_shared/platform-admin.ts'

Deno.serve(platformReceiptHandler({
  async authenticate(request) {
    const client = await authenticatedClient(request)
    return {
      async read(requestId) {
        // Caller JWT: the RPC commits read/denial evidence before this responds.
        const { data, error } = await client.rpc('platform_admin_read', { p_resource: 'payment_evidence', p_target_id: requestId })
        if (error) throw new Error('ADMIN_READ_FAILED')
        return { ok: data?.ok === true, storageKey: data?.data?.[0]?.storage_key, evidenceId: data?.data?.[0]?.id }
      },
    }
  },
  async sign(storageKey) {
    // Invoked only after authorization; the key comes from the database result.
    const result = await adminClient().storage.from('manual-payment-receipts').createSignedUrl(storageKey, 60)
    if (result.error) throw new Error('RECEIPT_UNAVAILABLE')
    return result.data.signedUrl
  },
}))
