import { authorizeServer, env } from '../_shared/xpay-runtime.ts'
import { createInvoiceClient, createInvoiceSigner, createInvoiceDispatcher, createInvoiceReconciler } from '../_shared/eta-einvoice-worker.mjs'
const client = createInvoiceClient({})
async function rpc(name: string, args: unknown) {
 if (!['shop_eta_invoice_claim','shop_eta_invoice_prepare','shop_eta_transition','shop_eta_invoice_acknowledge','shop_eta_invoice_recovery_context','shop_eta_invoice_link_recovery'].includes(name)) throw new Error('ETA_RPC_DENIED')
 const key = env('SUPABASE_SERVICE_ROLE_KEY') || ''
 const url = new URL(env('SUPABASE_URL') || '')
 const response = await fetch(`${url.origin}/rest/v1/rpc/${name}`, { method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(args) })
 if (!response.ok) throw new Error('ETA_RPC_FAILED')
 return response.json()
}
const configuration = (shopId: string) => {
 try {
  const configured = JSON.parse(env('SHOP_ETA_PREPRODUCTION_ERPS') || '[]')
  return configured.find((entry: {shopId: string})=>entry.shopId === shopId)
 } catch { return null }
}
const dispatch = createInvoiceDispatcher({rpc,client,configuration,sign:createInvoiceSigner({})})
const reconcile = createInvoiceReconciler({rpc,client,configuration})
Deno.serve(async (request: Request) => {
 if (request.method !== 'POST' || !await authorizeServer(request.headers.get('authorization'))) return new Response(null,{status:403})
 if (env('SHOP_ETA_EINVOICE_DISPATCH_ENABLED') !== 'true') return Response.json({state:'disabled'},{status:503})
 try {
  const body = await request.text()
  if (body.length > 1024) return new Response(null,{status:413})
  const recovery = body ? JSON.parse(body).reconcile : null
  return Response.json(recovery ? await reconcile(recovery.outboxId,recovery.submissionUUID) : await dispatch())
 } catch { return Response.json({state:'retry_later'},{status:503}) }
})
